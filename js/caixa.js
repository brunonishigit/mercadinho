const barcodeInput = document.getElementById('barcode-input');
const quantityInput = document.getElementById('quantity-input');
const searchProductButton = document.getElementById('search-product-button');
const addProductButton = document.getElementById('add-product-button');
const clearCartButton = document.getElementById('clear-cart-button');
const finalizeSaleButton = document.getElementById('finalize-sale-button');
const productPreview = document.getElementById('product-preview');
const cashCartBody = document.getElementById('cash-cart-body');
const cartCounter = document.getElementById('cart-counter');
const summaryItems = document.getElementById('summary-items');
const summarySubtotal = document.getElementById('summary-subtotal');
const summaryTotal = document.getElementById('summary-total');
const userTag = document.getElementById('cash-user-tag');
const paymentButtons = document.querySelectorAll('[data-method]');

const cart = [];
let selectedMethod = 'DINHEIRO';
let selectedProduct = null;
let productCatalog = [];
let productCatalogLoading = false;

const formatMoney = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(number);
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const updateUserTag = () => {
  const user = localStorage.getItem('mercadinho_usuario') || 'Funcionário';
  if (userTag) {
    userTag.textContent = user;
  }
};

const debounce = (callback, delay = 300) => {
  let timerId = null;

  return (...args) => {
    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = window.setTimeout(() => {
      callback(...args);
    }, delay);
  };
};

const updateSummary = () => {
  let totalItems = 0;
  let subtotal = 0;

  cart.forEach((item) => {
    totalItems += item.quantidade;
    subtotal += item.quantidade * item.preco;
  });

  if (summaryItems) summaryItems.textContent = String(totalItems);
  if (summarySubtotal) summarySubtotal.textContent = formatMoney(subtotal);
  if (summaryTotal) summaryTotal.textContent = formatMoney(subtotal);
  if (cartCounter) cartCounter.textContent = `${cart.length} itens`;
};

const renderCart = () => {
  if (!cashCartBody) return;

  if (!cart.length) {
    cashCartBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state-cell">Nenhum item adicionado à venda.</td>
      </tr>
    `;
    updateSummary();
    return;
  }

  cashCartBody.innerHTML = cart.map((item, index) => {
    const totalItem = item.quantidade * item.preco;
    return `
      <tr>
        <td>
          <div class="cart-item-name">
            <strong>${item.nome}</strong>
            <span>${item.codigo_barras || 'Sem código'}</span>
          </div>
        </td>
        <td>${item.quantidade}</td>
        <td>${formatMoney(item.preco)}</td>
        <td>${formatMoney(totalItem)}</td>
        <td><button class="checkout-remove" type="button" data-remove-item="${index}">Excluir</button></td>
      </tr>
    `;
  }).join('');

  cashCartBody.querySelectorAll('[data-remove-item]').forEach((button) => {
    button.addEventListener('click', async () => {
      const index = Number(button.dataset.removeItem);
      const senha = await showPrompt('Digite sua senha para remover o item da venda:');
      if (senha === null || senha.trim() === '') {
        return;
      }

      const usuario = localStorage.getItem('mercadinho_usuario') || 'operador';
      try {
        const authResponse = await fetch('http://127.0.0.1:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario, senha })
        });
        const authData = await authResponse.json();

        if (!authResponse.ok) {
          throw new Error(authData.message || 'Senha inválida.');
        }

        cart.splice(index, 1);
        renderCart();
      } catch (error) {
        window.alert(error.message || 'Não foi possível remover o item.');
      }
    });
  });

  updateSummary();
};

const renderProductPreview = () => {
  if (!productPreview) return;

  if (!selectedProduct) {
    productPreview.innerHTML = `
      <span class="preview-title">Produto selecionado</span>
      <div class="preview-empty">Nenhum produto encontrado ainda.</div>
    `;
    return;
  }

  productPreview.innerHTML = `
    <span class="preview-title">Produto selecionado</span>
    <div class="product-info">
      <strong>${selectedProduct.nome}</strong>
      <span>${selectedProduct.codigo_barras || 'Código sem código de barras'}</span>
      <span>Estoque: ${selectedProduct.estoque_atual ?? 0} • ${formatMoney(selectedProduct.preco ?? 0)}</span>
    </div>
  `;
};

const loadProductCatalog = async () => {
  if (productCatalog.length) {
    return productCatalog;
  }

  if (productCatalogLoading) {
    return [];
  }

  productCatalogLoading = true;

  try {
    const response = await fetchJsonWithTimeout('http://127.0.0.1:5000/api/produtos', { method: 'GET' }, 15000);
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    productCatalog = items;
    return items;
  } catch (error) {
    return [];
  } finally {
    productCatalogLoading = false;
  }
};

const fetchProductByBarcode = async () => {
  const queryValue = (barcodeInput?.value || '').trim();
  if (!queryValue) {
    if (typeof showToast === 'function') {
      showToast('Informe o código ou o nome do produto.', 'info', 2200);
    } else {
      window.alert('Informe o código de barras ou o nome do produto.');
    }
    return;
  }

  try {
    let items = [];

    try {
      const response = await fetchJsonWithTimeout(
        `http://127.0.0.1:5000/api/produtos?search=${encodeURIComponent(queryValue)}`,
        { method: 'GET' },
        20000
      );
      const payload = await response.json();
      items = Array.isArray(payload?.items) ? payload.items : [];
      if (items.length) {
        productCatalog = items;
      }
    } catch (searchError) {
      items = [];
    }

    if (!items.length) {
      items = productCatalog.length ? productCatalog : await loadProductCatalog();
    }

    if (!items.length) {
      selectedProduct = null;
      renderProductPreview();
      if (typeof showToast === 'function') {
        showToast('Não foi possível carregar os produtos agora.', 'error', 2600);
      } else {
        window.alert('Não foi possível carregar os produtos agora.');
      }
      return;
    }

    const normalizedQuery = queryValue.toLowerCase();
    const match = items.find((item) => {
      const nome = String(item.nome || '').trim().toLowerCase();
      const codigo = String(item.codigo_barras || '').trim();
      const idTexto = String(item.id_produto || '').trim();
      return codigo === queryValue || idTexto === queryValue || nome.includes(normalizedQuery) || codigo.includes(queryValue);
    });

    if (!match) {
      selectedProduct = null;
      renderProductPreview();
      if (typeof showToast === 'function') {
        showToast('Produto não encontrado.', 'info', 2200);
      } else {
        window.alert('Produto não encontrado. Tente código de barras ou parte do nome.');
      }
      return;
    }

    selectedProduct = {
      ...match,
      estoque_atual: Number(match.estoque_atual ?? 0),
      preco: Number(match.preco ?? 0)
    };

    renderProductPreview();
  } catch (error) {
    selectedProduct = null;
    renderProductPreview();
    if (typeof showToast === 'function') {
      showToast('A busca não pôde ser concluída no momento.', 'error', 2600);
    } else {
      window.alert('A busca demorou demais. Verifique se o sistema está disponível.');
    }
  }
};

