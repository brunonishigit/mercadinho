const PAGE_ORIGIN = window.location.origin;
const API_BASE_URL = PAGE_ORIGIN && PAGE_ORIGIN !== 'null'
  ? PAGE_ORIGIN
  : 'http://127.0.0.1:8000';
const TOKEN_STORAGE_KEY = 'mercadinho_token';
const USER_STORAGE_KEY = 'mercadinho_usuario';
const FORBIDDEN_MESSAGE = 'Você não tem permissão para acessar esta tela.';

export function getSessionUser() {
  const savedUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!savedUser) {
    return null;
  }

  try {
    const user = JSON.parse(savedUser);
    return user && typeof user === 'object' && !Array.isArray(user) ? user : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  if (typeof token !== 'string' || !token || !user || typeof user !== 'object') {
    throw new Error('Não foi possível salvar a sessão.');
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.removeItem('mercadinho_perfil');
}

export function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem('mercadinho_perfil');
}

export function isOwner(user = getSessionUser()) {
  return String(user?.perfil || '').trim().toUpperCase() === 'DONO';
}

function isApiRequest(url) {
  const baseUrl = new URL(API_BASE_URL);
  return url.origin === baseUrl.origin && url.pathname.startsWith('/api/');
}

async function apiFetch(input, options = {}) {
  const inputUrl = input instanceof Request ? input.url : String(input);
  const url = new URL(inputUrl, API_BASE_URL);
  const apiRequest = isApiRequest(url);
  const isLoginRequest = url.pathname === '/api/auth/login';
  const headers = new Headers(input instanceof Request ? input.headers : undefined);

  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (apiRequest && !isLoginRequest) {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(input, { ...options, headers });
  if (!apiRequest || isLoginRequest) {
    return response;
  }

  if (response.status === 401) {
    clearSession();
    window.location.replace(new URL('/index.html', API_BASE_URL).href);
    return response;
  }

  if (response.status === 403) {
    const payload = await response.clone().json();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('Content-Type', 'application/json');
    const method = String(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (method === 'GET') {
      if (typeof window.showToast === 'function') {
        window.showToast(FORBIDDEN_MESSAGE, 'warning', 4500);
      } else {
        window.alert(FORBIDDEN_MESSAGE);
      }
    }

    return new Response(JSON.stringify({ ...payload, message: FORBIDDEN_MESSAGE }), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
}

async function requestJson(url, options = {}) {
  const response = await apiFetch(url, options);
  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    return {
      ok: false,
      data: payload?.items || payload || [],
      message: response.status === 403
        ? FORBIDDEN_MESSAGE
        : payload?.message || 'Erro ao consultar a API.'
    };
  }

  return {
    ok: true,
    data: payload?.items ?? payload ?? [],
    message: payload?.message || 'Sucesso.'
  };
}

const apiClient = {
  fetch: apiFetch,

  async get(url) {
    return requestJson(url, { method: 'GET' });
  },

  async post(url, payload) {
    return requestJson(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async put(url, payload) {
    return requestJson(url, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async delete(url) {
    return requestJson(url, { method: 'DELETE' });
  }
};

export default apiClient;
