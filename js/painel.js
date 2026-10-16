const modal = document.getElementById('movement-modal');
const openButton = document.querySelector('[data-open-movement]');
const closeButtons = document.querySelectorAll('[data-close-movement]');
const movementOptions = document.querySelectorAll('[data-movement-type]');
const painelTableBody = document.getElementById('painel-table-body');
const movementForm = document.getElementById('movement-form');
const movementProductSelect = document.getElementById('movement-product');
const painelPageSize = 5;
let currentPainelPage = 1;
let painelCache = null;
let painelRequest = null;
let painelSearchTimer = null;

const waitForPanelData = async () => {
  if (painelCache) {
    return painelCache;
  }

  if (!painelRequest) {
    painelRequest = Promise.all([
      fetch('http://127.0.0.1:5000/api/produtos'),
      fetch('http://127.0.0.1:5000/api/movimentacoes')
    ]).then(async ([productsResponse, movementsResponse]) => {
      const productsPayload = await productsResponse.json();
      const movementsPayload = await movementsResponse.json();
      const products = Array.isArray(productsPayload?.items) ? productsPayload.items : [];
      const movements = Array.isArray(movementsPayload?.items) ? movementsPayload.items : [];
      painelCache = { products, movements };
      return painelCache;
    }).finally(() => {
      painelRequest = null;
    });
  }

  return painelRequest;
};

const renderPainelPagination = (totalItems) => {
  const pagination = document.querySelector('.table-footer .pagination');
  const footerText = document.querySelector('.table-footer > span');
  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / painelPageSize));
  currentPainelPage = Math.min(currentPainelPage, totalPages);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  pagination.innerHTML = `
    <button class="page-btn muted" type="button" data-page-action="prev" ${currentPainelPage === 1 ? 'disabled' : ''}>&lt;</button>
    ${pages.map((page) => `
      <button class="page-btn ${page === currentPainelPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>
    `).join('')}
    <button class="page-btn" type="button" data-page-action="next" ${currentPainelPage === totalPages ? 'disabled' : ''}>&gt;</button>
  `;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      currentPainelPage = Number(button.dataset.page);
      renderMovementRows();
    });
  });

  pagination.querySelectorAll('[data-page-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.pageAction;
      currentPainelPage = action === 'prev'
        ? Math.max(1, currentPainelPage - 1)
        : Math.min(totalPages, currentPainelPage + 1);
      renderMovementRows();
    });
  });

  if (footerText) {
    footerText.textContent = totalPages > 1 ? `Página ${currentPainelPage} de ${totalPages}` : (totalItems ? 'Mostrando todos os registros' : 'Sem registros disponíveis');
  }
};

const updatePanelStats = async () => {
  const cards = document.querySelectorAll('.stat-card .stat-value');
  if (!cards.length) return;

  try {
    const { products, movements } = await waitForPanelData();
    const entradas = movements.filter((item) => String(item.tipo || '').toUpperCase() === 'ENTRADA');
    const saidas = movements.filter((item) => String(item.tipo || '').toUpperCase() === 'SAIDA');
    const lastMovement = movements.slice().sort((a, b) => new Date(b.data_movimentacao || 0) - new Date(a.data_movimentacao || 0))[0];

    cards[0].textContent = String(movements.length);
    cards[1].textContent = String(entradas.length);
    cards[2].textContent = String(saidas.length);
    cards[3].textContent = lastMovement ? new Date(lastMovement.data_movimentacao).toLocaleDateString('pt-BR') : '—';

    const badgeNodes = document.querySelectorAll('.mini-tag');
    badgeNodes[0].textContent = `${movements.length} registradas`;
    badgeNodes[1].textContent = `${entradas.length} entradas`;
    badgeNodes[2].textContent = `${saidas.length} saídas`;
    badgeNodes[3].textContent = products.length ? `${products.length} produtos` : '0 produtos';
  } catch (error) {
    cards.forEach((node) => {
      node.textContent = '—';
    });
  }
};

const openMovementModal = () => {
  modal?.classList.add('is-open');
  modal?.setAttribute('aria-hidden', 'false');
};

const closeMovementModal = () => {
  modal?.classList.remove('is-open');
  modal?.setAttribute('aria-hidden', 'true');
  movementForm?.reset();
};

