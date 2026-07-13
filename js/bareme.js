// bareme.js
document.getElementById('nav-placeholder').innerHTML = buildNav('bareme');

const STATS_DEF = [
  { key: 'min60',      label: 'Temps joué ≥ 60 min' },
  { key: 'moins60',    label: 'Temps joué < 60 min' },
  { key: 'but',        label: 'But marqué (par but)' },
  { key: 'passe',      label: 'Passe décisive (par passe)' },
  { key: 'cleanSheet', label: 'Clean sheet' },
  { key: 'arrets3',    label: 'Arrêts — par tranche de 3 (GAR uniquement)' },
  { key: 'penArrete',  label: 'Penalty arrêté (GAR uniquement)' },
  { key: 'penManque',  label: 'Penalty manqué' },
  { key: 'butEnc2',    label: 'Buts encaissés — par tranche de 2 (GAR/DEF)' },
  { key: 'jaune',      label: 'Carton jaune' },
  { key: 'rouge',      label: 'Carton rouge' },
  { key: 'csc',        label: 'Contre son camp (par but)' },
];

const POS = ['GAR', 'DEF', 'MIL', 'ATT'];

async function init() {
  if (await siteLockGuard()) return;
  await loadBareme();
  renderBareme(CONFIG.BAREME);
}

function renderBareme(bareme) {
  const el = document.getElementById('bareme-table');

  const cell = (v) => {
    if (v === 0) return `<td class="bareme-val bareme-zero">—</td>`;
    return `<td class="bareme-val ${v > 0 ? 'bareme-pos' : 'bareme-neg'}">${v > 0 ? '+' : ''}${v}</td>`;
  };

  el.innerHTML = `
    <table class="bareme-tbl">
      <thead>
        <tr>
          <th style="text-align:left">Action</th>
          ${POS.map(p => `<th><span class="badge badge-${p}">${p}</span></th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${STATS_DEF.map(s => `
          <tr>
            <td class="bareme-action">${s.label}</td>
            ${POS.map(p => cell(bareme[p]?.[s.key] ?? 0)).join('')}
          </tr>`).join('')}
      </tbody>
    </table>`;
}

init();