const addSelectedProductToCart = () => {
  if (!selectedProduct) {
    window.alert('Busque um produto antes de adicionar à venda.');
    return;
  }

  const quantity = Number(quantityInput?.value || 1);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    window.alert('Informe uma quantidade válida.');
    return;
  }

  if (quantity > Number(selectedProduct.estoque_atual || 0)) {
    window.alert('Quantidade acima do estoque disponível.');
    return;
  }

  const existing = cart.find((item) => item.id_produto === selectedProduct.id_produto);
  if (existing) {
    const newTotal = existing.quantidade + quantity;
    if (newTotal > Number(selectedProduct.estoque_atual || 0)) {
      window.alert('A quantidade total deste item excede o estoque disponível.');
      return;
    }
    existing.quantidade = newTotal;
  } else {
    cart.push({
      id_produto: selectedProduct.id_produto,
      nome: selectedProduct.nome,
      codigo_barras: selectedProduct.codigo_barras,
      quantidade: quantity,
      preco: Number(selectedProduct.preco || 0)
    });
  }

  renderCart();
  barcodeInput.value = '';
  selectedProduct = null;
  quantityInput.value = '1';
  renderProductPreview();
};

const clearCart = async () => {
  if (!cart.length) {
    return;
  }

  const senha = await showPrompt('Digite sua senha para limpar a venda:');
  if (senha === null || senha.trim() === '') {
    return;
  }

  const usuario = localStorage.getItem('mercadinho_usuario') || 'operador';
  try {
    const authResponse = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha })
    });
    const authData = await authResponse.json();

    if (!authResponse.ok) {
      throw new Error(authData.message || 'Senha inválida.');
    }

    cart.length = 0;
    renderCart();
  } catch (error) {
    window.alert(error.message || 'Não foi possível limpar a venda.');
  }
};

const finalizeSale = async () => {
  if (!cart.length) {
    window.alert('Adicione ao menos um item para finalizar a venda.');
    return;
  }

  const usuario = localStorage.getItem('mercadinho_usuario') || 'operador';

  try {
    const sales = cart.map((item) => ({
      tipo: 'SAIDA',
      id_produto: item.id_produto,
      quantidade: item.quantidade,
      motivo: 'venda',
      observacao: `Venda via caixa - ${selectedMethod}`,
      usuario
    }));

    const results = [];
    for (const move of sales) {
      const response = await fetch('http://127.0.0.1:5000/api/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(move)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível registrar a venda.');
      }
      results.push(data);
    }

    window.alert('Venda concluída com sucesso.');
    cart.length = 0;
    renderCart();
  } catch (error) {
    window.alert(error.message || 'Erro ao finalizar a venda.');
  }
};

const triggerSearchWhileTyping = debounce(() => {
  if (!barcodeInput || !barcodeInput.value || !barcodeInput.value.trim()) {
    selectedProduct = null;
    renderProductPreview();
    return;
  }

  fetchProductByBarcode();
}, 350);

searchProductButton?.addEventListener('click', fetchProductByBarcode);
barcodeInput?.addEventListener('input', triggerSearchWhileTyping);
barcodeInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    fetchProductByBarcode();
  }
});

addProductButton?.addEventListener('click', addSelectedProductToCart);
clearCartButton?.addEventListener('click', clearCart);
finalizeSaleButton?.addEventListener('click', finalizeSale);

paymentButtons.forEach((button) => {
  button.addEventListener('click', () => {
    paymentButtons.forEach((item) => item.classList.toggle('active', item === button));
    selectedMethod = button.dataset.method || 'DINHEIRO';
  });
});

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

updateUserTag();
renderCart();
renderProductPreview();
