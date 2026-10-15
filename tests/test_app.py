import unittest

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
            'codigo_barras': '7890000000999',
            'unidade_medida': 'litro',
            'estoque_minimo': 5,
            'ativo': True
        }
        response = self.client.post('/api/produtos', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['ok'])
        self.assertIn('id_produto', response.get_json())

    def test_create_movement_for_entry_and_exit(self):
        product_response = self.client.post('/api/produtos', json={
            'nome': 'Arroz Teste Estoque',
            'id_categoria': 1,
            'codigo_barras': '7890000000888',
            'unidade_medida': 'kg',
            'estoque_minimo': 3,
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

        exit_response = self.client.post('/api/movimentacoes', json={
            'tipo': 'SAIDA',
            'id_produto': product_id,
            'quantidade': 2,
            'usuario': 'operador',
            'observacao': 'Saída de teste'
        })
        self.assertEqual(exit_response.status_code, 200)
        self.assertTrue(exit_response.get_json()['ok'])

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
