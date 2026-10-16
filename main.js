const passwordInput = document.getElementById('login-password');
const toggleButtons = document.querySelectorAll('[data-password-toggle]');
const loginForm = document.querySelector('.login-form');
const forgotPasswordLink = document.querySelector('.forgot-password');
const registerForm = document.getElementById('register-form');
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

const registerUser = async (payload) => {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'Não foi possível cadastrar o usuário.');
  }

  return data;
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

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nome = document.getElementById('register-name')?.value?.trim() || '';
  const tipo = document.getElementById('register-role')?.value || '';
  const login = document.getElementById('register-user')?.value?.trim() || '';
  const senha = document.getElementById('register-password')?.value || '';
  const confirmarSenha = document.getElementById('register-password-confirm')?.value || '';

  if (!nome || !tipo || !login || !senha || !confirmarSenha) {
    window.alert('Preencha todos os campos para concluir o cadastro.');
    return;
  }

  if (senha !== confirmarSenha) {
    window.alert('As senhas digitadas não conferem.');
    return;
  }

  try {
    await registerUser({ nome, tipo, login, senha });
    if (typeof showToast === 'function') {
      showToast('Cadastro realizado com sucesso! Redirecionando para o login.', 'success', 2400);
    } else {
      window.alert('Cadastro realizado com sucesso!');
    }

    setTimeout(() => {
      window.location.href = 'index.html?cadastro_sucesso=1';
    }, 1500);
  } catch (error) {
    window.alert(error.message || 'Não foi possível concluir o cadastro.');
  }
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

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('cadastro_sucesso') === '1') {
  if (typeof showToast === 'function') {
    showToast('Usuário cadastrado com sucesso! Faça login com sua nova credencial.', 'success', 3000);
  }
}

forgotPasswordLink?.addEventListener('click', (event) => {
  event.preventDefault();
});
