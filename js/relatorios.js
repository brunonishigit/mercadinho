document.addEventListener('DOMContentLoaded', async () => {
  const navButtons = document.querySelectorAll('[data-link]');
  const logoutButton = document.querySelector('[data-return-login]');

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.link;
      if (target) {
        window.location.href = target;
      }
    });
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  const cards = document.querySelectorAll('.stat-card .stat-value');
  const alertsPanel = document.querySelector('.list-card .empty-state-panel');
  const chartPanel = document.querySelector('.wide-card .empty-state-panel');

  try {
    const [productsResponse, movementsResponse, alertsResponse, categoriesResponse] = await Promise.all([
      fetch('http://127.0.0.1:5000/api/produtos'),
      fetch('http://127.0.0.1:5000/api/movimentacoes'),
      fetch('http://127.0.0.1:5000/api/alertas'),
      fetch('http://127.0.0.1:5000/api/categorias')
    ]);

    const productsPayload = await productsResponse.json();
    const movementsPayload = await movementsResponse.json();
    const alertsPayload = await alertsResponse.json();
    const categoriesPayload = await categoriesResponse.json();

    const products = Array.isArray(productsPayload?.items) ? productsPayload.items : [];
    const movements = Array.isArray(movementsPayload?.items) ? movementsPayload.items : [];
    const alerts = Array.isArray(alertsPayload?.items) ? alertsPayload.items : [];
    const categories = Array.isArray(categoriesPayload?.items) ? categoriesPayload.items : [];

    const lowStock = products.filter((item) => Number(item.estoque_atual || 0) <= Number(item.estoque_minimo || 0)).length;

    cards[0].textContent = String(products.length);
    cards[1].textContent = String(movements.length);
    cards[2].textContent = String(alerts.length);
    cards[3].textContent = String(lowStock);

    const miniTags = document.querySelectorAll('.mini-tag');
    if (miniTags.length >= 4) {
      miniTags[0].textContent = `${products.length} produtos`;
      miniTags[1].textContent = `${movements.length} mov.`;
      miniTags[2].textContent = `${alerts.length} alertas`;
      miniTags[3].textContent = `${lowStock} baixos`;
    }

    const categorySummary = categories.map((category) => {
      const count = products.filter((product) => String(product.id_categoria) === String(category.id_categoria)).length;
      return { nome: category.nome, count };
    }).filter((item) => item.count > 0);

    if (chartPanel) {
      if (!categorySummary.length) {
        chartPanel.innerHTML = '<p>Sem dados por categoria.</p>';
      } else {
        chartPanel.innerHTML = categorySummary.map((item) => `
          <div class="summary-row">
            <span>${item.nome}</span>
            <strong>${item.count}</strong>
          </div>
        `).join('');
      }
    }

    if (alertsPanel) {
      const alertItems = alerts.slice(0, 5);
      if (!alertItems.length) {
        alertsPanel.innerHTML = '<p>Nenhum alerta ativo no momento.</p>';
      } else {
        alertsPanel.innerHTML = alertItems.map((alert) => `
          <div class="summary-row compact-row">
            <span>${alert.tipo || 'ALERTA'}</span>
            <strong>${alert.mensagem || 'Sem detalhe'}</strong>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    cards.forEach((node) => {
      node.textContent = '—';
    });
    if (chartPanel) chartPanel.innerHTML = '<p>Não foi possível carregar os dados.</p>';
    if (alertsPanel) alertsPanel.innerHTML = '<p>Não foi possível carregar os alertas.</p>';
  }
});
