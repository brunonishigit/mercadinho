// Modelo de tipos compartilhados para integração com o backend Python.
// Substituir por interfaces/TypeScript ou validações reais quando a API estiver definida.

export const API_ENDPOINTS = {
  products: '/api/produtos',
  movements: '/api/movimentacoes',
  alerts: '/api/alertas',
  reports: '/api/relatorios',
  auth: '/api/auth'
};

export const EMPTY_STATE = {
  loading: 'Carregando dados...',
  error: 'Não foi possível carregar as informações no momento.',
  empty: 'Nenhum registro encontrado.'
};

// TODO: integrar com Python e Supabase.
// - validar autenticação do usuário
// - mapear campos do banco PostgreSQL
// - aplicar regras FEFO e estoque mínimo no backend
// - gerar alertas ativos ao iniciar sessão ou ao registrar movimentações
