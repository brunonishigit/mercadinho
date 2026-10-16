const API_BASE_URL = window.location.origin || 'http://127.0.0.1:8000';

async function requestJson(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    return {
      ok: false,
      data: payload?.items || payload || [],
      message: payload?.message || 'Erro ao consultar a API.'
    };
  }

  return {
    ok: true,
    data: payload?.items ?? payload ?? [],
    message: payload?.message || 'Sucesso.'
  };
}

const apiClient = {
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
