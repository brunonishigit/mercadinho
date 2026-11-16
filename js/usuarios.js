import apiClient from '../services/api/client.js';
import { getSessionUser } from './session.js';

(() => {
  const tbody = document.getElementById('users-table-body');
  const userForm = document.getElementById('user-form');
  const userModal = document.getElementById('user-modal');
  const permissionInputs = Array.from(document.querySelectorAll('#user-permissions input[type="checkbox"]'));
  const DEFAULT_PERMISSIONS = ['painel', 'caixa', 'entradas', 'saidas', 'produtos'];
  const PERMISSION_LABELS = {
    painel: 'Painel',
    caixa: 'Caixa',
    produtos: 'Produtos',
    entradas: 'Entradas',
    saidas: 'Saídas',
    relatorios: 'Relatórios',
    fornecedores: 'Fornecedores'
  };
  let users = [];
  let editingUser = null;
  let currentStatusFilter = 'todos';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  const apiRequest = async (path, options = {}) => {
    const response = await apiClient.fetch(path, options);
    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('Não foi possível ler a resposta do servidor.');
      }
    }

    if (!response.ok) {
      const error = new Error(response.status === 403
        ? 'Você não tem permissão para gerenciar usuários.'
        : payload.message || 'Não foi possível concluir a operação.');
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const setPermissions = (permissions = [], owner = false) => {
    const selected = new Set(owner ? Object.keys(PERMISSION_LABELS) : permissions);
    permissionInputs.forEach((input) => {
      input.checked = selected.has(input.value);
      input.disabled = owner;
      input.closest('.permission-option')?.classList.toggle('is-disabled', owner);
    });

    const help = document.getElementById('permissions-help');
    if (help) {
      help.textContent = owner
        ? 'O perfil Dono tem acesso a todas as telas.'
        : 'Marque as telas que este funcionário poderá acessar.';
    }
  };

  const selectedPermissions = () => permissionInputs
    .filter((input) => input.checked)
    .map((input) => input.value);

  const updateStats = () => {
    const active = users.filter((user) => user.ativo !== false).length;
    document.querySelector('[data-user-stat="total"]').textContent = String(users.length);
    document.querySelector('[data-user-stat="ativos"]').textContent = String(active);
    document.querySelector('[data-user-stat="inativos"]').textContent = String(users.length - active);
  };

  const filteredUsers = () => {
    const search = (document.getElementById('user-search')?.value || '').trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = `${user.nome || ''} ${user.login || ''}`.toLowerCase().includes(search);
      const matchesStatus = currentStatusFilter === 'todos'
        || (currentStatusFilter === 'ativo' && user.ativo !== false)
        || (currentStatusFilter === 'inativo' && user.ativo === false);
      return matchesSearch && matchesStatus;
    });
  };

  const renderUsers = () => {
    const filtered = filteredUsers();
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state-cell">Nenhum usuário encontrado.</td></tr>';
      document.querySelector('[data-users-footer]').textContent = 'Sem registros disponíveis';
      return;
    }

    tbody.innerHTML = filtered.map((user) => {
      const isActive = user.ativo !== false;
      const permissionNames = (user.permissoes || [])
        .map((permission) => PERMISSION_LABELS[permission])
        .filter(Boolean);
      const accessLabel = user.tipo === 'DONO'
        ? 'Todas as telas'
        : (permissionNames.length ? permissionNames.join(', ') : 'Nenhuma tela');
      return `
        <tr>
          <td><span class="product-cell">${escapeHtml(user.nome || 'Usuário')}</span></td>
          <td>${escapeHtml(user.login || '—')}</td>
          <td>${user.tipo === 'DONO' ? 'Dono' : 'Funcionário'}</td>
          <td>${escapeHtml(accessLabel)}</td>
          <td><span class="product-tag ${isActive ? 'positive' : 'warning'}">${isActive ? 'Ativo' : 'Inativo'}</span></td>
          <td class="action-cell">
            <button class="edit-product-button" type="button" data-edit-user="${Number(user.id_usuario)}" aria-label="Editar usuário ${escapeHtml(user.nome || '')}">✎</button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelector('[data-users-footer]').textContent = `${filtered.length} usuário(s)`;
    tbody.querySelectorAll('[data-edit-user]').forEach((button) => {
      button.addEventListener('click', () => {
        const selected = users.find((user) => Number(user.id_usuario) === Number(button.dataset.editUser));
        if (selected) openUserModal(selected);
      });
    });
  };

  const openUserModal = (user = null) => {
    editingUser = user;
    userForm.reset();
    const isEditing = Boolean(user);
    const currentUser = getSessionUser();
    const isSelf = isEditing
      && String(user.login || '').toLowerCase() === String(currentUser?.login || '').toLowerCase();
    document.getElementById('user-modal-title').textContent = isEditing ? 'Editar usuário' : 'Novo usuário';
    document.getElementById('user-modal-subtitle').textContent = isEditing
      ? 'Atualize o perfil, as telas liberadas ou redefina a senha.'
      : 'Preencha os dados e escolha as telas liberadas.';
    document.getElementById('user-submit').textContent = isEditing ? 'Salvar alterações' : 'Criar usuário';
    document.getElementById('user-name').value = user?.nome || '';
    document.getElementById('user-login').value = user?.login || '';
    document.getElementById('user-login').readOnly = isEditing;
    document.getElementById('user-profile').value = user?.tipo || 'FUNCIONARIO';
    document.getElementById('user-profile').disabled = isSelf;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').required = !isEditing;
    document.querySelector('[data-password-required]').hidden = isEditing;
    document.querySelector('[data-password-help]').textContent = isEditing
      ? 'Deixe em branco para manter a senha atual.'
      : 'Obrigatória para criar um usuário.';
    document.querySelector('.user-active-field').hidden = !isEditing;
    document.getElementById('user-active').checked = user?.ativo !== false;
    document.getElementById('user-active').disabled = isSelf;
    setPermissions(user?.permissoes || DEFAULT_PERMISSIONS, user?.tipo === 'DONO');
    userModal.classList.add('is-open');
    userModal.style.display = 'flex';
    userModal.setAttribute('aria-hidden', 'false');
  };

  const closeUserModal = () => {
    userModal.classList.remove('is-open');
    userModal.style.display = 'none';
    userModal.setAttribute('aria-hidden', 'true');
    editingUser = null;
    userForm.reset();
  };

  const loadUsers = async () => {
    try {
      const payload = await apiRequest('/api/usuarios');
      users = Array.isArray(payload.items) ? payload.items : [];
      updateStats();
      renderUsers();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state-cell">${escapeHtml(error.message || 'Não foi possível carregar os usuários.')}</td></tr>`;
      document.querySelector('[data-users-footer]').textContent = 'Falha ao carregar';
    }
  };

  document.querySelector('[data-open-user-modal]')?.addEventListener('click', () => openUserModal());
  document.querySelectorAll('[data-close-user-modal]').forEach((button) => {
    button.addEventListener('click', closeUserModal);
  });
  userModal.addEventListener('click', (event) => {
    if (event.target === userModal) closeUserModal();
  });

  document.getElementById('user-profile').addEventListener('change', (event) => {
    const type = event.target.value;
    if (type === 'DONO') {
      setPermissions([], true);
    } else {
      setPermissions(editingUser?.permissoes || DEFAULT_PERMISSIONS, false);
    }
  });

  document.getElementById('user-search').addEventListener('input', renderUsers);
  const statusFilter = document.querySelector('[data-user-status-filter]');
  statusFilter.addEventListener('click', (event) => {
    const option = event.target.closest('[data-status-filter]');
    if (option) {
      currentStatusFilter = option.dataset.statusFilter;
      statusFilter.querySelector('.selected-value').textContent = option.textContent.trim();
      statusFilter.querySelectorAll('.filter-option').forEach((item) => {
        item.classList.toggle('selected', item === option);
      });
      statusFilter.classList.remove('is-open');
      statusFilter.setAttribute('aria-expanded', 'false');
      renderUsers();
      return;
    }
    const isOpen = statusFilter.classList.toggle('is-open');
    statusFilter.setAttribute('aria-expanded', String(isOpen));
  });

  userForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      nome: document.getElementById('user-name').value.trim(),
      tipo: document.getElementById('user-profile').value,
      permissoes: selectedPermissions()
    };
    const password = document.getElementById('user-password').value;
    if (!editingUser) {
      payload.login = document.getElementById('user-login').value.trim();
      payload.senha = password;
    } else {
      payload.ativo = document.getElementById('user-active').checked;
      if (password) payload.senha = password;
    }

    try {
      const path = editingUser ? `/api/usuarios/${editingUser.id_usuario}` : '/api/usuarios';
      const result = await apiRequest(path, {
        method: editingUser ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      window.alert(result.message || 'Usuário salvo com sucesso.');
      closeUserModal();
      await loadUsers();
    } catch (error) {
      window.alert(error.message || 'Não foi possível salvar o usuário.');
    }
  });

  loadUsers();
})();
