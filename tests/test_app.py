import time
import unittest
import uuid
from unittest.mock import patch

import app as app_module
from app import app
from itsdangerous import URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash


class MercadinhoAppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.original_secret_key = app.config.get('SECRET_KEY')
        app.config['SECRET_KEY'] = 'test-only-secret-key'

        self.original_safe_query = app_module.safe_query
        users = self.original_safe_query('usuario', '*')
        active_user = next((user for user in users if bool(user.get('ativo'))), None)
        if active_user is None:
            self.fail('Os testes integrados precisam de ao menos um usuário ativo no Supabase.')

        self.test_user = {
            **active_user,
            'tipo': 'DONO',
            'permissoes': ['painel', 'caixa', 'produtos', 'entradas', 'saidas', 'relatorios', 'fornecedores']
        }

        def safe_query_with_test_user(table_name, select='*', **kwargs):
            if table_name == 'usuario' and kwargs.get('id_usuario') == self.test_user['id_usuario']:
                return [self.test_user]
            return self.original_safe_query(table_name, select, **kwargs)

        self.user_query_patcher = patch('app.safe_query', side_effect=safe_query_with_test_user)
        self.user_query_patcher.start()

        serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'], salt='mercadinho-auth')
        token = serializer.dumps({'id_usuario': self.test_user['id_usuario']})
        self.client.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {token}'

    def tearDown(self):
        self.user_query_patcher.stop()
        app.config['SECRET_KEY'] = self.original_secret_key

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

    def test_login_migrates_legacy_password_to_hash(self):
        user = {
            'id_usuario': 42,
            'login': 'operador_legado',
            'tipo': 'FUNCIONARIO',
            'ativo': True,
            'senha': 'senha_antiga'
        }

        with patch('app.supabase', object()), \
                patch('app.get_user_by_login', return_value=user), \
                patch('app.save_user_password_hash', return_value=True) as save_password:
            response = self.client.post('/api/auth/login', json={
                'usuario': 'operador_legado',
                'senha': 'senha_antiga'
            })

        self.assertEqual(response.status_code, 200)
        saved_hash = save_password.call_args[0][1]
        self.assertNotEqual(saved_hash, 'senha_antiga')
        self.assertTrue(check_password_hash(saved_hash, 'senha_antiga'))

    def test_login_accepts_hashed_password(self):
        user = {
            'id_usuario': 42,
            'login': 'operador_hash',
            'tipo': 'FUNCIONARIO',
            'ativo': True,
            'senha': generate_password_hash('senha_segura')
        }

        with patch('app.supabase', object()), \
                patch('app.get_user_by_login', return_value=user):
            response = self.client.post('/api/auth/login', json={
                'usuario': 'operador_hash',
                'senha': 'senha_segura'
            })

        self.assertEqual(response.status_code, 200)

    def test_login_rejects_malformed_password_hash(self):
        user = {
            'id_usuario': 42,
            'login': 'operador_hash_invalido',
            'tipo': 'FUNCIONARIO',
            'ativo': True,
            'senha': 'scrypt:invalido'
        }

        with patch('app.supabase', object()), \
                patch('app.get_user_by_login', return_value=user):
            response = self.client.post('/api/auth/login', json={
                'usuario': 'operador_hash_invalido',
                'senha': 'senha'
            })

        self.assertEqual(response.status_code, 401)

    def test_login_does_not_succeed_when_legacy_password_migration_fails(self):
        user = {
            'id_usuario': 42,
            'login': 'operador_legado',
            'tipo': 'FUNCIONARIO',
            'ativo': True,
            'senha': 'senha_antiga'
        }

        with patch('app.supabase', object()), \
                patch('app.get_user_by_login', return_value=user), \
                patch('app.save_user_password_hash', return_value=False):
            response = self.client.post('/api/auth/login', json={
                'usuario': 'operador_legado',
                'senha': 'senha_antiga'
            })

        self.assertEqual(response.status_code, 500)

    def test_register_stores_password_as_hash(self):
        payload = {
            'nome': 'Usuário Cadastro Teste',
            'tipo': 'FUNCIONARIO',
            'login': 'cadastro_hash_teste',
            'senha': 'senha_teste_123'
        }

        with patch('app.supabase', object()), \
                patch('app.get_user_by_login', return_value=None), \
                patch('app.safe_insert', return_value={
                    'login': payload['login'],
                    'tipo': payload['tipo']
                }) as insert_user:
            response = self.client.post('/api/auth/register', json=payload)

        self.assertEqual(response.status_code, 200)
        saved_password = insert_user.call_args[0][1]['senha']
        self.assertNotEqual(saved_password, payload['senha'])
        self.assertTrue(check_password_hash(saved_password, payload['senha']))

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


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.original_secret_key = app.config.get('SECRET_KEY')
        app.config['SECRET_KEY'] = 'test-only-secret-key'
        self.user = {
            'id_usuario': 987654,
            'login': 'teste_token',
            'tipo': 'FUNCIONARIO',
            'ativo': True,
            'permissoes': ['entradas']
        }

        def safe_query_with_test_user(table_name, select='*', **kwargs):
            if table_name == 'usuario' and kwargs.get('id_usuario') == self.user['id_usuario']:
                return [dict(self.user)]
            if table_name == 'movimentacao':
                return [
                    {'tipo': 'ENTRADA', 'id_produto': 1, 'quantidade': '1'},
                    {'tipo': 'SAIDA', 'id_produto': 1, 'quantidade': '1'},
                    {'tipo': 'AJUSTE', 'id_produto': 1, 'quantidade': '1'}
                ]
            return []

        self.safe_query_patcher = patch('app.safe_query', side_effect=safe_query_with_test_user)
        self.safe_query_patcher.start()
        self.serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'], salt='mercadinho-auth')
        self.token = self.serializer.dumps({'id_usuario': self.user['id_usuario']})

    def tearDown(self):
        self.safe_query_patcher.stop()
        app.config['SECRET_KEY'] = self.original_secret_key

    def _headers(self, token=None):
        if token is None:
            token = self.token
        return {'Authorization': f'Bearer {token}'}

    def test_protected_route_returns_401_without_or_with_invalid_token(self):
        missing_token = self.client.get('/api/produtos')
        invalid_token = self.client.get('/api/produtos', headers=self._headers('inválido'))

        self.assertEqual(missing_token.status_code, 401)
        self.assertEqual(invalid_token.status_code, 401)

    def test_protected_route_returns_401_for_inactive_user(self):
        self.user['ativo'] = False

        response = self.client.get('/api/produtos', headers=self._headers())

        self.assertEqual(response.status_code, 401)

    def test_expired_token_returns_401(self):
        with patch('itsdangerous.timed.time.time', return_value=1000):
            token = self.serializer.dumps({'id_usuario': self.user['id_usuario']})
        with patch('itsdangerous.timed.time.time', return_value=1000 + 8 * 60 * 60 + 1):
            response = self.client.get('/api/produtos', headers=self._headers(token))

        self.assertEqual(response.status_code, 401)

    def test_missing_screen_permission_returns_expected_403_json(self):
        response = self.client.get('/api/relatorios', headers=self._headers())

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json(), {'ok': False, 'erro': 'Sem permissão'})

    def test_employee_cannot_register_users(self):
        response = self.client.post('/api/auth/register', json={}, headers=self._headers())

        self.assertEqual(response.status_code, 403)

    def test_owner_bypasses_screen_permissions(self):
        self.user['tipo'] = 'DONO'

        response = self.client.get('/api/relatorios', headers=self._headers())

        self.assertEqual(response.status_code, 200)

    def test_panel_permission_can_read_products_used_by_panel(self):
        self.user['permissoes'] = ['painel']

        response = self.client.get('/api/produtos', headers=self._headers())

        self.assertEqual(response.status_code, 200)

    def test_reports_permission_can_read_products_and_lots_used_by_reports(self):
        self.user['permissoes'] = ['relatorios']

        products_response = self.client.get('/api/produtos', headers=self._headers())
        lots_response = self.client.get('/api/lotes', headers=self._headers())

        self.assertEqual(products_response.status_code, 200)
        self.assertEqual(lots_response.status_code, 200)

    def test_movement_list_returns_only_permitted_types(self):
        response = self.client.get('/api/movimentacoes', headers=self._headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item['tipo'] for item in response.get_json()['items']],
            ['ENTRADA']
        )

    def test_invalid_movement_type_returns_400_before_permission_check(self):
        response = self.client.post('/api/movimentacoes', json={
            'tipo': 'INVALIDO',
            'id_produto': 1
        }, headers=self._headers())

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()['message'], 'Tipo de movimentação inválido.')

    def test_entry_permission_cannot_submit_exit(self):
        response = self.client.post('/api/movimentacoes', json={
            'tipo': 'SAIDA',
            'id_produto': 1
        }, headers=self._headers())

        self.assertEqual(response.status_code, 403)

    def test_cash_permission_can_submit_exit(self):
        self.user['permissoes'] = ['caixa']
        with patch('app.get_product_by_id', return_value=None):
            response = self.client.post('/api/movimentacoes', json={
                'tipo': 'SAIDA',
                'id_produto': 999
            }, headers=self._headers())

        self.assertEqual(response.status_code, 404)

    def test_movement_uses_authenticated_user_instead_of_payload(self):
        self.user['permissoes'] = ['entradas']
        with patch('app.get_product_by_id', return_value={'id_produto': 1}), \
                patch('app.get_product_price', return_value=1), \
                patch('app.safe_insert', side_effect=[
                    {'id_lote': 12},
                    {'id_movimentacao': 34}
                ]) as insert:
            response = self.client.post('/api/movimentacoes', json={
                'tipo': 'ENTRADA',
                'id_produto': 1,
                'id_fornecedor': 1,
                'quantidade': 2,
                'usuario': 'outro_usuario'
            }, headers=self._headers())

        self.assertEqual(response.status_code, 200)
        saved_movement = insert.call_args_list[1][0][1]
        self.assertEqual(saved_movement['id_usuario'], self.user['id_usuario'])

    def test_employee_cannot_delete_movements(self):
        response = self.client.delete('/api/movimentacoes/1', headers=self._headers())

        self.assertEqual(response.status_code, 403)

    def test_options_preflight_is_public_and_includes_auth_headers(self):
        response = self.client.options('/api/produtos')

        self.assertEqual(response.status_code, 204)
        self.assertIn('Authorization', response.headers['Access-Control-Allow-Headers'])
        self.assertEqual(
            response.headers['Access-Control-Allow-Methods'],
            'GET, POST, PUT, DELETE, OPTIONS'
        )

    def test_login_returns_signed_token_and_permissions(self):
        user = {
            'id_usuario': 123,
            'login': 'teste_login',
            'tipo': 'FUNCIONARIO',
            'ativo': True,
            'permissoes': ['painel', 'entradas'],
            'senha': generate_password_hash('senha_correta')
        }
        with patch('app.supabase', object()), \
                patch('app.get_user_by_login', return_value=user):
            response = self.client.post('/api/auth/login', json={
                'usuario': 'teste_login',
                'senha': 'senha_correta'
            })

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['permissoes'], user['permissoes'])
        self.assertEqual(
            self.serializer.loads(payload['token'], max_age=8 * 60 * 60),
            {'id_usuario': user['id_usuario']}
        )


if __name__ == '__main__':
    unittest.main()
