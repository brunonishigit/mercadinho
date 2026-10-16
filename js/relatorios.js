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

  const moneyFormat = (value) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));

  const numberFormat = (value) =>
    new Intl.NumberFormat('pt-BR').format(Number(value || 0));

  const getFilterState = () => ({
    search: (document.getElementById('report-search')?.value || '').trim().toLowerCase(),
    dateFrom: document.getElementById('report-date-from')?.value || '',
    dateTo: document.getElementById('report-date-to')?.value || '',
    type: document.querySelector('[data-filter-key="tipo-relatorio"]')?.dataset.value || 'todos'
  });

  const applyFilters = (items) => {
    const { search, dateFrom, dateTo, type } = getFilterState();
    return items.filter((item) => {
      const haystack = [item.produto, item.nome, item.tipo, item.mensagem, item.categoria].join(' ').toLowerCase();
      if (search && !haystack.includes(search)) {
        return false;
      }

      const dateValue = item.data_movimentacao || item.data_validade || item.data_geracao || item.data;
      if (dateValue) {
        const itemDate = new Date(dateValue);
        if (Number.isNaN(itemDate.getTime())) {
          return false;
        }
        if (dateFrom && itemDate < new Date(`${dateFrom}T00:00:00`)) {
          return false;
        }
        if (dateTo && itemDate > new Date(`${dateTo}T23:59:59`)) {
          return false;
        }
      }

      if (type !== 'todos' && item.tipo && String(item.tipo).toUpperCase() !== type.toUpperCase()) {
        return false;
      }

      return true;
    });
  };

  const getLast7Days = () => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
  };

  const formatDay = (date) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);

  const attachReportFilters = () => {
    document.getElementById('report-search')?.addEventListener('input', () => renderReports());
    ['report-date-from', 'report-date-to'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => renderReports());
    });

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
          renderReports();
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

  const renderReports = async () => {
    try {
      const [productsResponse, movementsResponse, alertsResponse, lotsResponse] = await Promise.all([
        fetch('http://127.0.0.1:5000/api/produtos'),
        fetch('http://127.0.0.1:5000/api/movimentacoes'),
        fetch('http://127.0.0.1:5000/api/alertas'),
        fetch('http://127.0.0.1:5000/api/lotes')
      ]);

      const productsPayload = await productsResponse.json();
      const movementsPayload = await movementsResponse.json();
      const alertsPayload = await alertsResponse.json();
      const lotsPayload = await lotsResponse.json();

      let products = Array.isArray(productsPayload?.items) ? productsPayload.items : [];
      let movements = Array.isArray(movementsPayload?.items) ? movementsPayload.items : [];
      let alerts = Array.isArray(alertsPayload?.items) ? alertsPayload.items : [];
      let lots = Array.isArray(lotsPayload?.items) ? lotsPayload.items : [];

      products = applyFilters(products);
      movements = applyFilters(movements);
      alerts = applyFilters(alerts);
      lots = applyFilters(lots);

      const salesMovements = movements.filter((item) => String(item.tipo || '').toUpperCase() === 'SAIDA');
      const entriesMovements = movements.filter((item) => String(item.tipo || '').toUpperCase() === 'ENTRADA');

      const totalSalesUnits = salesMovements.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
      const totalRevenue = salesMovements.reduce((sum, item) => {
        const value = Number(item.valor_total || item.valor || 0);
        return sum + value;
      }, 0);
      const productsSold = new Set(salesMovements.map((item) => item.id_produto)).size;
      const avgTicket = salesMovements.length ? totalRevenue / salesMovements.length : 0;
      const lowStockAlerts = products.filter((item) => Number(item.estoque_atual || 0) <= Number(item.estoque_minimo || 0));

      const statCards = document.querySelectorAll('.stat-card');
      if (statCards.length >= 4) {
        statCards[0].querySelector('.stat-value').textContent = moneyFormat(totalRevenue);
        statCards[1].querySelector('.stat-value').textContent = numberFormat(productsSold || totalSalesUnits);
        statCards[2].querySelector('.stat-value').textContent = moneyFormat(avgTicket);
        statCards[3].querySelector('.stat-value').textContent = numberFormat(lowStockAlerts.length);

        const tags = statCards[0].querySelector('.mini-tag');
        if (tags) tags.textContent = `${numberFormat(totalSalesUnits)} itens`;
        statCards[1].querySelector('.mini-tag').textContent = `${numberFormat(products.length)} itens`;
        statCards[2].querySelector('.mini-tag').textContent = `${numberFormat(salesMovements.length)} vendas`;
        statCards[3].querySelector('.mini-tag').textContent = lowStockAlerts.length ? 'Atenção' : 'Sem alerta';
        statCards[3].classList.toggle('warning', lowStockAlerts.length > 0);
      }

      const salesChart = document.getElementById('sales-chart');
      if (salesChart) {
        const sevenDays = getLast7Days();
        const maxValue = Math.max(1, ...sevenDays.map((date) => {
          const key = date.toISOString().slice(0, 10);
          return salesMovements.filter((item) => {
            const movementDate = new Date(item.data_movimentacao || item.data || new Date());
            return movementDate.toISOString().slice(0, 10) === key;
          }).reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
        }));

        salesChart.innerHTML = sevenDays.map((date) => {
          const key = date.toISOString().slice(0, 10);
          const value = salesMovements.filter((item) => {
            const movementDate = new Date(item.data_movimentacao || item.data || new Date());
            return movementDate.toISOString().slice(0, 10) === key;
          }).reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

          const height = Math.max(14, (value / maxValue) * 100);
          return `
            <div class="bar-group">
              <span class="bar-value">${value}</span>
              <div class="bar" style="height:${height}%"></div>
              <span class="bar-label">${formatDay(date)}</span>
            </div>
          `;
        }).join('');
      }

      const categoryLegend = document.getElementById('category-legend');
      const donutChart = document.getElementById('donut-chart');
      const donutCenter = document.getElementById('donut-center');
      if (categoryLegend && donutChart && donutCenter) {
        const categoryTotals = products.reduce((acc, product) => {
          const categoryName = product.categoria || 'Sem categoria';
          acc[categoryName] = (acc[categoryName] || 0) + 1;
          return acc;
        }, {});

        const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
        const palette = ['#D9480F', '#EDA86B', '#F4C389', '#7A9D6E', '#D9D3C8'];
        let cursor = 0;
        const gradient = entries.map(([, value], index) => {
          const start = cursor;
          const end = cursor + (value / total) * 100;
          cursor = end;
          return `${palette[index % palette.length]} ${start}% ${end}%`;
        }).join(', ');

        donutChart.style.background = `conic-gradient(${gradient})`;
        donutCenter.innerHTML = `<strong>${total}</strong><span>produtos</span>`;
        categoryLegend.innerHTML = entries.map(([name, value], index) => `
          <li>
            <span style="display:inline-flex;align-items:center;gap:8px;"><span class="dot" style="background:${palette[index % palette.length]};"></span>${name}</span>
            <strong>${Math.round((value / total) * 100)}%</strong>
          </li>
        `).join('');
      }

      const expirationTableBody = document.getElementById('expiration-table-body');
      if (expirationTableBody) {
        const upcoming = lots
          .filter((lot) => Number(lot.quantidade || 0) > 0 && lot.data_validade)
          .map((lot) => {
            const now = new Date();
            const dueDate = new Date(`${lot.data_validade}T00:00:00`);
            const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
            return { ...lot, daysLeft };
          })
          .filter((lot) => lot.daysLeft >= 0 && lot.daysLeft <= 45)
          .sort((a, b) => a.daysLeft - b.daysLeft)
          .slice(0, 5);

        if (!upcoming.length) {
          expirationTableBody.innerHTML = `
            <tr>
              <td colspan="4" class="empty-state-row">Nenhuma validade próxima.</td>
            </tr>
          `;
        } else {
          expirationTableBody.innerHTML = upcoming.map((lot) => {
            const productName = lot.produto || 'Produto';
            return `
              <tr>
                <td>
                  <span class="product-cell">
                    <span class="thumb thumb-1"></span>
                    ${productName}
                  </span>
                </td>
                <td>${lot.id_lote || 'Lote'}</td>
                <td>${lot.data_validade}</td>
                <td>${lot.quantidade}</td>
              </tr>
            `;
          }).join('');
        }
      }

      const movementSummary = document.getElementById('movement-summary');
      if (movementSummary) {
        const entries = entriesMovements.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
        const exits = salesMovements.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
        const balance = entries - exits;

        movementSummary.innerHTML = `
          <div class="movement-item">
            <div class="movement-icon green">↑</div>
            <div class="movement-copy">
              <strong>Entradas no período</strong>
              <span>${numberFormat(entries)}</span>
            </div>
            <em>unidades</em>
          </div>
          <div class="movement-item">
            <div class="movement-icon red">↓</div>
            <div class="movement-copy">
              <strong>Saídas no período</strong>
              <span>${numberFormat(exits)}</span>
            </div>
            <em>unidades</em>
          </div>
          <div class="movement-item">
            <div class="movement-icon gold">=</div>
            <div class="movement-copy">
              <strong>Saldo atual</strong>
              <span>${numberFormat(balance)}</span>
            </div>
            <em>unidades</em>
          </div>
        `;
      }

      const alertList = document.getElementById('alert-list');
      if (alertList) {
        const limitedAlerts = alerts.slice(0, 4);
        alertList.innerHTML = limitedAlerts.length
          ? limitedAlerts.map((alert) => `
              <div class="alert-line">
                <span class="alert-bullet"></span>
                <div>
                  <strong>${alert.tipo || 'ALERTA'}</strong>
                  <p>${alert.mensagem || 'Produto com atenção.'}</p>
                </div>
              </div>
            `).join('')
          : '<div class="alert-line"><span class="alert-bullet"></span><div><strong>Sem alertas</strong><p>Nenhuma ocorrência pendente.</p></div></div>';
      }
    } catch (error) {
      const statCards = document.querySelectorAll('.stat-card');
      statCards.forEach((card) => {
        const value = card.querySelector('.stat-value');
        if (value) value.textContent = '—';
      });

      const salesChart = document.getElementById('sales-chart');
      if (salesChart) salesChart.innerHTML = '<div class="empty-state-row">Não foi possível carregar os dados.</div>';

      const expirationTableBody = document.getElementById('expiration-table-body');
      if (expirationTableBody) expirationTableBody.innerHTML = '<tr><td colspan="4" class="empty-state-row">Não foi possível carregar a validade.</td></tr>';
    }
  };

  attachReportFilters();
  renderReports();
});
