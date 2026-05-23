const fmt = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';

let bazy = null;
let editions = [];
let currentEdition = null;

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return r.json();
}

function calcCarTotal(car) {
  // car: { type: 'fix'|'std', name, gosCena, tuning, plate, unknownColor }
  let parts = [];
  let total = 0;
  if (car.type === 'fix') {
    total += car.fixPrice || 0;
    parts.push({ label: 'Фикс. цена', value: car.fixPrice || 0 });
  } else {
    total += (car.gosCena || 0) + (car.tuning || 0);
    parts.push({ label: 'Госцена', value: car.gosCena || 0 });
    if (car.tuning) parts.push({ label: 'Тюнинг', value: car.tuning });
  }
  if (car.platePrice) { total += car.platePrice; parts.push({ label: `Номер ${car.plate || ''}`, value: car.platePrice }); }
  if (car.unknownColorPrice) { total += car.unknownColorPrice; parts.push({ label: 'Неизв. цвет', value: car.unknownColorPrice }); }
  return { total, parts };
}

function calcPlayer(p) {
  let total = 0;
  const sections = {};

  if (p.cars?.length) {
    sections['Автомобили'] = p.cars.map(c => {
      const { total: t, parts } = calcCarTotal(c);
      total += t;
      return { name: c.name, price: t, breakdown: parts.map(x => `${x.label}: ${fmt(x.value)}`).join(' + ') };
    });
  }
  ['skins', 'houses', 'businesses', 'phones'].forEach(key => {
    const map = { skins: 'Скины', houses: 'Дома', businesses: 'Бизнесы', phones: 'Телефоны' };
    if (p[key]?.length) {
      sections[map[key]] = p[key].map(it => {
        total += it.price || 0;
        return { name: it.name, price: it.price || 0, breakdown: it.note || '' };
      });
    }
  });

  return { total, sections };
}

function renderTable() {
  const tbody = document.getElementById('forbesBody');
  const empty = document.getElementById('emptyState');
  tbody.innerHTML = '';
  if (!currentEdition?.players?.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const ranked = currentEdition.players
    .map(p => ({ ...p, _calc: calcPlayer(p) }))
    .sort((a, b) => b._calc.total - a._calc.total);

  ranked.forEach((p, i) => {
    const rank = i + 1;
    const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const tr = document.createElement('tr');
    const incompleteBadge = p.incomplete ? `<span class="incomplete-badge" title="${p.incomplete}">⚠</span>` : '';
    tr.innerHTML = `
      <td><div class="rank ${rankCls}">${rank}</div></td>
      <td><div class="player-name">${p.nick} ${incompleteBadge}</div></td>
      <td><div class="total-amount">${fmt(p._calc.total)}</div></td>
    `;
    tr.addEventListener('click', () => openPlayer(p));
    tbody.appendChild(tr);
  });
}

function openPlayer(p) {
  const dlg = document.getElementById('playerModal');
  const body = document.getElementById('modalBody');
  const { total, sections } = p._calc;

  let html = `
    <div class="modal-title">${p.nick}</div>
    ${p.alias ? `<div class="modal-alias">${p.alias}</div>` : ''}
    <div class="modal-subtitle">${currentEdition.title || 'Редакция'}</div>
    ${p.incomplete ? `<div class="incomplete-banner">⚠ Данные неполные: ${p.incomplete}</div>` : ''}
    <div class="modal-total">
      <span class="label">Итоговое состояние</span>
      <span class="value">${fmt(total)}</span>
    </div>
  `;

  Object.entries(sections).forEach(([secName, items]) => {
    html += `<div class="section"><h3>${secName}</h3>`;
    items.forEach(it => {
      html += `
        <div class="item-row">
          <div>
            <div>${it.name}</div>
            ${it.breakdown ? `<div class="breakdown">${it.breakdown}</div>` : ''}
          </div>
          <div class="price">${fmt(it.price)}</div>
        </div>
      `;
    });
    html += `</div>`;
  });

  body.innerHTML = html;
  dlg.showModal();
}

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('playerModal').close();
});
document.getElementById('playerModal').addEventListener('click', (e) => {
  if (e.target.id === 'playerModal') e.target.close();
});

async function init() {
  bazy = await loadJson('data/bazy.json');
  const list = await loadJson('data/editions.json');
  editions = list.editions;

  const sel = document.getElementById('editionSelect');
  editions.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.file;
    opt.textContent = `№${e.number}`;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', async () => {
    currentEdition = await loadJson('data/' + sel.value);
    renderTable();
  });

  if (editions.length) {
    currentEdition = await loadJson('data/' + editions[0].file);
    renderTable();
  }
}

init().catch(err => {
  console.error(err);
  document.getElementById('emptyState').hidden = false;
  document.getElementById('emptyState').innerHTML = `<p>Ошибка загрузки: ${err.message}</p>`;
});
