const tbody = document.getElementById('fornecedores-table-body');
const supplierModal = document.getElementById('supplier-modal');
const openSupplierButton = document.querySelector('[data-open-supplier-modal]');
const closeSupplierButtons = document.querySelectorAll('[data-close-supplier]');
const supplierForm = document.getElementById('supplier-form');
const supplierDeleteButton = document.getElementById('supplier-delete-button');
const supplierPageSize = 10;
let currentSupplierPage = 1;
let editingSupplierId = null;

const renderSupplierPagination = (totalItems) => {
  const pagination = document.querySelector('.table-footer .pagination');
  const footerText = document.querySelector('.table-footer > span');
  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / supplierPageSize));
  currentSupplierPage = Math.min(currentSupplierPage, totalPages);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  pagination.innerHTML = `
    <button class="page-btn muted" type="button" data-page-action="prev" ${currentSupplierPage === 1 ? 'disabled' : ''}>&lt;</button>
    ${pages.map((page) => `
      <button class="page-btn ${page === currentSupplierPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>
    `).join('')}
    <button class="page-btn" type="button" data-page-action="next" ${currentSupplierPage === totalPages ? 'disabled' : ''}>&gt;</button>
  `;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      currentSupplierPage = Number(button.dataset.page);
      renderSuppliers();
    });
  });

  pagination.querySelectorAll('[data-page-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.pageAction;
      currentSupplierPage = action === 'prev'
        ? Math.max(1, currentSupplierPage - 1)
        : Math.min(totalPages, currentSupplierPage + 1);
      renderSuppliers();
    });
  });

  if (footerText) {
    footerText.textContent = totalPages > 1 ? `Página ${currentSupplierPage} de ${totalPages}` : (totalItems ? 'Mostrando todos os registros' : 'Sem registros disponíveis');
  }
};

const updateSupplierStats = async () => {
  const cards = document.querySelectorAll('.stat-card .stat-value');
  if (!cards.length) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/fornecedores');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    const activeCount = items.filter((item) => item.ativo !== false).length;
    const inactiveCount = items.length - activeCount;
    const lastCreated = items.slice().sort((a, b) => new Date(b.id_fornecedor || 0) - new Date(a.id_fornecedor || 0))[0];

    cards[0].textContent = String(items.length);
    cards[1].textContent = String(inactiveCount);
    cards[2].textContent = String(activeCount);
    cards[3].textContent = lastCreated ? 'Cadastrado' : '—';

    const badges = document.querySelectorAll('.badge');
    if (badges.length) {
      badges[0].textContent = `${items.length} fornecedores`;
      badges[1].textContent = inactiveCount ? `${inactiveCount} inativos` : 'Sem inativos';
      badges[2].textContent = activeCount ? `${activeCount} ativos` : 'Sem ativos';
      badges[3].textContent = lastCreated ? 'Atualizado' : 'Sem dados';
    }
  } catch (error) {
    cards.forEach((node) => {
      node.textContent = '—';
    });
  }
};

const openSupplierModal = (supplier = null) => {
  const title = document.getElementById('supplier-title');
  const subtitle = document.getElementById('supplier-subtitle');
  const submitButton = document.getElementById('supplier-submit-button');

  if (supplier) {
    editingSupplierId = supplier.id_fornecedor;
    if (supplierDeleteButton) supplierDeleteButton.hidden = false;
    title.textContent = 'Editar Fornecedor';
    subtitle.textContent = 'Atualize os dados do fornecedor.';
    submitButton.innerHTML = '<span class="plus">✓</span> Salvar';

    document.getElementById('supplier-name').value = supplier.nome || '';
    document.getElementById('supplier-phone').value = supplier.telefone || '';
    document.getElementById('supplier-email').value = supplier.email || '';
    document.getElementById('supplier-active').checked = supplier.ativo !== false;
  } else {
    editingSupplierId = null;
    if (supplierDeleteButton) supplierDeleteButton.hidden = true;
    title.textContent = 'Adicionar Fornecedor';
    subtitle.textContent = 'Cadastre um novo fornecedor.';
    submitButton.innerHTML = '<span class="plus">+</span> Adicionar';
    supplierForm?.reset();
    const activeCheck = document.getElementById('supplier-active');
    if (activeCheck) activeCheck.checked = true;
  }

  supplierModal.classList.add('is-open');
  supplierModal.style.display = 'flex';
  supplierModal.setAttribute('aria-hidden', 'false');
};

