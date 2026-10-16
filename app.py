import os
from decimal import Decimal, InvalidOperation
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')


@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/login')
def serve_login_alias():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/cadastro')
def serve_cadastro_alias():
    return send_from_directory(app.static_folder, 'cadastro.html')


@app.route('/painel')
def serve_painel_alias():
    return send_from_directory(app.static_folder, 'painel.html')


@app.route('/produtos')
def serve_produtos_alias():
    return send_from_directory(app.static_folder, 'produtos.html')


@app.route('/entradas')
def serve_entradas_alias():
    return send_from_directory(app.static_folder, 'entradas.html')


@app.route('/saidas')
def serve_saidas_alias():
    return send_from_directory(app.static_folder, 'saidas.html')


@app.route('/relatorios')
def serve_relatorios_alias():
    return send_from_directory(app.static_folder, 'relatorios.html')


@app.route('/caixa')
def serve_caixa_alias():
    return send_from_directory(app.static_folder, 'caixa.html')


@app.route('/fornecedores')
def serve_fornecedores_alias():
    return send_from_directory(app.static_folder, 'fornecedores.html')


@app.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith('api/'):
        return '', 404
    return send_from_directory(app.static_folder, filename)


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


def get_product_map():
    products = safe_query('produto', '*')
    lookup = {}
    for product in products:
        product_id = product.get('id_produto')
        if product_id is None:
            continue
        lookup[int(product_id)] = product
    return lookup


def get_product_by_id(product_id):
    if product_id in (None, ''):
        return None

    products = safe_query('produto', '*', id_produto=int(product_id))
    return products[0] if products else None


def get_product_price(product_id):
    product = get_product_by_id(product_id)
    if not product:
        return Decimal('0')

    try:
        return parse_decimal(product.get('preco', 0))
    except ValueError:
        return Decimal('0')


def decimal_money(value):
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def build_product_alerts():
    alerts = []
    products = safe_query('produto', '*')
    product_map = {int(product.get('id_produto')): product for product in products if product.get('id_produto') is not None}
    stock_map = get_stock_map()

    for product in products:
        product_id = product.get('id_produto')
        if product_id is None:
            continue

        try:
            stock = stock_map.get(int(product_id), Decimal('0'))
            minimum = parse_decimal(product.get('estoque_minimo', 0))
        except ValueError:
            continue

        if stock <= minimum:
            alerts.append({
                'id_produto': product_id,
                'tipo': 'ESTOQUE_BAIXO',
                'mensagem': f"Produto {product.get('nome', 'Sem nome')} com estoque abaixo do mínimo.",
                'produto': product.get('nome', 'Sem nome'),
                'quantidade': str(stock),
                'estoque_minimo': str(minimum)
            })

    lots = safe_query('lote', '*')
    for lot in lots:
        quantity = lot.get('quantidade', 0)
        validity = lot.get('data_validade')
        if quantity in (None, '') or validity in (None, ''):
            continue

        try:
            if parse_decimal(quantity) <= 0:
                continue
        except ValueError:
            continue

        try:
            expiry = datetime.strptime(str(validity), '%Y-%m-%d').date()
        except ValueError:
            continue

        days_to_expiry = (expiry - datetime.utcnow().date()).days
        if 0 <= days_to_expiry <= 30:
            product = product_map.get(int(lot.get('id_produto')))
            alerts.append({
                'id_lote': lot.get('id_lote'),
                'id_produto': lot.get('id_produto'),
                'tipo': 'VALIDADE_PROXIMA',
                'mensagem': f"Lote de {product.get('nome', 'Produto') if product else 'Produto'} vence em {days_to_expiry} dias.",
                'produto': product.get('nome', 'Produto') if product else 'Produto',
                'quantidade': str(quantity),
                'validade': str(validity)
            })

    return alerts


def get_category_map():
    categories = safe_query('categoria', '*')
    lookup = {}
    for category in categories:
        category_id = category.get('id_categoria')
        if category_id is None:
            continue
        lookup[int(category_id)] = category
    return lookup


def get_category_name(category_id):
    if category_id in (None, ''):
        return 'Sem categoria'

    category = get_category_map().get(int(category_id))
    if category:
        return category.get('nome', 'Sem categoria')
    return 'Sem categoria'


def get_price_map():
    price_map = {}
    products = safe_query('produto', '*')

    for product in products:
        product_id = product.get('id_produto')
        if product_id is None:
            continue

        try:
            price_map[int(product_id)] = parse_decimal(product.get('preco', 0))
        except ValueError:
            price_map[int(product_id)] = Decimal('0')

    return price_map


