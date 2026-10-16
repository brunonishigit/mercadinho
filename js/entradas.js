const tbody = document.getElementById('entradas-table-body');
const entryModal = document.getElementById('entry-modal');
const openEntryButton = document.querySelector('[data-open-entry-modal]');
const closeEntryButtons = document.querySelectorAll('[data-close-entry]');
const entryForm = document.getElementById('entry-form');
const productSelect = document.getElementById('entry-product');
const fornecedorSelect = document.getElementById('entry-supplier');
const entryPageSize = 10;
let currentEntryPage = 1;

const renderEntryPagination = (totalItems) => {
  const pagination = document.querySelector('.table-footer .pagination');
  const footerText = document.querySelector('.table-footer > span');
  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / entryPageSize));
  currentEntryPage = Math.min(currentEntryPage, totalPages);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  pagination.innerHTML = `
    <button class="page-btn muted" type="button" data-page-action="prev" ${currentEntryPage === 1 ? 'disabled' : ''}>&lt;</button>
    ${pages.map((page) => `
      <button class="page-btn ${page === currentEntryPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>
    `).join('')}
    <button class="page-btn" type="button" data-page-action="next" ${currentEntryPage === totalPages ? 'disabled' : ''}>&gt;</button>
  `;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      currentEntryPage = Number(button.dataset.page);
      renderEntries();
    });
  });

  pagination.querySelectorAll('[data-page-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.pageAction;
      currentEntryPage = action === 'prev'
        ? Math.max(1, currentEntryPage - 1)
        : Math.min(totalPages, currentEntryPage + 1);
      renderEntries();
    });
  });

  if (footerText) {
    footerText.textContent = totalPages > 1 ? `Página ${currentEntryPage} de ${totalPages}` : (totalItems ? 'Mostrando todos os registros' : 'Sem registros disponíveis');
  }
};

const updateEntryStats = async () => {
  const cards = document.querySelectorAll('.stat-card .stat-value');
  if (!cards.length) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/movimentacoes');
    const payload = await response.json();
    const items = (Array.isArray(payload?.items) ? payload.items : []).filter((item) => String(item.tipo || '').toUpperCase() === 'ENTRADA');

    const uniqueProducts = new Set(items.map((item) => item.id_produto)).size;
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
    const lastEntry = items.slice().sort((a, b) => new Date(b.data_movimentacao || 0) - new Date(a.data_movimentacao || 0))[0];

    cards[0].textContent = String(items.length);
    cards[1].textContent = String(uniqueProducts);
    cards[2].textContent = Number(totalQuantity).toLocaleString('pt-BR');
    cards[3].textContent = lastEntry ? new Date(lastEntry.data_movimentacao).toLocaleDateString('pt-BR') : '—';

    const badges = document.querySelectorAll('.badge');
    if (badges.length) {
      badges[0].textContent = `${items.length} registros`;
      badges[1].textContent = `${uniqueProducts} produtos`;
      badges[2].textContent = `Total ${Number(totalQuantity).toLocaleString('pt-BR')}`;
      badges[3].textContent = lastEntry ? 'Atualizado' : 'Sem dados';
    }
  } catch (error) {
    cards.forEach((node) => {
      node.textContent = '—';
    });
  }
};

const openEntryModal = () => {
  entryModal?.classList.add('is-open');
  entryModal?.setAttribute('aria-hidden', 'false');
};

const closeEntryModal = () => {
  entryModal?.classList.remove('is-open');
  entryModal?.setAttribute('aria-hidden', 'true');
  entryForm?.reset();
};

async function loadEntryReferences() {
  try {
    const [productsResponse, suppliersResponse] = await Promise.all([
      fetch('http://127.0.0.1:5000/api/produtos'),
      fetch('http://127.0.0.1:5000/api/fornecedores')
    ]);

    const productsData = await productsResponse.json();
    const suppliersData = await suppliersResponse.json();
    const products = Array.isArray(productsData?.items) ? productsData.items : [];
    const suppliers = Array.isArray(suppliersData?.items) ? suppliersData.items : [];

    if (productSelect) {
      productSelect.innerHTML = '<option value="">Selecione o produto</option>' + products
        .map((item) => `<option value="${item.id_produto}">${item.nome}</option>`)
        .join('');
    }

    if (fornecedorSelect) {
      fornecedorSelect.innerHTML = '<option value="">Selecione o fornecedor</option>' + suppliers
        .map((item) => `<option value="${item.id_fornecedor}">${item.nome}</option>`)
        .join('');
    }
  } catch (error) {
    if (productSelect) productSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    if (fornecedorSelect) fornecedorSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

let entrySupplierMap = new Map();

const getEntryFilterState = () => {
  const searchInput = document.getElementById('entry-search');
  const dateFromInput = document.getElementById('entry-date-from');
  const dateToInput = document.getElementById('entry-date-to');
  const supplierField = document.querySelector('[data-filter-key="fornecedor"]');

  return {
    search: (searchInput?.value || '').trim().toLowerCase(),
    dateFrom: dateFromInput?.value || '',
    dateTo: dateToInput?.value || '',
    supplier: supplierField?.dataset.value || 'todos'
  };
};

const applyEntryFilters = (items) => {
  const { search, dateFrom, dateTo, supplier } = getEntryFilterState();

  return items.filter((item) => {
    const productName = item.produto || '';
    const supplierName = entrySupplierMap.get(Number(item.id_fornecedor)) || item.fornecedor || '';
    const haystack = [productName, supplierName, item.observacao, item.tipo].join(' ').toLowerCase();
    if (search && !haystack.includes(search)) {
      return false;
    }

    const itemDate = item.data_movimentacao ? new Date(item.data_movimentacao) : null;
    if (dateFrom && (!itemDate || itemDate < new Date(`${dateFrom}T00:00:00`))) {
      return false;
    }

    if (dateTo && (!itemDate || itemDate > new Date(`${dateTo}T23:59:59`))) {
      return false;
    }

    if (supplier !== 'todos' && String(item.id_fornecedor || '') !== String(supplier)) {
      return false;
    }

    return true;
  });
};

const setupFilterDropdowns = () => {
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
        if (typeof renderEntries === 'function') {
          currentEntryPage = 1;
          renderEntries();
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

  document.getElementById('entry-search')?.addEventListener('input', () => {
    currentEntryPage = 1;
    renderEntries();
  });

  ['entry-date-from', 'entry-date-to'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      currentEntryPage = 1;
      renderEntries();
    });
  });
};