const closeSupplierModal = () => {
  supplierModal?.classList.remove('is-open');
  supplierModal?.setAttribute('aria-hidden', 'true');
  supplierModal && (supplierModal.style.display = 'none');
  editingSupplierId = null;
  supplierForm?.reset();

  const title = document.getElementById('supplier-title');
  const subtitle = document.getElementById('supplier-subtitle');
  const submitButton = document.getElementById('supplier-submit-button');
  if (title) title.textContent = 'Adicionar Fornecedor';
  if (subtitle) subtitle.textContent = 'Cadastre um novo fornecedor.';
  if (submitButton) submitButton.innerHTML = '<span class="plus">+</span> Adicionar';
  if (supplierDeleteButton) supplierDeleteButton.hidden = true;
};

const getSupplierFilterState = () => {
  const searchInput = document.getElementById('supplier-search');
  const statusField = document.querySelector('[data-filter-key="status-fornecedor"]');
  const orderField = document.querySelector('[data-filter-key="ordem-fornecedor"]');

  return {
    search: (searchInput?.value || '').trim().toLowerCase(),
    status: statusField?.dataset.value || 'todos',
    order: orderField?.dataset.value || 'nome'
  };
};

const applySupplierFilters = (items) => {
  const { search, status, order } = getSupplierFilterState();

  let filtered = items.filter((item) => {
    const haystack = [item.nome, item.telefone, item.email].join(' ').toLowerCase();
    if (search && !haystack.includes(search)) {
      return false;
    }

    if (status === 'ativo' && item.ativo === false) {
      return false;
    }

    if (status === 'inativo' && item.ativo !== false) {
      return false;
    }

    return true;
  });

  if (order === 'nome') {
    filtered = filtered.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  } else if (order === 'ativo') {
    filtered = filtered.sort((a, b) => Number(b.ativo !== false) - Number(a.ativo !== false));
  }

  return filtered;
};

const setupSupplierFilterDropdowns = () => {
  document.querySelectorAll('.select-field').forEach((field) => {
    const selectedValue = field.querySelector('.selected-value');
    const options = field.querySelectorAll('.filter-option');

    const closeDropdown = () => {
      field.classList.remove('is-open');
      field.setAttribute('aria-expanded', 'false');
    };

    field.addEventListener('click', (event) => {
      const option = event.target.closest('.filter-option');
      if (option) {
        const label = option.textContent.trim();
        const value = option.dataset.filterValue || option.textContent.trim().toLowerCase();
        if (selectedValue) {
          selectedValue.textContent = label;
        }
        options.forEach((item) => item.classList.toggle('selected', item === option));
        field.dataset.value = value;
        closeDropdown();
        if (typeof renderSuppliers === 'function') {
          currentSupplierPage = 1;
          renderSuppliers();
        }
        return;
      }

      const isOpen = field.classList.toggle('is-open');
      field.setAttribute('aria-expanded', String(isOpen));
    });

    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const isOpen = field.classList.toggle('is-open');
        field.setAttribute('aria-expanded', String(isOpen));
      }
    });

    document.addEventListener('click', (event) => {
      if (!field.contains(event.target)) {
        closeDropdown();
      }
    });
  });

  document.getElementById('supplier-search')?.addEventListener('input', () => {
    currentSupplierPage = 1;
    renderSuppliers();
  });
};

