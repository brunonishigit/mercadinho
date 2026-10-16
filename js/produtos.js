const tbody = document.getElementById('produtos-table-body');
const productModal = document.getElementById('product-modal');
const openProductButton = document.querySelector('[data-open-product-modal]');
const closeProductButtons = document.querySelectorAll('[data-close-product]');
const productForm = document.getElementById('product-form');
const productDeleteButton = document.getElementById('product-delete-button');
const categorySelect = document.getElementById('product-category');
const productPageSize = 10;
let currentProductPage = 1;
let editingProductId = null;

const renderProductPagination = (totalItems) => {
  const pagination = document.querySelector('.table-footer .pagination');
  const footerText = document.querySelector('.table-footer > span');
  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / productPageSize));
  currentProductPage = Math.min(currentProductPage, totalPages);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  pagination.innerHTML = `
    <button class="page-btn muted" type="button" data-page-action="prev" ${currentProductPage === 1 ? 'disabled' : ''}>&lt;</button>
    ${pages.map((page) => `
      <button class="page-btn ${page === currentProductPage ? 'active' : ''}" type="button" data-page="${page}">${page}</button>
    `).join('')}
    <button class="page-btn" type="button" data-page-action="next" ${currentProductPage === totalPages ? 'disabled' : ''}>&gt;</button>
  `;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      currentProductPage = Number(button.dataset.page);
      renderProducts();
    });
  });

  pagination.querySelectorAll('[data-page-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.pageAction;
      currentProductPage = action === 'prev'
        ? Math.max(1, currentProductPage - 1)
        : Math.min(totalPages, currentProductPage + 1);
      renderProducts();
    });
  });

  if (footerText) {
    footerText.textContent = totalPages > 1 ? `Página ${currentProductPage} de ${totalPages}` : (totalItems ? 'Mostrando todos os registros' : 'Sem registros disponíveis');
  }
};

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

const openProductModal = (product = null) => {
  if (!productModal) return;

  const title = document.getElementById('product-title');
  const subtitle = document.getElementById('product-subtitle');
  const submitButton = document.getElementById('product-submit-button');

  if (product) {
    editingProductId = product.id_produto;
    productDeleteButton.hidden = false;
    title.textContent = 'Editar Produto';
    subtitle.textContent = 'Atualize as informações do produto no estoque.';
    submitButton.innerHTML = '<span class="plus">✓</span> Salvar';

    document.getElementById('product-name').value = product.nome || '';
    document.getElementById('product-barcode').value = product.codigo_barras || '';
    document.getElementById('product-unit').value = product.unidade_medida || '';
    document.getElementById('product-price').value = product.preco ?? 0;
    document.getElementById('product-min-stock').value = product.estoque_minimo ?? 0;
    document.getElementById('product-active').checked = product.ativo !== false;
    document.getElementById('product-category').value = product.id_categoria || '';
  } else {
    editingProductId = null;
    if (productDeleteButton) productDeleteButton.hidden = true;
    title.textContent = 'Adicionar Produto';
    subtitle.textContent = 'Cadastre um novo produto no estoque.';
    submitButton.innerHTML = '<span class="plus">+</span> Adicionar';
    productForm?.reset();
    const activeCheck = document.getElementById('product-active');
    if (activeCheck) activeCheck.checked = true;
  }

  productModal.classList.add('is-open');
  productModal.style.display = 'flex';
  productModal.setAttribute('aria-hidden', 'false');
};

const closeProductModal = () => {
  if (!productModal) return;
  productModal.classList.remove('is-open');
  productModal.style.display = 'none';
  productModal.setAttribute('aria-hidden', 'true');
  editingProductId = null;
  productForm?.reset();
  const title = document.getElementById('product-title');
  const subtitle = document.getElementById('product-subtitle');
  const submitButton = document.getElementById('product-submit-button');
  if (title) title.textContent = 'Adicionar Produto';
  if (subtitle) subtitle.textContent = 'Cadastre um novo produto no estoque.';
  if (submitButton) submitButton.innerHTML = '<span class="plus">+</span> Adicionar';
  if (productDeleteButton) productDeleteButton.hidden = true;
};

async function fetchCategories() {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/categorias');
    const payload = await response.json();
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch (error) {
    return [];
  }
}

async function loadCategories() {
  const items = await fetchCategories();

  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">Selecione</option>' + items
      .filter((item) => item?.ativo !== false)
      .map((item) => `<option value="${item.id_categoria}">${item.nome}</option>`)
      .join('');
  }

  const categoryField = document.querySelector('[data-filter-key="categoria"]');
  const filterMenu = categoryField?.querySelector('.filter-menu');
  if (categoryField && filterMenu) {
    const activeItems = items.filter((item) => item?.ativo !== false);
    filterMenu.innerHTML = `
      <li class="filter-option selected" data-filter-value="todos">Categoria</li>
      ${activeItems.map((item) => `<li class="filter-option" data-filter-value="${item.id_categoria}">${item.nome}</li>`).join('')}
    `;
    categoryField.dataset.value = 'todos';
    const selectedValue = categoryField.querySelector('.selected-value');
    if (selectedValue) selectedValue.textContent = 'Categoria';
  }
}

const getProductFilterState = () => {
  const searchInput = document.getElementById('product-search');
  const categoryField = document.querySelector('[data-filter-key="categoria"]');
  const statusField = document.querySelector('[data-filter-key="status"]');
  const orderField = document.querySelector('[data-filter-key="ordem"]');

  return {
    search: (searchInput?.value || '').trim().toLowerCase(),
    category: categoryField?.dataset.value || 'todos',
    status: statusField?.dataset.value || 'todos',
    order: orderField?.dataset.value || 'nome'
  };
};

