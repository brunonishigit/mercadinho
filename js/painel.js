const modal = document.getElementById('movement-modal');
const openButton = document.querySelector('[data-open-movement]');
const closeButtons = document.querySelectorAll('[data-close-movement]');
const movementOptions = document.querySelectorAll('[data-movement-type]');
const painelTableBody = document.getElementById('painel-table-body');
const movementForm = document.getElementById('movement-form');
const movementProductSelect = document.getElementById('movement-product');

const updatePanelStats = async () => {
  const cards = document.querySelectorAll('.stat-card .stat-value');
  if (!cards.length) return;

  try {
    const [productsResponse, movementsResponse] = await Promise.all([
      fetch('http://127.0.0.1:5000/api/produtos'),
      fetch('http://127.0.0.1:5000/api/movimentacoes')
    ]);

    const productsPayload = await productsResponse.json();
    const movementsPayload = await movementsResponse.json();
    const products = Array.isArray(productsPayload?.items) ? productsPayload.items : [];
    const movements = Array.isArray(movementsPayload?.items) ? movementsPayload.items : [];

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

const renderMovementRows = async () => {
  if (!painelTableBody) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/movimentacoes');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    if (!items.length) {
      painelTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state-cell">Nenhuma movimentação registrada no momento.</td>
        </tr>
      `;
      return;
    }

    painelTableBody.innerHTML = items.slice(0, 5).map((item) => {
      const tipo = item.tipo || 'ENTRADA';
      const produto = item.produto || item.id_produto || 'Produto';
      const quantidade = item.quantidade || 0;
      const observacao = item.observacao || '—';
      const dataMovimentacao = item.data_movimentacao || item.data || '—';

      return `
        <tr>
          <td>${dataMovimentacao}</td>
          <td><span class="tag ${tipo.toUpperCase() === 'SAIDA' ? 'perda' : 'venta'}">${tipo}</span></td>
          <td>${produto}</td>
          <td>${quantidade}</td>
          <td>${observacao}</td>
          <td class="arrow-col">→</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    painelTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state-cell">Não foi possível carregar as movimentações.</td>
      </tr>
    `;
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

loadMovementProducts();
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
