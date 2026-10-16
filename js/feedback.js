function ensureFeedbackRoot() {
  let root = document.getElementById('mercadinho-feedback-root');

  if (!root) {
    root = document.createElement('div');
    root.id = 'mercadinho-feedback-root';
    root.className = 'mercadinho-feedback-root';
    document.body.appendChild(root);
  }

  return root;
}

function showToast(message, type = 'info', duration = 2600) {
  const root = ensureFeedbackRoot();
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 220);
  }, duration);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-feedback-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'app-feedback-dialog';

    dialog.innerHTML = `
      <div class="app-feedback-title">Confirmação</div>
      <p class="app-feedback-message">${message}</p>
      <div class="app-feedback-actions">
        <button type="button" class="app-feedback-button app-feedback-button--secondary" data-action="cancel">Cancelar</button>
        <button type="button" class="app-feedback-button app-feedback-button--primary" data-action="confirm">Confirmar</button>
      </div>
    `;

    const close = (result) => {
      backdrop.remove();
      resolve(result);
    };

    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        close(false);
      }
    });

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
  });
}

function showPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-feedback-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'app-feedback-dialog';

    dialog.innerHTML = `
      <div class="app-feedback-title">Digite sua senha</div>
      <p class="app-feedback-message">${message}</p>
      <label class="app-feedback-field" for="app-feedback-input">
        <input id="app-feedback-input" type="password" value="${defaultValue}" autocomplete="off" />
      </label>
      <div class="app-feedback-actions">
        <button type="button" class="app-feedback-button app-feedback-button--secondary" data-action="cancel">Cancelar</button>
        <button type="button" class="app-feedback-button app-feedback-button--primary" data-action="confirm">Confirmar</button>
      </div>
    `;

    const input = dialog.querySelector('#app-feedback-input');
    const close = (value) => {
      backdrop.remove();
      resolve(value);
    };

    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => close(null));
    dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => close(input.value));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        close(null);
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        close(input.value);
      }
    });

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    input.focus();
    input.select();
  });
}

window.showToast = showToast;
window.showConfirm = showConfirm;
window.showPrompt = showPrompt;
window.alert = (message) => {
  showToast(String(message || 'Operação concluída.'), 'info', 2600);
};
window.confirm = async (message) => {
  return await showConfirm(String(message || 'Confirma esta ação?'));
};
window.prompt = async (message, defaultValue = '') => {
  return await showPrompt(String(message || 'Digite o valor desejado:'), String(defaultValue || ''));
};