async function loadMovementProducts() {
  if (!movementProductSelect) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/produtos');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    movementProductSelect.innerHTML = '<option value="">Selecione o produto</option>' + items
      .map((item) => `<option value="${item.id_produto}">${item.nome}</option>`)
      .join('');
  } catch (error) {
    movementProductSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

const getPanelFilterState = () => {
  const searchInput = document.getElementById('painel-search');
  const dateFromInput = document.getElementById('painel-date-from');
  const dateToInput = document.getElementById('painel-date-to');
  const typeField = document.querySelector('[data-filter-key="tipo"]');

  return {
    search: (searchInput?.value || '').trim().toLowerCase(),
    dateFrom: dateFromInput?.value || '',
    dateTo: dateToInput?.value || '',
    type: typeField?.dataset.value || 'todos'
  };
};

const applyPanelFilters = (items) => {
  const { search, dateFrom, dateTo, type } = getPanelFilterState();

  return items.filter((item) => {
    const tipo = String(item.tipo || '').toUpperCase();
    const haystack = [item.produto, item.observacao, tipo].join(' ').toLowerCase();
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

    if (type !== 'todos' && tipo !== type.toUpperCase()) {
      return false;
    }

    return true;
  });
};

const renderMovementRows = async () => {
  if (!painelTableBody) return;

  painelTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state-cell">Carregando movimentações...</td>
    </tr>
  `;

  try {
    const { movements } = await waitForPanelData();
    const filteredItems = applyPanelFilters(movements);

    if (!filteredItems.length) {
      painelTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state-cell">Nenhuma movimentação encontrada com os filtros selecionados.</td>
        </tr>
      `;
      renderPainelPagination(0);
      return;
    }

    currentPainelPage = Math.min(currentPainelPage, Math.max(1, Math.ceil(filteredItems.length / painelPageSize)));
    const start = (currentPainelPage - 1) * painelPageSize;
    const pageItems = filteredItems.slice(start, start + painelPageSize);

    painelTableBody.innerHTML = pageItems.map((item) => {
      const tipo = String(item.tipo || 'ENTRADA').toUpperCase();
      const produto = item.produto || item.id_produto || 'Produto';
      const quantidade = item.quantidade || 0;
      const observacao = item.observacao || '—';
      const dataMovimentacao = item.data_movimentacao || item.data || '—';

      return `
        <tr>
          <td>${dataMovimentacao}</td>
          <td><span class="tag ${tipo === 'SAIDA' ? 'saida' : 'entrada'}">${tipo}</span></td>
          <td>${produto}</td>
          <td>${quantidade}</td>
          <td>${observacao}</td>
          <td class="arrow-col">→</td>
        </tr>
      `;
    }).join('');

    renderPainelPagination(filteredItems.length);
  } catch (error) {
    painelTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state-cell">Não foi possível carregar as movimentações.</td>
      </tr>
    `;
    renderPainelPagination(0);
  }
};

movementOptions.forEach((option) => {
  option.addEventListener('click', () => {
    movementOptions.forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-pressed', 'false');
    });

    option.classList.add('active');
    option.setAttribute('aria-pressed', 'true');
  });
});

movementForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const activeType = document.querySelector('.movement-option.active')?.dataset.movementType || 'entrada';
  const payload = {
    tipo: activeType.toUpperCase(),
    id_produto: Number(movementProductSelect?.value || 0),
    quantidade: document.getElementById('movement-quantity')?.value || 0,
    observacao: document.getElementById('movement-observation')?.value?.trim() || '',
    usuario: localStorage.getItem('mercadinho_usuario') || 'operador'
  };

  if (!payload.id_produto || !payload.quantidade) {
    window.alert('Selecione o produto e a quantidade antes de salvar.');
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
      throw new Error(data.message || 'Não foi possível registrar a movimentação.');
    }

    window.alert(data.message || 'Movimentação registrada com sucesso.');
    closeMovementModal();
    await updatePanelStats();
    await renderMovementRows();
  } catch (error) {
    window.alert(error.message || 'Erro ao registrar movimentação.');
  }
});

openButton?.addEventListener('click', openMovementModal);
closeButtons.forEach((button) => {
  button.addEventListener('click', closeMovementModal);
});

modal?.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeMovementModal();
  }
});

const setupPanelFilters = () => {
  const searchInput = document.getElementById('painel-search');
  const dateFromInput = document.getElementById('painel-date-from');
  const dateToInput = document.getElementById('painel-date-to');
  const selectField = document.querySelector('[data-filter-key="tipo"]');
  const menuOptions = document.querySelectorAll('.filter-option');

  searchInput?.addEventListener('input', () => {
    clearTimeout(painelSearchTimer);
    painelSearchTimer = setTimeout(() => {
      currentPainelPage = 1;
      renderMovementRows();
    }, 180);
  });

  dateFromInput?.addEventListener('change', () => {
    currentPainelPage = 1;
    renderMovementRows();
  });

  dateToInput?.addEventListener('change', () => {
    currentPainelPage = 1;
    renderMovementRows();
  });

  selectField?.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = selectField.classList.toggle('is-open');
    selectField.setAttribute('aria-expanded', String(isOpen));
  });

  menuOptions.forEach((option) => {
    option.addEventListener('click', () => {
      const value = option.dataset.filterValue || 'todos';
      const selectedValue = value === 'todos' ? 'Todos os tipos' : option.textContent.trim();
      const selectedLabel = selectField?.querySelector('.selected-value');

      if (selectedLabel) {
        selectedLabel.textContent = selectedValue;
      }

      selectField?.setAttribute('data-value', value);
      selectField?.setAttribute('aria-expanded', 'false');
      selectField?.classList.remove('is-open');

      menuOptions.forEach((item) => item.classList.toggle('selected', item === option));
      currentPainelPage = 1;
      renderMovementRows();
    });
  });

  document.addEventListener('click', (event) => {
    if (!selectField?.contains(event.target)) {
      selectField?.classList.remove('is-open');
      selectField?.setAttribute('aria-expanded', 'false');
    }
  });
};

loadMovementProducts();
setupPanelFilters();
renderMovementRows();
updatePanelStats();

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