const renderSuppliers = async () => {
  if (!tbody) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/fornecedores');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const filteredItems = applySupplierFilters(items);

    if (!filteredItems.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state-cell">Nenhum fornecedor encontrado com os filtros selecionados.</td>
        </tr>
      `;
      renderSupplierPagination(0);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / supplierPageSize));
    currentSupplierPage = Math.min(currentSupplierPage, totalPages);
    const start = (currentSupplierPage - 1) * supplierPageSize;
    const pageItems = filteredItems.slice(start, start + supplierPageSize);

    tbody.innerHTML = pageItems.map((item) => {
      const status = item.ativo === false ? 'Inativo' : 'Ativo';
      const tagClass = status === 'Ativo' ? 'positive' : 'warning';
      return `
        <tr>
          <td><span class="product-cell"><span class="product-thumb"></span>${item.nome || 'Fornecedor'}</span></td>
          <td>${item.telefone || '—'}</td>
          <td>${item.email || '—'}</td>
          <td><span class="product-tag ${tagClass}">${status}</span></td>
          <td class="action-cell">
            <button class="edit-product-button" type="button" data-edit-supplier="${item.id_fornecedor}" aria-label="Editar fornecedor ${item.nome || 'fornecedor'}">✎</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-edit-supplier]').forEach((button) => {
      button.addEventListener('click', async () => {
        const supplierId = Number(button.dataset.editSupplier);
        const supplier = items.find((item) => Number(item.id_fornecedor) === supplierId);
        if (supplier) {
          openSupplierModal(supplier);
        }
      });
    });

    renderSupplierPagination(filteredItems.length);
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state-cell">Não foi possível carregar os fornecedores.</td>
      </tr>
    `;
    renderSupplierPagination(0);
  }
};

supplierForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    nome: document.getElementById('supplier-name')?.value?.trim() || '',
    telefone: document.getElementById('supplier-phone')?.value?.trim() || '',
    email: document.getElementById('supplier-email')?.value?.trim() || '',
    ativo: document.getElementById('supplier-active')?.checked ?? true
  };

  if (!payload.nome) {
    window.alert('Informe o nome do fornecedor antes de salvar.');
    return;
  }

  try {
    const isEditing = editingSupplierId !== null;
    const url = isEditing ? `http://127.0.0.1:5000/api/fornecedores/${editingSupplierId}` : 'http://127.0.0.1:5000/api/fornecedores';
    const method = isEditing ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || (isEditing ? 'Não foi possível atualizar o fornecedor.' : 'Não foi possível cadastrar o fornecedor.'));
    }

    window.alert(data.message || (isEditing ? 'Fornecedor atualizado com sucesso.' : 'Fornecedor cadastrado com sucesso.'));
    closeSupplierModal();
    await updateSupplierStats();
    await renderSuppliers();
  } catch (error) {
    window.alert(error.message || 'Erro ao salvar fornecedor.');
  }
});

const initializeSupplierModal = () => {
  openSupplierButton?.addEventListener('click', () => openSupplierModal());
  closeSupplierButtons.forEach((button) => button.addEventListener('click', closeSupplierModal));
  supplierDeleteButton?.addEventListener('click', async () => {
    if (editingSupplierId === null) return;
    const confirmed = await showConfirm('Deseja inativar este fornecedor? Ele continuará no histórico, mas será ocultado da lista ativa.');
    if (!confirmed) return;

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/fornecedores/${editingSupplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: document.getElementById('supplier-name')?.value?.trim() || '',
          telefone: document.getElementById('supplier-phone')?.value?.trim() || '',
          email: document.getElementById('supplier-email')?.value?.trim() || '',
          ativo: false
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível inativar o fornecedor.');
      }

      window.alert(data.message || 'Fornecedor inativado com sucesso.');
      closeSupplierModal();
      await updateSupplierStats();
      await renderSuppliers();
    } catch (error) {
      window.alert(error.message || 'Erro ao inativar fornecedor.');
    }
  });

  supplierModal?.addEventListener('click', (event) => {
    if (event.target === supplierModal) {
      closeSupplierModal();
    }
  });
};

initializeSupplierModal();
setupSupplierFilterDropdowns();
renderSuppliers();
updateSupplierStats();

document.querySelectorAll('[data-link]').forEach((link) => {
  link.addEventListener('click', () => {
    const destino = link.getAttribute('data-link');
    if (destino) {
      window.location.href = destino;
    }
  });
});

document.querySelectorAll('[data-return-login]').forEach((button) => {
  button.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
});