def get_stock_map():
    totals = {}
    lots = safe_query('lote', '*')

    for lot in lots:
        product_id = lot.get('id_produto')
        if product_id is None:
            continue

        try:
            quantidade = parse_decimal(lot.get('quantidade', 0))
        except ValueError:
            continue

        key = int(product_id)
        totals[key] = totals.get(key, Decimal('0')) + quantidade

    return totals


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


@app.post('/api/auth/register')
def register_user():
    payload = request.get_json(silent=True) or {}
    nome = str(payload.get('nome', '')).strip()
    tipo = str(payload.get('tipo', 'FUNCIONARIO')).strip().upper()
    login_name = str(payload.get('login', '')).strip()
    senha = str(payload.get('senha', '')).strip()

    if not nome or not login_name or not senha:
        return jsonify({'ok': False, 'message': 'Nome, usuário e senha são obrigatórios.'}), 400

    if tipo not in {'DONO', 'FUNCIONARIO'}:
        tipo = 'FUNCIONARIO'

    if get_user_by_login(login_name):
        return jsonify({'ok': False, 'message': 'Este usuário já existe.'}), 409

    if not supabase:
        return jsonify({'ok': False, 'message': 'Banco não configurado.'}), 503

    created = safe_insert('usuario', {
        'nome': nome,
        'login': login_name,
        'senha': senha,
        'tipo': tipo,
        'ativo': True
    })

    if created is None:
        return jsonify({'ok': False, 'message': 'Não foi possível criar o usuário no banco.'}), 500

    return jsonify({
        'ok': True,
        'message': 'Usuário criado com sucesso.',
        'usuario': str(created.get('login') or login_name),
        'perfil': str(created.get('tipo') or tipo)
    }), 200


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
    ordered = sorted(items, key=lambda x: str(x.get('nome') or '').lower())
    return jsonify({'items': ordered}), 200


@app.post('/api/fornecedores')
def create_supplier():
    payload = request.get_json(silent=True) or {}
    nome = str(payload.get('nome', '')).strip()
    telefone = str(payload.get('telefone') or '').strip()
    email = str(payload.get('email') or '').strip()

    if not nome:
        return jsonify({'ok': False, 'message': 'Nome do fornecedor é obrigatório.'}), 400

    if email:
        existing = safe_query('fornecedor', '*', email=email)
        if existing:
            return jsonify({'ok': False, 'message': 'E-mail já cadastrado para outro fornecedor.'}), 409

    supplier_payload = {
        'nome': nome,
        'telefone': telefone or None,
        'email': email or None,
        'ativo': bool(payload.get('ativo', True))
    }

    created = safe_insert('fornecedor', supplier_payload)
    if created is None:
        return jsonify({'ok': False, 'message': 'Não foi possível cadastrar o fornecedor.'}), 500

    return jsonify({
        'ok': True,
        'message': 'Fornecedor cadastrado com sucesso.',
        'id_fornecedor': created.get('id_fornecedor'),
        'nome': str(created.get('nome') or nome),
        'ativo': bool(created.get('ativo', True))
    }), 200


@app.put('/api/fornecedores/<int:supplier_id>')
def update_supplier(supplier_id):
    existing = safe_query('fornecedor', '*', id_fornecedor=supplier_id)
    if not existing:
        return jsonify({'ok': False, 'message': 'Fornecedor não encontrado.'}), 404

    payload = request.get_json(silent=True) or {}
    nome = str(payload.get('nome', existing[0].get('nome', ''))).strip()
    if not nome:
        return jsonify({'ok': False, 'message': 'Nome do fornecedor é obrigatório.'}), 400

    telefone = str(payload.get('telefone') if payload.get('telefone') is not None else existing[0].get('telefone') or '').strip()
    email = str(payload.get('email') if payload.get('email') is not None else existing[0].get('email') or '').strip()

    if email:
        duplicate = safe_query('fornecedor', '*', email=email)
        if duplicate and duplicate[0].get('id_fornecedor') != supplier_id:
            return jsonify({'ok': False, 'message': 'E-mail já cadastrado para outro fornecedor.'}), 409

    update_payload = {
        'nome': nome,
        'telefone': telefone or None,
        'email': email or None,
        'ativo': bool(payload.get('ativo', existing[0].get('ativo', True)))
    }

    try:
        response = supabase.table('fornecedor').update(update_payload).eq('id_fornecedor', supplier_id).execute()
        updated = (response.data or [{}])[0] if response.data else {**existing[0], **update_payload}
    except Exception:
        return jsonify({'ok': False, 'message': 'Não foi possível atualizar o fornecedor.'}), 500

    return jsonify({
        'ok': True,
        'message': 'Fornecedor atualizado com sucesso.',
        'id_fornecedor': supplier_id,
        'nome': str(updated.get('nome') or nome),
        'ativo': bool(updated.get('ativo', True))
    }), 200


