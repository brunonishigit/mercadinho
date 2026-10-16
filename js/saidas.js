const tbody = document.getElementById('saidas-table-body');
const exitModal = document.getElementById('exit-modal');
const openExitButton = document.querySelector('[data-open-exit-modal]');
const closeExitButtons = document.querySelectorAll('[data-close-exit]');
const exitForm = document.getElementById('exit-form');
const exitProductSelect = document.getElementById('exit-product');
const exitPageSize = 10;
let currentExitPage = 1;

const renderExitPagination = (totalItems) => {
  const pagination = document.querySelector('.table-footer .pagination');
  const footerText = document.querySelector('.table-footer > span');
  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / exitPageSize));
  currentExitPage = Math.min(currentExitPage, totalPages);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  pagination.innerHTML = `
    <button class="page-btn muted" type="button" data-page-action="prev" ${currentExitPage === 1 ? 'disabled' : ''}>&lt;</button>
    ${pages.map((page) => `
      <button class="page-btn ${page === currentExitPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>
    `).join('')}
    <button class="page-btn" type="button" data-page-action="next" ${currentExitPage === totalPages ? 'disabled' : ''}>&gt;</button>
  `;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      currentExitPage = Number(button.dataset.page);
      renderExits();
    });
  });

  pagination.querySelectorAll('[data-page-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.pageAction;
      currentExitPage = action === 'prev'
        ? Math.max(1, currentExitPage - 1)
        : Math.min(totalPages, currentExitPage + 1);
      renderExits();
    });
  });

  if (footerText) {
    footerText.textContent = totalPages > 1 ? `Página ${currentExitPage} de ${totalPages}` : (totalItems ? 'Mostrando todos os registros' : 'Sem registros disponíveis');
  }
};

const updateExitStats = async () => {
  const cards = document.querySelectorAll('.stat-card .stat-value');
  if (!cards.length) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/movimentacoes');
    const payload = await response.json();
    const items = (Array.isArray(payload?.items) ? payload.items : []).filter((item) => String(item.tipo || '').toUpperCase() === 'SAIDA');

    const uniqueProducts = new Set(items.map((item) => item.id_produto)).size;
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
    const lastExit = items.slice().sort((a, b) => new Date(b.data_movimentacao || 0) - new Date(a.data_movimentacao || 0))[0];

    cards[0].textContent = String(items.length);
    cards[1].textContent = String(uniqueProducts);
    cards[2].textContent = Number(totalQuantity).toLocaleString('pt-BR');
    cards[3].textContent = lastExit ? new Date(lastExit.data_movimentacao).toLocaleDateString('pt-BR') : '—';

    const badges = document.querySelectorAll('.mini-tag');
    if (badges.length) {
      badges[0].textContent = `${items.length} registros`;
      badges[1].textContent = `${uniqueProducts} produtos`;
      badges[2].textContent = `Total ${Number(totalQuantity).toLocaleString('pt-BR')}`;
      badges[3].textContent = lastExit ? 'Atualizado' : 'Sem dados';
    }
  } catch (error) {
    cards.forEach((node) => {
      node.textContent = '—';
    });
  }
};

const openExitModal = () => {
  exitModal?.classList.add('is-open');
  exitModal?.setAttribute('aria-hidden', 'false');
};

const closeExitModal = () => {
  exitModal?.classList.remove('is-open');
  exitModal?.setAttribute('aria-hidden', 'true');
  exitForm?.reset();
};

