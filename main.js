const passwordInput = document.getElementById('login-password');
const toggleButton = document.querySelector('[data-password-toggle]');
const eyeOffIcon = document.querySelector('[data-eye-off]');
const eyeIcon = document.querySelector('[data-eye]');
const loginForm = document.querySelector('.login-form');
const forgotPasswordLink = document.querySelector('.forgot-password');

const loginToSystem = async (usuario, senha) => {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ usuario, senha })
    });

    const data = await response.json();

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

toggleButton?.addEventListener('click', () => {
  const isPassword = passwordInput?.type === 'password';

  if (passwordInput) {
    passwordInput.type = isPassword ? 'text' : 'password';
  }

  eyeOffIcon?.classList.toggle('is-hidden', !isPassword);
  eyeIcon?.classList.toggle('is-hidden', isPassword);
  toggleButton.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
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