@app.get('/api/produtos')
def list_products():
    items = safe_query('produto', '*')
    search = str(request.args.get('search') or '').strip().lower()

    if search:
        filtered = []
        for item in items:
            nome = str(item.get('nome') or '').lower()
            codigo = str(item.get('codigo_barras') or '').lower()
            id_texto = str(item.get('id_produto') or '').lower()
            if search in nome or search in codigo or search in id_texto:
                filtered.append(item)
        items = filtered

    categories = get_category_map()
    stock_map = get_stock_map()
    price_map = get_price_map()
    enriched = []

    for item in items:
        product_id = item.get('id_produto')
        if product_id is None:
            continue

        product_key = int(product_id)
        item_copy = dict(item)
        category_id = item_copy.get('id_categoria')
        item_copy['categoria'] = categories.get(int(category_id), {}).get('nome', 'Sem categoria') if category_id not in (None, '') else 'Sem categoria'

        try:
            item_copy['estoque_atual'] = str(stock_map.get(product_key, Decimal('0')))
        except Exception:
            item_copy['estoque_atual'] = '0'

        try:
            item_copy['preco'] = str(decimal_money(price_map.get(product_key, Decimal('0'))))
        except Exception:
            item_copy['preco'] = '0.00'
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
        preco = parse_decimal(payload.get('preco', 0))
    except ValueError:
        return jsonify({'ok': False, 'message': 'Estoque mínimo ou preço inválido.'}), 400

    product_payload = {
        'id_categoria': int(categoria_id),
        'nome': nome,
        'codigo_barras': codigo_barras,
        'unidade_medida': unidade,
        'estoque_minimo': str(estoque_minimo),
        'preco': str(decimal_money(preco)),
        'ativo': bool(payload.get('ativo', True))
    }

    created = safe_insert('produto', product_payload)
    if created is None:
        return jsonify({'ok': False, 'message': 'Não foi possível cadastrar o produto.'}), 500

    payload_response = {'ok': True, 'message': 'Produto cadastrado com sucesso.', 'id_produto': created.get('id_produto'), 'preco': str(decimal_money(created.get('preco', preco))), 'nome': nome}
    return jsonify(payload_response), 200


@app.put('/api/produtos/<int:product_id>')
def update_product(product_id):
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'ok': False, 'message': 'Produto não encontrado.'}), 404

    payload = request.get_json(silent=True) or {}
    nome = str(payload.get('nome', product.get('nome', ''))).strip()
    categoria_id = payload.get('id_categoria', product.get('id_categoria'))
    unidade = str(payload.get('unidade_medida') or product.get('unidade_medida') or '').strip()

    if not nome or not categoria_id or not unidade:
        return jsonify({'ok': False, 'message': 'Nome, categoria e unidade são obrigatórios.'}), 400

    codigo_barras = str(payload.get('codigo_barras') or product.get('codigo_barras') or '').strip() or None
    if codigo_barras:
        existing = safe_query('produto', '*', codigo_barras=codigo_barras)
        if existing and existing[0].get('id_produto') != product_id:
            return jsonify({'ok': False, 'message': 'Código de barras já cadastrado.'}), 409

    try:
        estoque_minimo = parse_decimal(payload.get('estoque_minimo', product.get('estoque_minimo', 0)))
        preco = parse_decimal(payload.get('preco', product.get('preco', 0)))
    except ValueError:
        return jsonify({'ok': False, 'message': 'Estoque mínimo ou preço inválido.'}), 400

    update_payload = {
        'id_categoria': int(categoria_id),
        'nome': nome,
        'codigo_barras': codigo_barras,
        'unidade_medida': unidade,
        'estoque_minimo': str(estoque_minimo),
        'preco': str(decimal_money(preco)),
        'ativo': bool(payload.get('ativo', product.get('ativo', True)))
    }

    try:
        response = supabase.table('produto').update(update_payload).eq('id_produto', product_id).execute()
        updated = (response.data or [{}])[0] if response.data else {**product, **update_payload}
    except Exception:
        return jsonify({'ok': False, 'message': 'Não foi possível atualizar o produto.'}), 500

    return jsonify({
        'ok': True,
        'message': 'Produto atualizado com sucesso.',
        'id_produto': product_id,
        'nome': str(updated.get('nome') or nome),
        'preco': str(decimal_money(updated.get('preco', preco)))
    }), 200


