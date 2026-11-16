import { clearSession, getSessionUser, isOwner } from '../services/api/client.js';

const SCREEN_LINKS = [
  ['painel', 'painel.html'],
  ['caixa', 'caixa.html'],
  ['produtos', 'produtos.html'],
  ['entradas', 'entradas.html'],
  ['saidas', 'saidas.html'],
  ['relatorios', 'relatorios.html'],
  ['fornecedores', 'fornecedores.html']
];

export { getSessionUser, isOwner };

function canAccessScreen(screen, user) {
  if (screen === 'usuarios') {
    return isOwner(user);
  }
  return isOwner(user) || (Array.isArray(user?.permissoes) && user.permissoes.includes(screen));
}

function firstAllowedPage(user) {
  const allowedScreen = SCREEN_LINKS.find(([screen]) => canAccessScreen(screen, user));
  return allowedScreen?.[1] || null;
}

function currentScreen(menu) {
  const activeLink = menu.querySelector('.nav-item.active[data-link]');
  if (activeLink) {
    return activeLink.dataset.link.replace(/\.html$/, '');
  }
  return window.location.pathname.split('/').pop().replace(/\.html$/, '');
}

function initializeSession() {
  const menu = document.querySelector('.nav');
  if (!menu) {
    return;
  }

  const token = localStorage.getItem('mercadinho_token');
  const user = getSessionUser();
  if (!token || !user) {
    clearSession();
    window.location.replace('index.html');
    return;
  }

  const screen = currentScreen(menu);
  if (!canAccessScreen(screen, user)) {
    const destination = firstAllowedPage(user);
    if (destination) {
      window.location.replace(destination);
    } else {
      clearSession();
      window.location.replace('index.html?sem-telas=1');
    }
    return;
  }

  menu.querySelectorAll('[data-link]').forEach((item) => {
    const itemScreen = item.dataset.link.replace(/\.html$/, '');
    const allowed = canAccessScreen(itemScreen, user);
    item.hidden = !allowed;
    item.style.display = allowed ? '' : 'none';
    item.classList.toggle('active', itemScreen === screen);
    if (itemScreen === screen) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  document.querySelectorAll('.profile-tag').forEach((tag) => {
    tag.textContent = isOwner(user) ? 'Dono' : 'Funcionário';
  });

  menu.querySelectorAll('[data-link]').forEach((item) => {
    item.addEventListener('click', () => {
      if (!item.hidden) {
        window.location.href = item.dataset.link;
      }
    });
  });

  document.querySelectorAll('[data-return-login]').forEach((button) => {
    button.addEventListener('click', () => {
      clearSession();
      window.location.href = 'index.html';
    });
  });
}

initializeSession();