const renderEntries = async () => {
  if (!tbody) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/movimentacoes');
    const payload = await response.json();
    const items = (Array.isArray(payload?.items) ? payload.items : []).filter((item) => {
      const tipo = String(item.tipo || '').toUpperCase();
      return tipo === 'ENTRADA';
    });
    const filteredItems = applyEntryFilters(items);

    if (!filteredItems.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state-cell">Nenhuma entrada encontrada com os filtros selecionados.</td>
        </tr>
      `;
      renderEntryPagination(0);
      return;
    }

    currentEntryPage = Math.min(currentEntryPage, Math.max(1, Math.ceil(filteredItems.length / entryPageSize)));
    const start = (currentEntryPage - 1) * entryPageSize;
    const pageItems = filteredItems.slice(start, start + entryPageSize);

    tbody.innerHTML = pageItems.map((item) => {
      const fornecedor = entrySupplierMap.get(Number(item.id_fornecedor)) || item.fornecedor || '—';
      return `
        <tr>
          <td>${item.data_movimentacao || '—'}</td>
          <td>${item.produto || 'Produto'}</td>
          <td>${item.quantidade || 0}</td>
          <td>${fornecedor}</td>
          <td>R$ ${Number(item.valor_total || item.valor_unitario || item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td>${item.observacao || '—'}</td>
          <td class="action-cell">
            <button class="delete-movement-button" type="button" data-delete-movement="${item.id_movimentacao || ''}" aria-label="Excluir entrada">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-delete-movement]').forEach((button) => {
      button.addEventListener('click', async () => {
        const movementId = Number(button.dataset.deleteMovement);
        const confirmed = await showConfirm('Deseja excluir esta entrada?');
        if (!movementId || !confirmed) {
          return;
        }

        try {
          const response = await fetch(`http://127.0.0.1:5000/api/movimentacoes/${movementId}`, { method: 'DELETE' });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Não foi possível excluir a entrada.');
          }

          window.alert(data.message || 'Entrada excluída com sucesso.');
          await updateEntryStats();
          await renderEntries();
        } catch (error) {
          window.alert(error.message || 'Erro ao excluir entrada.');
        }
      });
    });

    renderEntryPagination(filteredItems.length);
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state-cell">Não foi possível carregar as entradas.</td>
      </tr>
    `;
    renderEntryPagination(0);
  }
};

entryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    tipo: 'ENTRADA',
    id_produto: Number(productSelect?.value || 0),
    id_fornecedor: Number(fornecedorSelect?.value || 0),
    quantidade: document.getElementById('entry-quantity')?.value || 0,
    data_entrada: document.getElementById('entry-date')?.value || new Date().toISOString().slice(0, 10),
    data_validade: document.getElementById('entry-validity')?.value || '',
    observacao: document.getElementById('entry-observation')?.value?.trim() || '',
    usuario: localStorage.getItem('mercadinho_usuario') || 'operador'
  };

  if (!payload.id_produto || !payload.id_fornecedor || !payload.quantidade) {
    window.alert('Selecione produto, fornecedor e quantidade antes de salvar.');
    return;
  }

  try {
    const response = await fetch('http://127.0.0.1:5000/api/movimentacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível registrar a entrada.');
    }

    window.alert(data.message || 'Entrada registrada com sucesso.');
    closeEntryModal();
    await updateEntryStats();
    await renderEntries();
  } catch (error) {
    window.alert(error.message || 'Erro ao registrar entrada.');
  }
});

openEntryButton?.addEventListener('click', openEntryModal);
closeEntryButtons.forEach((button) => button.addEventListener('click', closeEntryModal));
entryModal?.addEventListener('click', (event) => {
  if (event.target === entryModal) {
    closeEntryModal();
  }
});

setupFilterDropdowns();
loadEntryReferences();
renderEntries();
updateEntryStats();

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