@app.get('/api/movimentacoes')
def list_movements():
    items = safe_query('movimentacao', '*')
    enriched = []

    for item in items:
        item_copy = dict(item)
        product = get_product_by_id(item_copy.get('id_produto'))
        item_copy['produto'] = product.get('nome', 'Produto') if product else 'Produto'
        item_copy['categoria'] = get_category_name(product.get('id_categoria')) if product else 'Sem categoria'

        try:
            quantidade = parse_decimal(item_copy.get('quantidade', 0))
            valor_unitario = get_product_price(item_copy.get('id_produto'))
            total = decimal_money(quantidade * valor_unitario)
            item_copy['valor_unitario'] = str(decimal_money(valor_unitario))
            item_copy['valor_total'] = str(total)
        except Exception:
            item_copy['valor_unitario'] = '0.00'
            item_copy['valor_total'] = '0.00'

        enriched.append(item_copy)

    return jsonify({'items': enriched}), 200


@app.delete('/api/movimentacoes/<int:movement_id>')
def delete_movement(movement_id):
    if not supabase:
        return jsonify({'ok': False, 'message': 'Banco não configurado.'}), 503

    movement = safe_query('movimentacao', '*', id_movimentacao=movement_id)
    if not movement:
        return jsonify({'ok': False, 'message': 'Movimentação não encontrada.'}), 404

    try:
        response = supabase.table('movimentacao').delete().eq('id_movimentacao', movement_id).execute()
        if response.data is not None:
            return jsonify({'ok': True, 'message': 'Movimentação excluída com sucesso.'}), 200
    except Exception:
        return jsonify({'ok': False, 'message': 'Não foi possível excluir a movimentação.'}), 500

    return jsonify({'ok': True, 'message': 'Movimentação excluída com sucesso.'}), 200


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

    valor_unitario = get_product_price(product_id)
    valor_total = decimal_money(quantidade * valor_unitario)

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
            'valor_total': str(valor_total),
            'valor_unitario': str(decimal_money(valor_unitario)),
            'data_movimentacao': datetime.utcnow().isoformat(timespec='seconds'),
            'observacao': str(payload.get('observacao') or '')
        })

        return jsonify({'ok': True, 'message': 'Entrada registrada com sucesso.', 'id_lote': lote.get('id_lote'), 'id_movimentacao': movimentacao.get('id_movimentacao') if movimentacao else None, 'valor_total': str(valor_total)}), 200

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
            'valor_total': str(valor_total),
            'valor_unitario': str(decimal_money(valor_unitario)),
            'data_movimentacao': datetime.utcnow().isoformat(timespec='seconds'),
            'observacao': str(payload.get('observacao') or '')
        })

        return jsonify({'ok': True, 'message': 'Saída registrada com sucesso.', 'id_lote': lot_id, 'id_movimentacao': movimentacao.get('id_movimentacao') if movimentacao else None, 'valor_total': str(valor_total)}), 200

    return jsonify({'ok': False, 'message': 'Tipo de movimentação inválido.'}), 400


@app.get('/api/lotes')
def list_lots():
    items = safe_query('lote', '*')
    product_map = get_product_map()
    enriched = []

    for item in items:
        item_copy = dict(item)
        product_id = item_copy.get('id_produto')
        product = product_map.get(int(product_id)) if product_id not in (None, '') else None
        item_copy['produto'] = product.get('nome', 'Produto') if product else 'Produto'
        enriched.append(item_copy)

    return jsonify({'items': enriched}), 200


@app.get('/api/alertas')
def list_alerts():
    generated = build_product_alerts()
    return jsonify({'items': generated}), 200


@app.get('/api/relatorios')
def list_reports():
    alerts = build_product_alerts()
    products = safe_query('produto', '*')
    stock_map = get_stock_map()
    low_stock_count = 0
    near_expiry_count = 0

    for product in products:
        product_id = product.get('id_produto')
        if product_id is None:
            continue
        try:
            stock = stock_map.get(int(product_id), Decimal('0'))
            minimum = parse_decimal(product.get('estoque_minimo', 0))
            if stock <= minimum:
                low_stock_count += 1
        except ValueError:
            continue

    for alert in alerts:
        if alert.get('tipo') == 'VALIDADE_PROXIMA':
            near_expiry_count += 1

    return jsonify({
        'summary': {
            'produtos': len(products),
            'alertas': len(alerts),
            'estoque_baixo': low_stock_count,
            'validade_proxima': near_expiry_count
        },
        'items': alerts
    })


@app.route('/api/<path:route>', methods=['OPTIONS'])
def handle_options(route):
    return '', 204


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000, debug=False, use_reloader=False)