const applyProductFilters = (items) => {
  const { search, category, status, order } = getProductFilterState();

  let filtered = items.filter((item) => {
    const haystack = [
      item.nome,
      item.categoria,
      item.codigo_barras,
      item.unidade_medida,
      item.id_categoria
    ].join(' ').toLowerCase();

    if (search && !haystack.includes(search)) {
      return false;
    }

    if (category !== 'todos' && String(item.id_categoria) !== String(category)) {
      return false;
    }

    const estoqueAtual = Number(item.estoque_atual ?? 0);
    const estoqueMinimo = Number(item.estoque_minimo ?? 0);
    const isLowStock = estoqueAtual <= estoqueMinimo;
    const isExpiring = !!item.data_validade && (() => {
      const now = new Date();
      const date = new Date(`${item.data_validade}T00:00:00`);
      const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    })();

    if (status === 'ativo' && item.ativo === false) {
      return false;
    }

    if (status === 'baixo' && !isLowStock) {
      return false;
    }

    if (status === 'vencendo' && !isExpiring) {
      return false;
    }

    return true;
  });

  if (order === 'nome') {
    filtered = filtered.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  } else if (order === 'quantidade') {
    filtered = filtered.sort((a, b) => Number(b.estoque_atual || 0) - Number(a.estoque_atual || 0));
  } else if (order === 'validade') {
    filtered = filtered.sort((a, b) => {
      const dateA = a.data_validade ? new Date(`${a.data_validade}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.data_validade ? new Date(`${b.data_validade}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    });
  }

  return filtered;
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
        if (typeof renderProducts === 'function') {
          currentProductPage = 1;
          renderProducts();
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

  const searchInput = document.getElementById('product-search');
  searchInput?.addEventListener('input', () => {
    currentProductPage = 1;
    renderProducts();
  });
};

const renderProducts = async () => {
  if (!tbody) return;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/produtos');
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const filteredItems = applyProductFilters(items);
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / productPageSize));

    if (!filteredItems.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state-cell">Nenhum produto encontrado com os filtros selecionados.</td>
        </tr>
      `;
      renderProductPagination(0);
      return;
    }

    currentProductPage = Math.min(currentProductPage, totalPages);
    const start = (currentProductPage - 1) * productPageSize;
    const pageItems = filteredItems.slice(start, start + productPageSize);

    tbody.innerHTML = pageItems.map((item) => {
      const nome = item.nome || 'Produto';
      const estoqueAtual = Number(item.estoque_atual ?? 0);
      const categoria = item.categoria || item.id_categoria || 'Sem categoria';
      const status = item.ativo === false ? 'Inativo' : (estoqueAtual <= Number(item.estoque_minimo || 0) ? 'Baixo' : 'Ativo');
      const preco = Number(item.preco || 0);

      return `
        <tr>
          <td><span class="product-cell"><span class="product-thumb"></span>${nome}</span></td>
          <td>${item.codigo_barras || '—'}</td>
          <td>${estoqueAtual}</td>
          <td>R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td><span class="product-tag ${status === 'Ativo' ? 'positive' : 'warning'}">${status}</span></td>
          <td>${categoria}</td>
          <td class="action-cell">
            <button class="edit-product-button" type="button" data-edit-product="${item.id_produto}" aria-label="Editar produto ${nome}">✎</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-edit-product]').forEach((button) => {
      button.addEventListener('click', async () => {
        const productId = Number(button.dataset.editProduct);
        const product = items.find((item) => Number(item.id_produto) === productId);
        if (product) {
          openProductModal(product);
        }
      });
    });

    renderProductPagination(filteredItems.length);
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state-cell">Não foi possível carregar os produtos.</td>
      </tr>
    `;
    renderProductPagination(0);
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
    preco: document.getElementById('product-price')?.value || 0,
    ativo: document.getElementById('product-active')?.checked ?? true
  };

  if (!payload.nome || !payload.id_categoria || !payload.unidade_medida || !payload.preco) {
    window.alert('Preencha nome, categoria, unidade e preço do produto.');
    return;
  }

  try {
    const isEditing = editingProductId !== null;
    const url = isEditing ? `http://127.0.0.1:5000/api/produtos/${editingProductId}` : 'http://127.0.0.1:5000/api/produtos';
    const method = isEditing ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || (isEditing ? 'Não foi possível atualizar o produto.' : 'Não foi possível cadastrar o produto.'));
    }

    window.alert(data.message || (isEditing ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.'));
    closeProductModal();
    await updateProductsStats();
    await renderProducts();
  } catch (error) {
    window.alert(error.message || 'Erro ao salvar produto.');
  }
});

const initializeProductModal = () => {
  openProductButton?.addEventListener('click', openProductModal);
  closeProductButtons.forEach((button) => button.addEventListener('click', closeProductModal));
  productDeleteButton?.addEventListener('click', async () => {
    if (editingProductId === null) return;
    const confirmed = await showConfirm('Deseja inativar este produto? A ação mantém o histórico e remove o produto da visualização ativa.');
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/produtos/${editingProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ativo: false,
          nome: document.getElementById('product-name')?.value?.trim() || '',
          id_categoria: Number(document.getElementById('product-category')?.value || 0),
          codigo_barras: document.getElementById('product-barcode')?.value?.trim() || '',
          unidade_medida: document.getElementById('product-unit')?.value?.trim() || '',
          estoque_minimo: document.getElementById('product-min-stock')?.value || 0,
          preco: document.getElementById('product-price')?.value || 0
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível inativar o produto.');
      }

      window.alert(data.message || 'Produto inativado com sucesso.');
      closeProductModal();
      await updateProductsStats();
      await renderProducts();
    } catch (error) {
      window.alert(error.message || 'Erro ao inativar produto.');
    }
  });

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
