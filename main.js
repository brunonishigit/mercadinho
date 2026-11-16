const passwordInput = document.getElementById('login-password');
const toggleButtons = document.querySelectorAll('[data-password-toggle]');
const loginForm = document.querySelector('.login-form');
const forgotPasswordLink = document.querySelector('.forgot-password');
const API_BASE = window.location.origin || 'http://127.0.0.1:8000';

const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Resposta inválida da API. Verifique se o servidor está rodando na porta correta.');
  }
};

const loginToSystem = async (usuario, senha) => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ usuario, senha })
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível entrar no sistema.');
    }

    localStorage.setItem('mercadinho_usuario', data.usuario || usuario);
    localStorage.setItem('mercadinho_perfil', data.perfil || 'FUNCIONARIO');
    window.location.href = 'painel.html';
  } catch (error) {
    window.alert(error.message || 'Erro ao autenticar.');
  }
};

toggleButtons.forEach((toggleButton) => {
  const eyeOffIcon = toggleButton.querySelector('[data-eye-off]');
  const eyeIcon = toggleButton.querySelector('[data-eye]');

  toggleButton.addEventListener('click', () => {
    const fieldShell = toggleButton.closest('.field-shell');
    const targetInput = fieldShell?.querySelector('input');

    if (!targetInput) {
      return;
    }

    const isPassword = targetInput.type === 'password';
    targetInput.type = isPassword ? 'text' : 'password';

    eyeOffIcon?.classList.toggle('is-hidden', !isPassword);
    eyeIcon?.classList.toggle('is-hidden', isPassword);
    toggleButton.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
  });
});

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const usuario = document.getElementById('login-user')?.value?.trim() || '';
  const senha = document.getElementById('login-password')?.value?.trim() || '';

  if (!usuario || !senha) {
    window.alert('Informe usuário e senha para continuar.');
    return;
  }

  loginToSystem(usuario, senha);
});

forgotPasswordLink?.addEventListener('click', (event) => {
  event.preventDefault();
});
