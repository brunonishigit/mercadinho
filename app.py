import os
from decimal import Decimal, InvalidOperation
from datetime import datetime

from flask import Flask, jsonify, request
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')

if supabase_url and supabase_key:
    try:
        supabase = create_client(supabase_url, supabase_key)
    except Exception:  # pragma: no cover
        supabase = None
else:
    supabase = None


def safe_query(table_name, select='*', **kwargs):
    if not supabase:
        return []

    try:
        query = supabase.table(table_name).select(select)
        for key, value in kwargs.items():
            if value is not None:
                query = query.eq(key, value)
        response = query.execute()
        return response.data or []
    except Exception:
        return []


def safe_insert(table_name, payload):
    if not supabase:
        return None

    try:
        response = supabase.table(table_name).insert(payload).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception:
        return None


def safe_update(table_name, row_id, payload):
    if not supabase or row_id is None:
        return None

    try:
        response = supabase.table(table_name).update(payload).eq('id_lote', row_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception:
        return None


def parse_decimal(raw_value):
    if raw_value in (None, '', ' '):
        return Decimal('0')

    try:
        value = Decimal(str(raw_value).replace(',', '.'))
    except (InvalidOperation, ValueError):
        raise ValueError('Valor numérico inválido.')

    return value


def get_user_by_login(login_name):
    login_name = str(login_name or '').strip().lower()
    if not login_name:
        return None

    for item in safe_query('usuario', '*'):
        if str(item.get('login', '')).strip().lower() == login_name and bool(item.get('ativo', False)):
            return item
    return None


def get_product_by_id(product_id):
    if product_id in (None, ''):
        return None

    products = safe_query('produto', '*', id_produto=int(product_id))
    return products[0] if products else None


def get_category_name(category_id):
    if category_id in (None, ''):
        return 'Sem categoria'

    categories = safe_query('categoria', '*', id_categoria=int(category_id))
    if categories:
        return categories[0].get('nome', 'Sem categoria')
    return 'Sem categoria'


def calculate_product_stock(product_id):
    lots = safe_query('lote', '*', id_produto=int(product_id))
    total = Decimal('0')

    for lot in lots:
        try:
            total += parse_decimal(lot.get('quantidade', 0))
        except ValueError:
            continue

    return total


def consume_stock_by_fifo(product_id, quantity):
    remaining = parse_decimal(quantity)
    lots = safe_query('lote', '*', id_produto=int(product_id))
    lots = sorted(
        lots,
        key=lambda item: (str(item.get('data_validade') or '9999-12-31'), item.get('id_lote', 0))
    )

    consumed_lot_ids = []

    for lot in lots:
        if remaining <= 0:
            break

        lot_quantity = parse_decimal(lot.get('quantidade', 0))
        if lot_quantity <= 0:
            continue

        used = min(remaining, lot_quantity)
        updated_quantity = lot_quantity - used
        safe_update('lote', lot.get('id_lote'), {'quantidade': str(updated_quantity)})
        consumed_lot_ids.append(lot.get('id_lote'))
        remaining -= used

    if remaining > 0:
        return None

    return consumed_lot_ids[-1] if consumed_lot_ids else None


@app.get('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'database': 'connected' if supabase else 'not-configured'
    })


@app.post('/api/auth/login')
def login():
    payload = request.get_json(silent=True) or {}
    usuario = str(payload.get('usuario', '')).strip()
    senha = str(payload.get('senha', '')).strip()

    if not usuario or not senha:
        return jsonify({'ok': False, 'message': 'Usuário e senha são obrigatórios.'}), 400

    if not supabase:
        return jsonify({'ok': False, 'message': 'Banco não configurado.'}), 503

    usuario_validado = get_user_by_login(usuario)

    if not usuario_validado:
        return jsonify({'ok': False, 'message': 'Credenciais inválidas.'}), 401

    senha_banco = str(usuario_validado.get('senha', '')).strip()
    if senha_banco != senha:
        return jsonify({'ok': False, 'message': 'Credenciais inválidas.'}), 401

    return jsonify({
        'ok': True,
        'usuario': usuario_validado.get('login', usuario),
        'perfil': usuario_validado.get('tipo', 'FUNCIONARIO'),
        'message': 'Login realizado com sucesso.'
    })


@app.get('/api/categorias')
def list_categories():
    items = safe_query('categoria', '*')
    return jsonify({'items': items}), 200


@app.get('/api/fornecedores')
def list_suppliers():
    items = safe_query('fornecedor', '*')
    return jsonify({'items': items}), 200


@app.get('/api/produtos')
def list_products():
    items = safe_query('produto', '*')
    enriched = []

    for item in items:
        product_id = item.get('id_produto')
        if product_id is None:
            continue

        item_copy = dict(item)
        item_copy['categoria'] = get_category_name(item_copy.get('id_categoria'))
        try:
            item_copy['estoque_atual'] = str(calculate_product_stock(product_id))
        except Exception:
            item_copy['estoque_atual'] = '0'
        enriched.append(item_copy)

    return jsonify({'items': enriched}), 200


