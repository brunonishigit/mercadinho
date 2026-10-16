import time
import unittest
import uuid

from app import app


class MercadinhoAppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_endpoint(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['status'], 'ok')

    def test_products_endpoint_returns_json(self):
        response = self.client.get('/api/produtos')
        self.assertEqual(response.status_code, 200)
        self.assertIn('items', response.get_json())

    def test_products_endpoint_runs_fast_enough(self):
        started_at = time.perf_counter()
        response = self.client.get('/api/produtos')
        elapsed = time.perf_counter() - started_at

        self.assertEqual(response.status_code, 200)
        self.assertLess(elapsed, 4.0)
        self.assertIn('items', response.get_json())

    def test_login_requires_registered_user(self):
        response = self.client.post('/api/auth/login', json={'usuario': 'naoexiste', 'senha': '123'})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()['ok'], False)

    def test_login_accepts_registered_user(self):
        response = self.client.post('/api/auth/login', json={'usuario': 'operador', 'senha': 'hash_teste'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['ok'], True)

    def test_create_product_with_valid_data(self):
        payload = {
            'nome': 'Leite Integral Teste',
            'id_categoria': 1,
            'codigo_barras': f'789{uuid.uuid4().int % 1000000000000:013d}',
            'unidade_medida': 'litro',
            'estoque_minimo': 5,
            'preco': 8.5,
            'ativo': True
        }
        response = self.client.post('/api/produtos', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['ok'])
        self.assertIn('id_produto', response.get_json())
        self.assertEqual(response.get_json()['preco'], '8.50')

    def test_create_movement_for_entry_and_exit(self):
        product_response = self.client.post('/api/produtos', json={
            'nome': 'Arroz Teste Estoque',
            'id_categoria': 1,
            'codigo_barras': f'789{uuid.uuid4().int % 1000000000000:013d}',
            'unidade_medida': 'kg',
            'estoque_minimo': 3,
            'preco': 10.5,
            'ativo': True
        })
        product_id = product_response.get_json()['id_produto']

        entry_response = self.client.post('/api/movimentacoes', json={
            'tipo': 'ENTRADA',
            'id_produto': product_id,
            'quantidade': 12,
            'usuario': 'operador',
            'id_fornecedor': 1,
            'data_entrada': '2026-10-15',
            'data_validade': '2026-11-30',
            'observacao': 'Entrada de teste'
        })
        self.assertEqual(entry_response.status_code, 200)
        self.assertTrue(entry_response.get_json()['ok'])
        self.assertEqual(entry_response.get_json()['valor_total'], '126.00')

        exit_response = self.client.post('/api/movimentacoes', json={
            'tipo': 'SAIDA',
            'id_produto': product_id,
            'quantidade': 2,
            'usuario': 'operador',
            'observacao': 'Saída de teste'
        })
        self.assertEqual(exit_response.status_code, 200)
        self.assertTrue(exit_response.get_json()['ok'])
        self.assertEqual(exit_response.get_json()['valor_total'], '21.00')

    def test_edit_product_updates_and_keeps_price(self):
        product_response = self.client.post('/api/produtos', json={
            'nome': 'Produto para editar',
            'id_categoria': 1,
            'codigo_barras': f'789{uuid.uuid4().int % 1000000000000:013d}',
            'unidade_medida': 'caixa',
            'estoque_minimo': 2,
            'preco': 4.5,
            'ativo': True
        })
        product_id = product_response.get_json()['id_produto']

        response = self.client.put(f'/api/produtos/{product_id}', json={
            'nome': 'Produto para editar atualizado',
            'id_categoria': 1,
            'codigo_barras': f'789{uuid.uuid4().int % 1000000000000:013d}',
            'unidade_medida': 'caixa',
            'estoque_minimo': 3,
            'preco': 9.99,
            'ativo': True
        })

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['ok'])
        self.assertEqual(response.get_json()['preco'], '9.99')
        self.assertEqual(response.get_json()['nome'], 'Produto para editar atualizado')

    def test_register_user_creates_account_and_allows_login(self):
        unique = uuid.uuid4().hex[:8]
        payload = {
            'nome': 'Usuário Cadastro Teste',
            'tipo': 'FUNCIONARIO',
            'login': f'cadastro_{unique}',
            'senha': 'senha_teste_123'
        }

        response = self.client.post('/api/auth/register', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['ok'])
        self.assertEqual(response.get_json()['usuario'], payload['login'])

        login_response = self.client.post('/api/auth/login', json={
            'usuario': payload['login'],
            'senha': payload['senha']
        })
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.get_json()['ok'])

    def test_create_and_edit_supplier(self):
        email = f'teste_{uuid.uuid4()}@fornecedor.com'
        response = self.client.post('/api/fornecedores', json={
            'nome': 'Fornecedor Teste XYZ',
            'telefone': '(11) 99999-0000',
            'email': email,
            'ativo': True
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['ok'])
        supplier_id = response.get_json()['id_fornecedor']

        updated_email = f'novo_{uuid.uuid4()}@fornecedor.com'
        edit_response = self.client.put(f'/api/fornecedores/{supplier_id}', json={
            'nome': 'Fornecedor Teste XYZ Atualizado',
            'telefone': '(11) 98888-1111',
            'email': updated_email,
            'ativo': False
        })
        self.assertEqual(edit_response.status_code, 200)
        self.assertTrue(edit_response.get_json()['ok'])
        self.assertEqual(edit_response.get_json()['nome'], 'Fornecedor Teste XYZ Atualizado')
        self.assertEqual(edit_response.get_json()['ativo'], False)

    def test_delete_movement_removes_record(self):
        product_response = self.client.post('/api/produtos', json={
            'nome': 'Produto para excluir movimentação',
            'id_categoria': 1,
            'codigo_barras': f'789{uuid.uuid4().int % 1000000000000:013d}',
            'unidade_medida': 'cx',
            'estoque_minimo': 1,
            'preco': 5.5,
            'ativo': True
        })
        product_id = product_response.get_json()['id_produto']

        entry_response = self.client.post('/api/movimentacoes', json={
            'tipo': 'ENTRADA',
            'id_produto': product_id,
            'quantidade': 5,
            'usuario': 'operador',
            'id_fornecedor': 1,
            'data_entrada': '2026-10-15',
            'data_validade': '2026-11-30',
            'observacao': 'Entrada para testar exclusão'
        })
        movimentacao_id = entry_response.get_json()['id_movimentacao']

        delete_response = self.client.delete(f'/api/movimentacoes/{movimentacao_id}')
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.get_json()['ok'])

    def test_exit_cannot_exceed_stock(self):
        response = self.client.post('/api/movimentacoes', json={
            'tipo': 'SAIDA',
            'id_produto': 1,
            'quantidade': 999999,
            'usuario': 'operador',
            'observacao': 'Estoque insuficiente'
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()['ok'], False)


if __name__ == '__main__':
    unittest.main()
