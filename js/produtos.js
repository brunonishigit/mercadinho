const tbody = document.getElementById('produtos-table-body');
const productModal = document.getElementById('product-modal');
const openProductButton = document.querySelector('[data-open-product-modal]');
const closeProductButtons = document.querySelectorAll('[data-close-product]');
const productForm = document.getElementById('product-form');
const categorySelect = document.getElementById('product-category');

const updateProductsStats = async () => {
  const cards = document.querySelectorAll('.stat-card .stat-value');
  if (!cards.length) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/produtos');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    const lowStock = items.filter((item) => Number(item.estoque_atual || 0) <= Number(item.estoque_minimo || 0)).length;
    const active = items.filter((item) => item.ativo !== false).length;

    cards[0].textContent = String(items.length);
    cards[1].textContent = String(lowStock);
    cards[2].textContent = String(items.filter((item) => item.ativo !== false).length);
    cards[3].textContent = String(active > 0 ? 'Ativos' : 'Sem dados');

    const badges = document.querySelectorAll('.badge');
    if (badges.length) {
      badges[0].textContent = `${items.length} produtos`;
      badges[1].textContent = lowStock ? `${lowStock} em baixa` : 'Sem baixa';
      badges[2].textContent = active ? `${active} ativos` : 'Sem dados';
      badges[3].textContent = items.length ? 'Em dia' : 'Sem dados';
    }
  } catch (error) {
    cards.forEach((node) => {
      node.textContent = '—';
    });
  }
};

const openProductModal = () => {
  if (!productModal) return;
  productModal.classList.add('is-open');
  productModal.style.display = 'flex';
  productModal.setAttribute('aria-hidden', 'false');
};

const closeProductModal = () => {
  if (!productModal) return;
  productModal.classList.remove('is-open');
  productModal.style.display = 'none';
  productModal.setAttribute('aria-hidden', 'true');
  productForm?.reset();
};

async function loadCategories() {
  if (!categorySelect) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/categorias');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    categorySelect.innerHTML = '<option value="">Selecione</option>' + items
      .filter((item) => item?.ativo !== false)
      .map((item) => `<option value="${item.id_categoria}">${item.nome}</option>`)
      .join('');
  } catch (error) {
    categorySelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

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
        if (selectedValue) {
          selectedValue.textContent = label;
        }
        options.forEach((item) => item.classList.toggle('selected', item === option));
        closeDropdown();
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
};

const renderProducts = async () => {
  if (!tbody) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/produtos');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state-cell">Nenhum produto cadastrado.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.slice(0, 10).map((item) => {
      const nome = item.nome || 'Produto';
      const quantidade = Number(item.estoque_atual ?? item.quantidade ?? 0);
      const categoria = item.categoria || item.id_categoria || 'Sem categoria';
      const status = item.ativo === false ? 'Inativo' : 'Ativo';

      return `
        <tr>
          <td><span class="product-cell"><span class="product-thumb"></span>${nome}</span></td>
          <td>${item.codigo_barras || '—'}</td>
          <td>${quantidade}</td>
          <td>${item.data_validade || '—'}</td>
          <td><span class="product-tag ${status === 'Ativo' ? 'positive' : 'warning'}">${status}</span></td>
          <td>${categoria}</td>
          <td class="arrow-col">→</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state-cell">Não foi possível carregar os produtos.</td>
      </tr>
    `;
  }
};

productForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    nome: document.getElementById('product-name')?.value?.trim() || '',
    id_categoria: Number(document.getElementById('product-category')?.value || 0),
    codigo_barras: document.getElementById('product-barcode')?.value?.trim() || '',
    unidade_medida: document.getElementById('product-unit')?.value?.trim() || '',
    estoque_minimo: document.getElementById('product-min-stock')?.value || 0,
    ativo: document.getElementById('product-active')?.checked ?? true
  };

  if (!payload.nome || !payload.id_categoria || !payload.unidade_medida) {
    window.alert('Preencha nome, categoria e unidade do produto.');
    return;
  }

  try {
    const response = await fetch('http://127.0.0.1:5000/api/produtos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível cadastrar o produto.');
    }

    window.alert(data.message || 'Produto cadastrado com sucesso.');
    closeProductModal();
    await updateProductsStats();
    await renderProducts();
  } catch (error) {
    window.alert(error.message || 'Erro ao cadastrar produto.');
  }
});

const initializeProductModal = () => {
  openProductButton?.addEventListener('click', openProductModal);
  closeProductButtons.forEach((button) => button.addEventListener('click', closeProductModal));
  productModal?.addEventListener('click', (event) => {
    if (event.target === productModal) {
      closeProductModal();
    }
  });
};

initializeProductModal();
setupFilterDropdowns();
loadCategories();
renderProducts();
updateProductsStats();

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
