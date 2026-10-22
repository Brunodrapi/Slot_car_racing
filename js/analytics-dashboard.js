'use strict';

(() => {
  const $ = id => document.getElementById(id), charts = new Map();
  /* La page parle la langue du jeu : celle de la sauvegarde, sinon celle du navigateur, avec la même
  règle que le jeu (l'anglais si le navigateur est en anglais, le français sinon). Le HTML porte le
  texte français ; chaque élément traduisible a sa clé (`data-i18n`, `data-i18n-aria`). */
  const LANG = (() => {
    try { const s = JSON.parse(localStorage.getItem('slotracer.save.v2') || 'null'); if (s && (s.lang === 'fr' || s.lang === 'en')) return s.lang; } catch (_) {}
    return (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
  })();
  const LOC = LANG === 'en' ? 'en-GB' : 'fr-FR';
  const TXT = {
    fr: {
      docTitle: 'Statistiques · GRIP', noData: 'Aucune donnée sur cette période.',
      thCircuit: 'Circuit', thCar: 'Voiture', thLivery: 'Livrée', thStarts: 'Départs', thLaps: 'Tours', thDrivers: 'Pilotes', thTime: 'Temps',
      kVisitors: 'Visiteurs uniques estimés', kSessions: 'Visites', kStarts: 'Départs', kLaps: 'Tours réalisés', kSeconds: 'Temps de jeu',
      kCompleted: 'Courses terminées', kAbandoned: 'Abandons explicites', kOfftracks: 'Sorties de piste', vsPrevious: 'vs période précédente',
      audience: (n, r) => `${n} nouveaux · ${r} déjà venus`, sVisitors: 'Visiteurs', sLaps: 'Tours', sStarts: 'Départs',
      days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], startsN: (n) => `${n} départs`,
      quality: (pc, c, k) => `${pc} % de tours propres · ${c} / ${k} tours renseignés`, noLap: 'Aucun tour renseigné.',
      coverage: (a, b) => `Collecte depuis le ${a}. Dernier jour avec une activité : ${b}. Aucun historique de tours reconstitué à partir des records.`,
      noEvent: 'La collecte n’a encore reçu aucun événement.', badPeriod: 'Choisis une période valide de 366 jours maximum.',
      loading: 'Chargement des statistiques…', e401: 'L’accès public aux statistiques n’est pas encore activé sur Supabase. Appliquer la dernière version de supabase/analytics.sql.',
      e404: 'La collecte n’est pas encore installée sur Supabase. Exécuter supabase/analytics.sql.', eHttp: (c) => `Statistiques indisponibles (HTTP ${c}). Réessaie dans un instant.`,
      updated: (h) => `Mis à jour à ${h} · comparaison avec la période précédente de même durée`, noConn: 'Connexion impossible.',
      failed: 'Actualisation échouée. Les données précédentes restent affichées.',
      csv: ['Type', 'Élément', 'Départs', 'Tours', 'Visiteurs', 'Secondes de jeu', 'Sorties de piste'],
      labels: { desktop: 'Ordinateur', mobile: 'Téléphone', tablet: 'Tablette', touch: 'Tactile', keyboard: 'Clavier / clic', wheel: 'Molette',
        gamepad: 'Manette', race: 'Course', timetrial: 'Contre-la-montre', tuning: 'Réglage', multiplayer: 'Multijoueur', f1: 'F1', gt: 'GT', proto: 'Prototypes' },
    },
    en: {
      docTitle: 'Statistics · GRIP', noData: 'No data for this period.',
      thCircuit: 'Circuit', thCar: 'Car', thLivery: 'Livery', thStarts: 'Starts', thLaps: 'Laps', thDrivers: 'Drivers', thTime: 'Time',
      kVisitors: 'Estimated unique visitors', kSessions: 'Visits', kStarts: 'Starts', kLaps: 'Laps driven', kSeconds: 'Playing time',
      kCompleted: 'Races finished', kAbandoned: 'Explicit retirements', kOfftracks: 'Offs', vsPrevious: 'vs previous period',
      audience: (n, r) => `${n} new · ${r} returning`, sVisitors: 'Visitors', sLaps: 'Laps', sStarts: 'Starts',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], startsN: (n) => `${n} starts`,
      quality: (pc, c, k) => `${pc} % clean laps · ${c} / ${k} laps with a known state`, noLap: 'No lap recorded.',
      coverage: (a, b) => `Collected since ${a}. Last day with activity: ${b}. No lap history rebuilt from the records.`,
      noEvent: 'No event has been collected yet.', badPeriod: 'Pick a valid period of 366 days at most.',
      loading: 'Loading the statistics…', e401: 'Public access to the statistics is not enabled on Supabase yet. Apply the latest supabase/analytics.sql.',
      e404: 'Collection is not installed on Supabase yet. Run supabase/analytics.sql.', eHttp: (c) => `Statistics unavailable (HTTP ${c}). Try again in a moment.`,
      updated: (h) => `Updated at ${h} · compared with the previous period of the same length`, noConn: 'Could not connect.',
      failed: 'Refresh failed. The previous data stay on screen.',
      csv: ['Type', 'Item', 'Starts', 'Laps', 'Visitors', 'Seconds played', 'Offs'],
      labels: { desktop: 'Computer', mobile: 'Phone', tablet: 'Tablet', touch: 'Touch', keyboard: 'Keyboard / click', wheel: 'Mouse wheel',
        gamepad: 'Controller', race: 'Race', timetrial: 'Time trial', tuning: 'Setup', multiplayer: 'Multiplayer', f1: 'F1', gt: 'GT', proto: 'Prototypes' },
      // le texte du HTML
      back: 'Back to the game ↗', eyebrow: 'THE GAME IN NUMBERS', h1: 'Audience & driving', intro: 'How the game is played, in numbers.',
      badge: 'Public statistics', period: 'Period', p7: 'Last 7 days', p30: 'Last 30 days', p90: 'Last 90 days', custom: 'Custom',
      from: 'From', to: 'To', circuit: 'Circuit', allTracks: 'All circuits', car: 'Car', allCars: 'All cars', refresh: 'Refresh',
      csvBtn: 'Export CSV', auto: 'Refresh every minute',
      empty: 'No activity measured over this period. The statistics will fill up with the next games.',
      daysH: 'Day by day', daysSub: 'Visitors, laps and starts · UTC days', dailyAria: 'Daily trend',
      tracksH: 'Most played circuits', tracksSub: 'Ranked by starts, then by laps', carsH: 'Most played cars', carsSub: 'Ranked by starts, then by laps',
      devicesH: 'Devices', devicesAria: 'Starts by device', controlsH: 'Controls', controlsAria: 'Starts by control',
      modesH: 'Game modes', modesAria: 'Starts by mode', catsH: 'Classes', catsAria: 'Starts by class',
      hoursH: 'When do people play?', hoursSub: 'Starts by weekday and hour · UTC', hoursAria: 'Starts by day and hour',
      liveriesH: 'Liveries', versionsH: 'Game versions', qualityH: 'Lap quality',
      qualityNote: 'A clean lap is finished without going off track. Laps whose state is unknown, notably on a multiplayer guest, are left out of this rate.',
      foot1: 'Only aggregate statistics are published: no name, e-mail, visitor identifier or individual history.',
      foot2: 'A unique visitor is a randomly identified browser: several devices or cleared storage can count several times. A visit expires after 30 minutes of inactivity. The car/circuit filters also limit the audience to the players of that selection.',
      foot3: 'Only the human driver of each screen is counted. Playing time leaves out menus, pauses and loading. Sessions never closed stay apart from explicit retirements. Indicative measures; blockers or offline play can lower the numbers.',
      charts: 'Charts:', install: 'Installation and definitions',
    },
  }[LANG];
  const labels = TXT.labels;
  document.documentElement.lang = LANG;
  document.title = TXT.docTitle;
  for (const el of document.querySelectorAll('[data-i18n]')) { const k = el.dataset.i18n === 'csv' ? 'csvBtn' : el.dataset.i18n; if (TXT[k] != null) el.textContent = TXT[k]; }
  for (const el of document.querySelectorAll('[data-i18n-aria]')) if (TXT[el.dataset.i18nAria] != null) el.setAttribute('aria-label', TXT[el.dataset.i18nAria]);
  const nf = new Intl.NumberFormat(LOC, { maximumFractionDigits: 0 });
  const num = v => nf.format(v || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration = v => v >= 3600 ? (v / 3600).toLocaleString(LOC, { maximumFractionDigits: 1 }) + ' h'
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

  function chart(id, option) {
    let c = charts.get(id);
    if (!c) { c = echarts.init($(id), null, { renderer: 'canvas' }); charts.set(id, c); }
    c.setOption({ color: palette, backgroundColor: 'transparent', textStyle: { color: '#a0afb4', fontFamily: 'system-ui' },
      aria: { enabled: true }, ...option }, true);
  }
  window.addEventListener('resize', () => charts.forEach(c => c.resize()));

  function table(headers, rows) {
    if (!rows.length) return `<p class="muted">${TXT.noData}</p>`;
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function ranking(kind) {
    const rows = report.rankings[kind] || [];
    return table([kind === 'tracks' ? TXT.thCircuit : kind === 'cars' ? TXT.thCar : TXT.thLivery, TXT.thStarts, TXT.thLaps, TXT.thDrivers, TXT.thTime], rows.map((r, i) => {
      const m = modelById(kind === 'liveries' ? r.key.split('|')[0] : r.key);
      const title = kind === 'tracks' ? trackName(r.key) : kind === 'cars' ? carName(r.key)
        : `${carName(r.key.split('|')[0])} · ${nomLivree(livreeDe(m, Number(r.key.split('|')[1])), LANG)}`;
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
    const defs = [['visitors', TXT.kVisitors], ['sessions', TXT.kSessions], ['starts', TXT.kStarts],
      ['laps', TXT.kLaps], ['seconds', TXT.kSeconds], ['completed', TXT.kCompleted],
      ['abandoned', TXT.kAbandoned], ['offtracks', TXT.kOfftracks]];
    $('kpis').innerHTML = defs.map(([key, title]) => {
      const delta = p[key] ? ((c[key] || 0) - p[key]) / p[key] * 100 : null;
      return `<section class="kpi"><h2>${title}</h2><strong>${key === 'seconds' ? duration(c[key]) : num(c[key])}</strong><small><span class="delta">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta.toLocaleString(LOC, { maximumFractionDigits: 0 }) + ' %'}</span>${TXT.vsPrevious}</small></section>`;
    }).join('');
    $('empty').hidden = !!c.visitors;
    $('audience').textContent = TXT.audience(num(r.audience.new), num(r.audience.returning));
    const days = [], daily = new Map(r.daily.map(d => [d.day, d]));
    for (let d = new Date($('from').value + 'T00:00:00Z'); date(d) <= $('to').value; d.setUTCDate(d.getUTCDate() + 1)) days.push(date(d));
    chart('daily-chart', { tooltip: { trigger: 'axis' }, legend: { textStyle: { color: '#a0afb4' } },
      grid: { left: 50, right: 45, bottom: 42, top: 45 },
      xAxis: { type: 'category', data: days.map(d => d.slice(8) + '/' + d.slice(5, 7)), boundaryGap: false },
      yAxis: [{ type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#2d383f' } } }, { type: 'value', minInterval: 1, splitLine: { show: false } }],
      series: [['visitors', TXT.sVisitors, 0], ['laps', TXT.sLaps, 1], ['starts', TXT.sStarts, 1]].map(([key, name, yAxisIndex]) => ({
        name, type: 'line', yAxisIndex, showSymbol: days.length < 15, smooth: .15,
        areaStyle: key === 'visitors' ? { opacity: .09 } : undefined, data: days.map(d => daily.get(d)?.[key] || 0) })) });
    for (const kind of ['tracks','cars','liveries']) $(kind + '-table').innerHTML = ranking(kind);
    for (const kind of ['devices','controls','modes','categories','versions']) breakdown(kind);
    const cells = new Map(r.hours.map(h => [h.day + '|' + h.hour, h.starts])), grid = [];
    for (let day = 1; day <= 7; day++) for (let hour = 0; hour < 24; hour++) grid.push([hour, day - 1, cells.get(day + '|' + hour) || 0]);
    chart('hours-chart', { tooltip: { formatter: p => `${TXT.days[p.value[1]]} ${p.value[0]} h · ${TXT.startsN(num(p.value[2]))}` },
      grid: { top: 12, bottom: 70, left: 44, right: 12 },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => h + 'h'), splitArea: { show: false } },
      yAxis: { type: 'category', data: TXT.days, inverse: true },
      visualMap: { min: 0, max: Math.max(1, ...r.hours.map(h => h.starts)), calculable: false,
        orient: 'horizontal', left: 'center', bottom: 5, textStyle: { color: '#a0afb4' }, inRange: { color: ['#253239','#497964','#f0bd63'] } },
      series: [{ type: 'heatmap', data: grid, itemStyle: { borderWidth: 2, borderColor: '#182025' } }] });
    $('lap-quality').textContent = c.known_laps ? TXT.quality(Math.round(c.clean_laps / c.known_laps * 100), num(c.clean_laps), num(c.known_laps)) : TXT.noLap;
    const displayDate = day => new Date(day + 'T00:00:00Z').toLocaleDateString(LOC, { timeZone: 'UTC' });
    $('coverage').textContent = r.first_day ? TXT.coverage(displayDate(r.first_day), displayDate(r.last_day)) : TXT.noEvent;
    $('csv').disabled = false;
  }
  async function load() {
    if (busy) return;
    const from = $('from').value, to = $('to').value;
    if (!from || !to || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) {
      $('error').textContent = TXT.badPeriod; $('error').hidden = false; return;
    }
    busy = true; const request = ++serial;
    const controls = [...$('filters').querySelectorAll('input,select,button')];
    controls.forEach(el => el.disabled = true);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    $('error').hidden = true; $('status').textContent = TXT.loading;
    try {
      const response = await fetch(`${MONDIAL_URL}/rest/v1/rpc/analytics_report`, { method: 'POST',
        headers: { apikey: MONDIAL_KEY, Authorization: `Bearer ${MONDIAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_from: from, p_to: to, p_track: $('track').value || null, p_car: $('car').value || null }), signal: controller.signal });
      if (response.status === 401 || response.status === 403) throw new Error(TXT.e401);
      if (response.status === 404) throw new Error(TXT.e404);
      if (!response.ok) throw new Error(TXT.eHttp(response.status));
      const data = await response.json();
      if (request !== serial) return;
      report = data; render();
      $('status').textContent = TXT.updated(new Date().toLocaleTimeString(LOC));
    } catch (e) { $('error').textContent = e.message || TXT.noConn; $('error').hidden = false; $('status').textContent = TXT.failed; }
    finally { clearTimeout(timeout); busy = false; controls.forEach(el => el.disabled = false); $('csv').disabled = !report; }
  }
  $('filters').onsubmit = e => { e.preventDefault(); load(); };
  setInterval(() => { if ($('auto').checked && !document.hidden && !$('dashboard').hidden) load(); }, 60000);
  $('csv').onclick = () => {
    if (!report) return;
    const rows = [TXT.csv];
    for (const [kind, values] of Object.entries(report.rankings)) for (const r of values)
      rows.push([kind, r.key, r.starts, r.laps, r.visitors, r.seconds, r.offtracks]);
    const csv = '\uFEFF' + rows.map(row => row.map(v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"','""') + '"').join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `grip-${$('from').value}-${$('to').value}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  load();
})();