@app.post('/api/produtos')
def create_product():
    payload = request.get_json(silent=True) or {}

    nome = str(payload.get('nome', '')).strip()
    categoria_id = payload.get('id_categoria')
    unidade = str(payload.get('unidade_medida') or '').strip()

    if not nome or not categoria_id or not unidade:
        return jsonify({'ok': False, 'message': 'Nome, categoria e unidade são obrigatórios.'}), 400

    codigo_barras = str(payload.get('codigo_barras') or '').strip() or None
    if codigo_barras:
        existing = safe_query('produto', '*', codigo_barras=codigo_barras)
        if existing:
            return jsonify({'ok': False, 'message': 'Código de barras já cadastrado.'}), 409

    try:
        estoque_minimo = parse_decimal(payload.get('estoque_minimo', 0))
    except ValueError:
        return jsonify({'ok': False, 'message': 'Estoque mínimo inválido.'}), 400

    product_payload = {
        'id_categoria': int(categoria_id),
        'nome': nome,
        'codigo_barras': codigo_barras,
        'unidade_medida': unidade,
        'estoque_minimo': str(estoque_minimo),
        'ativo': bool(payload.get('ativo', True))
    }

    created = safe_insert('produto', product_payload)
    if created is None:
        return jsonify({'ok': False, 'message': 'Não foi possível cadastrar o produto.'}), 500

    return jsonify({'ok': True, 'message': 'Produto cadastrado com sucesso.', 'id_produto': created.get('id_produto')}), 200


@app.get('/api/movimentacoes')
def list_movements():
    items = safe_query('movimentacao', '*')
    enriched = []

    for item in items:
        item_copy = dict(item)
        product = get_product_by_id(item_copy.get('id_produto'))
        item_copy['produto'] = product.get('nome', 'Produto') if product else 'Produto'
        item_copy['categoria'] = get_category_name(product.get('id_categoria')) if product else 'Sem categoria'
        enriched.append(item_copy)

    return jsonify({'items': enriched}), 200


@app.post('/api/movimentacoes')
def create_movement():
    payload = request.get_json(silent=True) or {}
    tipo = str(payload.get('tipo', 'ENTRADA')).upper().strip()
    product_id = payload.get('id_produto')
    usuario_login = str(payload.get('usuario') or payload.get('login') or 'operador').strip()

    if product_id in (None, ''):
        return jsonify({'ok': False, 'message': 'Produto obrigatório.'}), 400

    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'ok': False, 'message': 'Produto não encontrado.'}), 404

    usuario = get_user_by_login(usuario_login)
    if not usuario:
        return jsonify({'ok': False, 'message': 'Usuário não encontrado.'}), 401

    try:
        quantidade = parse_decimal(payload.get('quantidade', 0))
    except ValueError:
        return jsonify({'ok': False, 'message': 'Quantidade inválida.'}), 400

    if quantidade <= 0:
        return jsonify({'ok': False, 'message': 'Quantidade deve ser maior que zero.'}), 400

    if tipo == 'ENTRADA':
        fornecedor_id = payload.get('id_fornecedor')
        if fornecedor_id in (None, ''):
            return jsonify({'ok': False, 'message': 'Fornecedor obrigatório para entrada.'}), 400

        data_entrada = payload.get('data_entrada') or datetime.utcnow().strftime('%Y-%m-%d')
        data_validade = payload.get('data_validade')

        lote_payload = {
            'id_produto': int(product_id),
            'id_fornecedor': int(fornecedor_id),
            'data_entrada': str(data_entrada),
            'data_validade': str(data_validade) if data_validade else None,
            'quantidade': str(quantidade)
        }

        lote = safe_insert('lote', lote_payload)
        if lote is None:
            return jsonify({'ok': False, 'message': 'Não foi possível registrar o lote.'}), 500

        movimentacao = safe_insert('movimentacao', {
            'id_produto': int(product_id),
            'id_lote': lote.get('id_lote'),
            'id_usuario': usuario.get('id_usuario'),
            'tipo': 'ENTRADA',
            'quantidade': str(quantidade),
            'data_movimentacao': datetime.utcnow().isoformat(timespec='seconds'),
            'observacao': str(payload.get('observacao') or '')
        })

        return jsonify({'ok': True, 'message': 'Entrada registrada com sucesso.', 'id_lote': lote.get('id_lote'), 'id_movimentacao': movimentacao.get('id_movimentacao') if movimentacao else None}), 200

    if tipo == 'SAIDA':
        estoque_atual = calculate_product_stock(product_id)
        if quantidade > estoque_atual:
            return jsonify({'ok': False, 'message': 'Quantidade acima do disponível no estoque.'}), 400

        lot_id = consume_stock_by_fifo(product_id, quantidade)
        if lot_id is None:
            return jsonify({'ok': False, 'message': 'Não foi possível ajustar o estoque para a saída.'}), 400

        movimentacao = safe_insert('movimentacao', {
            'id_produto': int(product_id),
            'id_lote': lot_id,
            'id_usuario': usuario.get('id_usuario'),
            'tipo': 'SAIDA',
            'quantidade': str(quantidade),
            'data_movimentacao': datetime.utcnow().isoformat(timespec='seconds'),
            'observacao': str(payload.get('observacao') or '')
        })

        return jsonify({'ok': True, 'message': 'Saída registrada com sucesso.', 'id_lote': lot_id, 'id_movimentacao': movimentacao.get('id_movimentacao') if movimentacao else None}), 200

    return jsonify({'ok': False, 'message': 'Tipo de movimentação inválido.'}), 400


@app.get('/api/alertas')
def list_alerts():
    items = safe_query('alerta', '*')
    return jsonify({'items': items}), 200


@app.get('/api/relatorios')
def list_reports():
    return jsonify({
        'summary': {
            'produtos': len(safe_query('produto')),
            'alertas': len(safe_query('alerta')),
            'estoque_baixo': 0,
            'validade_proxima': 0
        },
        'items': []
    })


@app.route('/api/<path:route>', methods=['OPTIONS'])
def handle_options(route):
    return '', 204


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