async function loadExitReferenceProducts() {
  if (!exitProductSelect) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/produtos');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    exitProductSelect.innerHTML = '<option value="">Selecione o produto</option>' + items
      .map((item) => `<option value="${item.id_produto}">${item.nome}</option>`)
      .join('');
  } catch (error) {
    exitProductSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

const getExitFilterState = () => {
  const searchInput = document.getElementById('exit-search');
  const dateFromInput = document.getElementById('exit-date-from');
  const dateToInput = document.getElementById('exit-date-to');
  const reasonField = document.querySelector('[data-filter-key="motivo"]');

  return {
    search: (searchInput?.value || '').trim().toLowerCase(),
    dateFrom: dateFromInput?.value || '',
    dateTo: dateToInput?.value || '',
    reason: reasonField?.dataset.value || 'todos'
  };
};

const applyExitFilters = (items) => {
  const { search, dateFrom, dateTo, reason } = getExitFilterState();

  return items.filter((item) => {
    const reasonName = String(item.motivo || item.observacao || 'Venda');
    const haystack = [item.produto, reasonName, item.observacao].join(' ').toLowerCase();
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

    if (reason !== 'todos' && !reasonName.toLowerCase().includes(reason.toLowerCase())) {
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
        if (typeof renderExits === 'function') {
          currentExitPage = 1;
          renderExits();
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

  document.getElementById('exit-search')?.addEventListener('input', () => {
    currentExitPage = 1;
    renderExits();
  });

  ['exit-date-from', 'exit-date-to'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      currentExitPage = 1;
      renderExits();
    });
  });
};

const renderExits = async () => {
  if (!tbody) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/movimentacoes');
    const payload = await response.json();
    const items = (Array.isArray(payload?.items) ? payload.items : []).filter((item) => {
      const tipo = String(item.tipo || '').toUpperCase();
      return tipo === 'SAIDA';
    });
    const filteredItems = applyExitFilters(items);

    if (!filteredItems.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state-cell">Nenhuma saída encontrada com os filtros selecionados.</td>
        </tr>
      `;
      renderExitPagination(0);
      return;
    }

    currentExitPage = Math.min(currentExitPage, Math.max(1, Math.ceil(filteredItems.length / exitPageSize)));
    const start = (currentExitPage - 1) * exitPageSize;
    const pageItems = filteredItems.slice(start, start + exitPageSize);

    tbody.innerHTML = pageItems.map((item) => `
      <tr>
        <td>${item.data_movimentacao || '—'}</td>
        <td>${item.motivo || item.observacao || 'Venda'}</td>
        <td>${item.produto || 'Produto'}</td>
        <td>${item.quantidade || 0}</td>
        <td>R$ ${Number(item.valor_total || item.valor_unitario || item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${item.observacao || '—'}</td>
        <td class="action-cell">
          <button class="delete-movement-button" type="button" data-delete-movement="${item.id_movimentacao || ''}" aria-label="Excluir saída">Excluir</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-delete-movement]').forEach((button) => {
      button.addEventListener('click', async () => {
        const movementId = Number(button.dataset.deleteMovement);
        const confirmed = await showConfirm('Deseja excluir esta saída?');
        if (!movementId || !confirmed) {
          return;
        }

        try {
          const response = await fetch(`http://127.0.0.1:5000/api/movimentacoes/${movementId}`, { method: 'DELETE' });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Não foi possível excluir a saída.');
          }

          window.alert(data.message || 'Saída excluída com sucesso.');
          await updateExitStats();
          await renderExits();
        } catch (error) {
          window.alert(error.message || 'Erro ao excluir saída.');
        }
      });
    });

    renderExitPagination(filteredItems.length);
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state-cell">Não foi possível carregar as saídas.</td>
      </tr>
    `;
    renderExitPagination(0);
  }
};

exitForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    tipo: 'SAIDA',
    id_produto: Number(exitProductSelect?.value || 0),
    quantidade: document.getElementById('exit-quantity')?.value || 0,
    motivo: document.getElementById('exit-reason')?.value || '',
    observacao: document.getElementById('exit-observation')?.value?.trim() || '',
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
      throw new Error(data.message || 'Não foi possível registrar a saída.');
    }

    window.alert(data.message || 'Saída registrada com sucesso.');
    closeExitModal();
    await updateExitStats();
    await renderExits();
  } catch (error) {
    window.alert(error.message || 'Erro ao registrar saída.');
  }
});

openExitButton?.addEventListener('click', openExitModal);
closeExitButtons.forEach((button) => button.addEventListener('click', closeExitModal));
exitModal?.addEventListener('click', (event) => {
  if (event.target === exitModal) {
    closeExitModal();
  }
});

setupFilterDropdowns();
loadExitReferenceProducts();
renderExits();
updateExitStats();

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
