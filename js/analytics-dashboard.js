'use strict';

(() => {
  const $ = id => document.getElementById(id), auth = new Mondial(), charts = new Map();
  const labels = { desktop: 'Ordinateur', mobile: 'Téléphone', tablet: 'Tablette', touch: 'Tactile',
    keyboard: 'Clavier / clic', wheel: 'Molette', gamepad: 'Manette', race: 'Course',
    timetrial: 'Contre-la-montre', tuning: 'Réglage', multiplayer: 'Multijoueur', f1: 'F1', gt: 'GT', proto: 'Prototypes' };
  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const num = v => nf.format(v || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration = v => v >= 3600 ? (v / 3600).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' h'
    : Math.round((v || 0) / 60) + ' min';
  const carName = id => modelById(id)?.name || id;
  const trackName = id => TRACKS.find(t => t.id === id)?.name || id;
  const date = d => d.toISOString().slice(0, 10);
  let report = null, busy = false, serial = 0;
  const palette = ['#f0bd63', '#73bda0', '#7fa9ce', '#cc869c', '#a29bc4', '#cd986c'];

  for (const [id, rows, name] of [['track', TRACKS, t => t.name], ['car', MODELS, m => m.name]])
    rows.forEach(row => { const o = document.createElement('option'); o.value = row.id; o.textContent = name(row); $(id).append(o); });
  function period() {
    if ($('period').value === 'custom') return;
    const to = new Date(), from = new Date(to);
    from.setUTCDate(to.getUTCDate() - Number($('period').value) + 1);
    $('from').value = date(from); $('to').value = date(to);
  }
  period(); $('period').addEventListener('change', period);
  for (const id of ['from','to']) $(id).addEventListener('change', () => $('period').value = 'custom');
  $('login').onclick = () => auth.entrer();
  $('logout').onclick = () => { auth.sortir(); location.reload(); };

  function chart(id, option) {
    let c = charts.get(id);
    if (!c) { c = echarts.init($(id), null, { renderer: 'canvas' }); charts.set(id, c); }
    c.setOption({ color: palette, backgroundColor: 'transparent', textStyle: { color: '#a0afb4', fontFamily: 'system-ui' },
      aria: { enabled: true }, ...option }, true);
  }
  window.addEventListener('resize', () => charts.forEach(c => c.resize()));

  function table(headers, rows) {
    if (!rows.length) return '<p class="muted">Aucune donnée sur cette période.</p>';
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function ranking(kind) {
    const rows = report.rankings[kind] || [];
    return table([kind === 'tracks' ? 'Circuit' : kind === 'cars' ? 'Voiture' : 'Livrée', 'Départs', 'Tours', 'Pilotes', 'Temps'], rows.map((r, i) => {
      const m = modelById(kind === 'liveries' ? r.key.split('|')[0] : r.key);
      const title = kind === 'tracks' ? trackName(r.key) : kind === 'cars' ? carName(r.key)
        : `${carName(r.key.split('|')[0])} · ${livreeDe(m, Number(r.key.split('|')[1])).nom}`;
      return [`<div class="rank-label"><span class="rank-no">${i + 1}</span>${kind === 'cars' && m?.pick ? `<img class="car-thumb" src="${esc(m.pick)}" alt="" loading="lazy">` : ''}<span>${esc(title)}</span></div>`, num(r.starts), num(r.laps), num(r.visitors), duration(r.seconds)];
    }));
  }
  function breakdown(kind) {
    const rows = report.rankings[kind] || [], total = rows.reduce((s, r) => s + r.starts, 0);
    $(kind + '-list').innerHTML = rows.map(r => `<div class="mini-row"><span>${esc(labels[r.key] || r.key)}</span><span>${num(r.starts)} <small>${total ? Math.round(r.starts / total * 100) : 0} %</small></span></div><div class="mini-bar"><span style="width:${total ? r.starts / total * 100 : 0}%"></span></div>`).join('') || '<p class="muted">Aucun départ mesuré.</p>';
    if (!$(kind + '-chart')) return;
    chart(kind + '-chart', { tooltip: { trigger: 'item' }, legend: { show: false },
      series: [{ type: 'pie', radius: ['55%', '80%'], label: { show: false },
        data: rows.filter(r => r.starts).map(r => ({ name: labels[r.key] || r.key, value: r.starts })) }] });
  }
  function render() {
    const r = report, c = r.current, p = r.previous;
    const defs = [['visitors', 'Visiteurs uniques estimés'], ['sessions', 'Visites'], ['starts', 'Départs'],
      ['laps', 'Tours réalisés'], ['seconds', 'Temps de jeu'], ['completed', 'Courses terminées'],
      ['abandoned', 'Abandons explicites'], ['offtracks', 'Sorties de piste']];
    $('kpis').innerHTML = defs.map(([key, title]) => {
      const delta = p[key] ? ((c[key] || 0) - p[key]) / p[key] * 100 : null;
      return `<section class="kpi"><h2>${title}</h2><strong>${key === 'seconds' ? duration(c[key]) : num(c[key])}</strong><small><span class="delta">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' %'}</span>vs période précédente</small></section>`;
    }).join('');
    $('empty').hidden = !!c.visitors;
    $('audience').textContent = `${num(r.audience.new)} nouveaux · ${num(r.audience.returning)} déjà venus`;
    const days = [], daily = new Map(r.daily.map(d => [d.day, d]));
    for (let d = new Date($('from').value + 'T00:00:00Z'); date(d) <= $('to').value; d.setUTCDate(d.getUTCDate() + 1)) days.push(date(d));
    chart('daily-chart', { tooltip: { trigger: 'axis' }, legend: { textStyle: { color: '#a0afb4' } },
      grid: { left: 50, right: 45, bottom: 42, top: 45 },
      xAxis: { type: 'category', data: days.map(d => d.slice(8) + '/' + d.slice(5, 7)), boundaryGap: false },
      yAxis: [{ type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#2d383f' } } }, { type: 'value', minInterval: 1, splitLine: { show: false } }],
      series: [['visitors', 'Visiteurs', 0], ['laps', 'Tours', 1], ['starts', 'Départs', 1]].map(([key, name, yAxisIndex]) => ({
        name, type: 'line', yAxisIndex, showSymbol: days.length < 15, smooth: .15,
        areaStyle: key === 'visitors' ? { opacity: .09 } : undefined, data: days.map(d => daily.get(d)?.[key] || 0) })) });
    for (const kind of ['tracks','cars','liveries']) $(kind + '-table').innerHTML = ranking(kind);
    for (const kind of ['devices','controls','modes','categories','versions']) breakdown(kind);
    const cells = new Map(r.hours.map(h => [h.day + '|' + h.hour, h.starts])), grid = [];
    for (let day = 1; day <= 7; day++) for (let hour = 0; hour < 24; hour++) grid.push([hour, day - 1, cells.get(day + '|' + hour) || 0]);
    chart('hours-chart', { tooltip: { formatter: p => `${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][p.value[1]]} ${p.value[0]} h · ${num(p.value[2])} départs` },
      grid: { top: 12, bottom: 70, left: 44, right: 12 },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => h + 'h'), splitArea: { show: false } },
      yAxis: { type: 'category', data: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], inverse: true },
      visualMap: { min: 0, max: Math.max(1, ...r.hours.map(h => h.starts)), calculable: false,
        orient: 'horizontal', left: 'center', bottom: 5, textStyle: { color: '#a0afb4' }, inRange: { color: ['#253239','#497964','#f0bd63'] } },
      series: [{ type: 'heatmap', data: grid, itemStyle: { borderWidth: 2, borderColor: '#182025' } }] });
    $('lap-quality').textContent = c.known_laps ? `${Math.round(c.clean_laps / c.known_laps * 100)} % de tours propres · ${num(c.clean_laps)} / ${num(c.known_laps)} tours renseignés` : 'Aucun tour renseigné.';
    const events = { race_start: 'Départ', lap: 'Tour terminé', race_end: 'Fin' }, ends = { completed: 'Arrivée', abandoned: 'Abandon', session_end: 'Fin de session' };
    $('recent-table').innerHTML = table(['Date · UTC', 'Activité', 'Circuit', 'Voiture', 'Détail'], r.recent.map(e => [
      esc(new Date(e.at).toLocaleString('fr-FR', { timeZone: 'UTC' })), events[e.event] || esc(e.event),
      esc(trackName(e.track) || '—'), esc(carName(e.car) || '—'),
      e.event === 'lap' ? `Tour ${num(e.lap)}${e.lap_s ? ' · ' + e.lap_s.toFixed(3) + ' s' : ''}` : esc(ends[e.outcome] || '—'),
    ]));
    $('coverage').textContent = r.first_event ? `Collecte depuis le ${new Date(r.first_event).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}. Dernier événement reçu : ${new Date(r.last_event).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC. Aucun historique de tours reconstitué à partir des records.` : 'La collecte n’a encore reçu aucun événement.';
    $('csv').disabled = false;
  }
  async function load() {
    if (busy) return;
    const from = $('from').value, to = $('to').value;
    if (!from || !to || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) {
      $('error').textContent = 'Choisis une période valide de 366 jours maximum.'; $('error').hidden = false; return;
    }
    if (!auth.connecte()) { showGate('Ta session a expiré. Reconnecte-toi pour consulter les données.'); return; }
    busy = true; const request = ++serial;
    const controls = [...$('filters').querySelectorAll('input,select,button')];
    controls.forEach(el => el.disabled = true);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    $('error').hidden = true; $('status').textContent = 'Chargement des statistiques…';
    try {
      const response = await fetch(`${MONDIAL_URL}/rest/v1/rpc/analytics_report`, { method: 'POST',
        headers: { apikey: MONDIAL_KEY, Authorization: `Bearer ${auth.session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_from: from, p_to: to, p_track: $('track').value || null, p_car: $('car').value || null }), signal: controller.signal });
      if (response.status === 401) { auth.sortir(); showGate('Session expirée. Reconnecte-toi.'); return; }
      if (response.status === 403) { showGate('Ce compte n’est pas autorisé à consulter les statistiques. Le propriétaire doit l’ajouter aux administrateurs.'); return; }
      if (response.status === 404) throw new Error('La collecte n’est pas encore installée sur Supabase. Exécuter supabase/analytics.sql puis autoriser le compte propriétaire.');
      if (!response.ok) throw new Error('Statistiques indisponibles (HTTP ' + response.status + '). Réessaie dans un instant.');
      const data = await response.json();
      if (request !== serial) return;
      report = data; render();
      $('status').textContent = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR') + ' · comparaison avec la période précédente de même durée';
    } catch (e) { $('error').textContent = e.message || 'Connexion impossible.'; $('error').hidden = false; $('status').textContent = 'Actualisation échouée. Les données précédentes restent affichées.'; }
    finally { clearTimeout(timeout); busy = false; controls.forEach(el => el.disabled = false); $('csv').disabled = !report; }
  }
  function showGate(message) {
    $('dashboard').hidden = true; $('gate').hidden = false; $('gate-message').textContent = message || '';
    $('account').textContent = auth.connecte() ? auth.session.nom : ''; $('logout').hidden = !auth.connecte();
  }
  $('filters').onsubmit = e => { e.preventDefault(); load(); };
  setInterval(() => { if ($('auto').checked && !document.hidden && !$('dashboard').hidden) load(); }, 60000);
  $('csv').onclick = () => {
    if (!report) return;
    const rows = [['Type','Élément','Départs','Tours','Visiteurs','Secondes de jeu','Sorties de piste']];
    for (const [kind, values] of Object.entries(report.rankings)) for (const r of values)
      rows.push([kind, r.key, r.starts, r.laps, r.visitors, r.seconds, r.offtracks]);
    const csv = '\uFEFF' + rows.map(row => row.map(v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"','""') + '"').join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `eyes-on-line-${$('from').value}-${$('to').value}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (auth.connecte()) {
    $('gate').hidden = true; $('dashboard').hidden = false; $('account').textContent = auth.session.nom; $('logout').hidden = false; load();
  } else showGate(auth.erreurConnexion ? 'La connexion Google a échoué. Vérifie l’URL de retour autorisée dans Supabase.' : '');
})();
