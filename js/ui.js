// Menus, race setup, career, workshop, results. Plain DOM, FR/EN.
'use strict';

const I18N = {
  fr: {
    title: 'SLOT RACER', subtitle: 'Un bouton, trois trajectoires. De vrais circuits.',
    career: 'Carrière', quickRace: 'Course rapide', timeTrial: 'Contre-la-montre', settings: 'Réglages', back: 'Retour',
    editor: 'Éditeur de circuits', workshop: 'Atelier voitures',
    howto: 'Poser le pouce n’importe où (ou n’importe quelle touche / clic) : accélérer, relâcher pour freiner. Le cadran vient se placer au-dessus du pouce. Pouce gauche (ou flèches / molette) : choisir la trajectoire — intérieure, idéale ou extérieure. Trop vite dans un virage, c’est le bac à gravier.',
    carClass: 'Catégorie', model: 'Modèle', track: 'Circuit', customTracks: 'Circuits perso', livery: 'Livrée', difficulty: 'Difficulté', easy: 'Facile', medium: 'Normal', hard: 'Difficile',
    laps: 'tours', start: 'Départ !', locked: 'Verrouillé', unlockHint: 'Termine la coupe précédente dans le top 3 pour débloquer.',
    cup: 'Coupe', races: 'courses', raceOf: (a, b) => `Course ${a} / ${b}`, standings: 'Classement', nextRace: 'Prochaine course', startRace: 'Lancer la course',
    done: 'Terminée', inProgress: 'En cours', notStarted: 'Pas commencée', resetCup: 'Recommencer cette coupe', finalPos: (p) => `Classement final : P${p}`,
    results: 'Résultats', pos: 'Pos', driver: 'Pilote', time: 'Temps', gap: 'Écart', bestLap: 'Meilleur tour', points: 'Pts', dnf: 'Non classé',
    next: 'Suivant', retry: 'Rejouer', menu: 'Menu', resume: 'Reprendre', restart: 'Recommencer', quit: 'Quitter', paused: 'Pause', endSession: 'Terminer',
    lap: 'Tour', last: 'Dernier', best: 'Meilleur', grip: 'adhérence', holdToGo: 'Maintiens une touche pour accélérer', holdToGoTouch: 'Maintiens l’écran pour accélérer', lineHintKeys: 'Flèches / molette : trajectoire', lineHintTouch: 'Pouce gauche : trajectoire',
    lineIn: 'INT', lineRace: 'IDÉALE', lineOut: 'EXT', offTrack: 'SORTIE DE PISTE !', finished: 'ARRIVÉE',
    cupComplete: 'Coupe terminée !', cupWon: 'Champion !', cupPodium: 'Podium ! Coupe suivante débloquée.', cupFailed: 'Hors du podium… retente ta chance.',
    newRecord: 'Nouveau record !', yourBest: 'Ton record', name: 'Nom du pilote', sound: 'Son', language: 'Langue', showLines: 'Guide de freinage', telemetry: 'Télémétrie (touche G)', camera: 'Vue', camFollow: 'Dessus, orientée piste', camFixed: 'Dessus, fixe', camIso: 'Isométrique', resetAll: 'Effacer la progression', resetConfirm: 'Effacer toute la progression ?',
    on: 'Activé', off: 'Coupé', playerDefault: 'Vous', allUnlocked: 'Tout est débloqué. Bravo !', careerIntro: 'Tu pars dernier à chaque course. Remonte le peloton, marque des points, débloque des catégories plus rapides.',
    lapDone: (n, t) => `Tour ${n} : ${t}`, tipTitle: 'Comment jouer', yourResult: (p) => `Tu termines P${p}`,
    ttIntro: 'Seul en piste. Bats ton meilleur tour.', noCustomTracks: 'Aucun circuit perso. Crée-en un dans l’éditeur.', deleteTrack: 'Supprimer', confirmDelete: 'Supprimer définitivement ?',
    wsIntro: 'Ajoute tes propres voitures 2D : une image PNG vue de dessus (avant vers la droite), ou un dossier de sprites Ultimate Racing 2D 2 (car_base.png, car_color.png, car_1.png…). Le calque « color » prend la couleur de ta livrée.',
    wsName: 'Nom', wsCat: 'Catégorie', wsLength: 'Longueur (m)', wsWidth: 'Largeur (m)', wsSingle: 'Image PNG unique', wsFolder: 'Dossier UR2D 2 (plusieurs PNG)', wsAdd: 'Ajouter la voiture', wsList: 'Mes voitures', wsNone: 'Aucune voiture perso pour l’instant.', wsNeedBase: 'Il faut au moins une image (car_base.png ou une image seule).', wsAdded: 'Voiture ajoutée !',
    custom: 'perso', stats: 'Vitesse / Freins / Adhérence',
  },
  en: {
    title: 'SLOT RACER', subtitle: 'One button, three lines. Real circuits.',
    career: 'Career', quickRace: 'Quick race', timeTrial: 'Time trial', settings: 'Settings', back: 'Back',
    editor: 'Track editor', workshop: 'Car workshop',
    howto: 'Thumb anywhere (or any key / click): accelerate, release to brake. The dial moves above your thumb. Left thumb (or arrows / wheel): pick the line — inside, racing or outside. Too fast into a corner and it’s the gravel.',
    carClass: 'Class', model: 'Model', track: 'Track', customTracks: 'Custom tracks', livery: 'Livery', difficulty: 'Difficulty', easy: 'Easy', medium: 'Normal', hard: 'Hard',
    laps: 'laps', start: 'Start!', locked: 'Locked', unlockHint: 'Finish the previous cup in the top 3 to unlock.',
    cup: 'Cup', races: 'races', raceOf: (a, b) => `Race ${a} / ${b}`, standings: 'Standings', nextRace: 'Next race', startRace: 'Start race',
    done: 'Complete', inProgress: 'In progress', notStarted: 'Not started', resetCup: 'Restart this cup', finalPos: (p) => `Final standing: P${p}`,
    results: 'Results', pos: 'Pos', driver: 'Driver', time: 'Time', gap: 'Gap', bestLap: 'Best lap', points: 'Pts', dnf: 'DNF',
    next: 'Next', retry: 'Retry', menu: 'Menu', resume: 'Resume', restart: 'Restart', quit: 'Quit', paused: 'Paused', endSession: 'Finish',
    lap: 'Lap', last: 'Last', best: 'Best', grip: 'grip', holdToGo: 'Hold a key to accelerate', holdToGoTouch: 'Hold anywhere to accelerate', lineHintKeys: 'Arrows / wheel: line', lineHintTouch: 'Left thumb: line',
    lineIn: 'IN', lineRace: 'RACING', lineOut: 'OUT', offTrack: 'OFF TRACK!', finished: 'FINISH',
    cupComplete: 'Cup complete!', cupWon: 'Champion!', cupPodium: 'Podium! Next cup unlocked.', cupFailed: 'Missed the podium… try again.',
    newRecord: 'New record!', yourBest: 'Your best', name: 'Driver name', sound: 'Sound', language: 'Language', showLines: 'Braking guide', telemetry: 'Telemetry (G key)', camera: 'View', camFollow: 'Top-down, track-aligned', camFixed: 'Top-down, fixed', camIso: 'Isometric', resetAll: 'Erase progress', resetConfirm: 'Erase all progress?',
    on: 'On', off: 'Off', playerDefault: 'You', allUnlocked: 'Everything unlocked. Well done!', careerIntro: 'You start every race from the back. Carve through the field, score points, unlock faster classes.',
    lapDone: (n, t) => `Lap ${n}: ${t}`, tipTitle: 'How to play', yourResult: (p) => `You finish P${p}`,
    ttIntro: 'Alone on track. Beat your best lap.', noCustomTracks: 'No custom track yet. Create one in the editor.', deleteTrack: 'Delete', confirmDelete: 'Delete permanently?',
    wsIntro: 'Add your own 2D cars: a single top-down PNG (front to the right), or an Ultimate Racing 2D 2 sprite folder (car_base.png, car_color.png, car_1.png…). The "color" layer takes your livery colour.',
    wsName: 'Name', wsCat: 'Category', wsLength: 'Length (m)', wsWidth: 'Width (m)', wsSingle: 'Single PNG image', wsFolder: 'UR2D 2 folder (several PNGs)', wsAdd: 'Add car', wsList: 'My cars', wsNone: 'No custom car yet.', wsNeedBase: 'At least one image is required (car_base.png or a single image).', wsAdded: 'Car added!',
    custom: 'custom', stats: 'Speed / Brakes / Grip',
  },
};

class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.thumbs = new Map();
    this.icons = new Map();
    this.setup = { mode: 'race', classId: 'gt', trackId: 'zandvoort' };
    this.root.addEventListener('click', (e) => this._onClick(e));
    this.root.addEventListener('change', (e) => this._onChange(e));
    this.flash = null;
  }

  get lang() { return this.app.save.lang; }
  t(key, ...args) {
    const v = (I18N[this.lang] || I18N.en)[key];
    return typeof v === 'function' ? v(...args) : (v == null ? key : v);
  }
  L(obj) { return obj[this.lang] || obj.en; }

  show(html, cls) {
    this.root.innerHTML = `<div class="screen ${cls || ''}">${html}</div>`;
    this.root.classList.remove('hidden');
  }
  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }

  // ---------- thumbnails ----------
  thumb(trackDef, size) {
    const key = trackDef.id + ':' + size;
    if (this.thumbs.has(key)) return this.thumbs.get(key);
    let url = '';
    try {
      const T = this.app.trackCache(trackDef.id);
      const c = document.createElement('canvas');
      c.width = c.height = size * 2;
      const g = c.getContext('2d');
      g.scale(2, 2);
      const b = T.bounds, w = b.maxX - b.minX, h = b.maxY - b.minY;
      const sc = (size - 16) / Math.max(w, h);
      g.translate(8 + ((size - 16) - w * sc) / 2, 8 + ((size - 16) - h * sc) / 2);
      g.scale(sc, sc); g.translate(-b.minX, -b.minY);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < T.n; i += 4) { if (i === 0) g.moveTo(T.xs[i], T.ys[i]); else g.lineTo(T.xs[i], T.ys[i]); }
      g.closePath();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 8 / sc; g.stroke();
      g.strokeStyle = '#e9e9ef'; g.lineWidth = 3.5 / sc; g.stroke();
      g.fillStyle = '#ffd400'; g.beginPath(); g.arc(T.xs[0], T.ys[0], 3.5 / sc, 0, 7); g.fill();
      url = c.toDataURL();
    } catch (e) { url = ''; }
    this.thumbs.set(key, url);
    return url;
  }

  carIcon(model, livery) {
    const key = model.id + ':' + livery.body + ':' + (model.sprite ? 's' : 'v');
    if (this.icons.has(key)) return this.icons.get(key);
    const c = document.createElement('canvas'); c.width = 160; c.height = 72;
    const g = c.getContext('2d');
    const sc = Math.min(150 / model.length, 60 / model.width);
    g.translate(80, 36); g.scale(sc, sc);
    drawCarModel(g, model, livery, {});
    const url = c.toDataURL();
    this.icons.set(key, url);
    return url;
  }

  // ---------- screens ----------
  menu() {
    const t = (k) => this.t(k);
    const save = this.app.save;
    const done = CUPS.filter((c) => cupState(save, c.id).done && cupState(save, c.id).finalPos <= 3).length;
    this.show(`
      <div class="title"><h1>${t('title')}</h1><p class="sub">${t('subtitle')}</p></div>
      <div class="menu">
        <button class="big" data-action="career">${t('career')} <small>${done}/${CUPS.length}</small></button>
        <button class="big" data-action="setup" data-mode="race">${t('quickRace')}</button>
        <button class="big" data-action="setup" data-mode="timetrial">${t('timeTrial')}</button>
        <div class="row"><button data-action="editor">${t('editor')}</button><button data-action="workshop">${t('workshop')}</button><button data-action="settings">${t('settings')}</button></div>
      </div>
      <div class="howto"><b>${t('tipTitle')}</b> — ${t('howto')}</div>
    `, 'center');
  }

  settings() {
    const t = (k) => this.t(k), s = this.app.save;
    this.show(`
      <h2>${t('settings')}</h2>
      <div class="form">
        <label>${t('name')}<input id="inp-name" maxlength="14" value="${escapeHtml(s.name)}" placeholder="${t('playerDefault')}"></label>
        <label>${t('language')}
          <select id="sel-lang"><option value="fr" ${s.lang === 'fr' ? 'selected' : ''}>Français</option><option value="en" ${s.lang === 'en' ? 'selected' : ''}>English</option></select></label>
        <label>${t('sound')}<select id="sel-sound"><option value="1" ${s.sound ? 'selected' : ''}>${t('on')}</option><option value="0" ${!s.sound ? 'selected' : ''}>${t('off')}</option></select></label>
        <label>${t('showLines')}<select id="sel-lines"><option value="0" ${s.showLines !== true ? 'selected' : ''}>${t('off')}</option><option value="1" ${s.showLines === true ? 'selected' : ''}>${t('on')}</option></select></label>
        <label>${t('telemetry')}<select id="sel-debug"><option value="0" ${s.debug !== true ? 'selected' : ''}>${t('off')}</option><option value="1" ${s.debug === true ? 'selected' : ''}>${t('on')}</option></select></label>
        <label>${t('camera')}<select id="sel-cam">${[['track', 'camFollow'], ['fixed', 'camFixed'], ['iso', 'camIso']].map(([v, k]) => `<option value="${v}" ${(s.view || 'track') === v ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
        <label>${t('difficulty')}<select id="sel-diff">${['easy', 'medium', 'hard'].map(d => `<option value="${d}" ${s.difficulty === d ? 'selected' : ''}>${t(d)}</option>`).join('')}</select></label>
      </div>
      <div class="row"><button data-action="menu">${t('back')}</button><button class="danger" data-action="resetAll">${t('resetAll')}</button></div>
    `);
  }

  setupScreen(mode) {
    const t = (k) => this.t(k), s = this.app.save, st = this.setup, app = this.app;
    st.mode = mode;
    const uc = unlockedClasses(s), ut = unlockedTracks(s);
    if (!uc.has(st.classId)) st.classId = CATEGORIES.find(c => uc.has(c.id)).id;
    const tracks = app.allTracks();
    const trackOk = (tr) => tr.custom || ut.has(tr.id);
    if (!tracks.find(tr => tr.id === st.trackId && trackOk(tr))) st.trackId = tracks.find(trackOk).id;
    const cat = categoryById(st.classId);
    const model = app.playerModelFor(cat.id);
    const trackDef = app.trackDefById(st.trackId);
    const laps = lapsFor(trackDef, cat);
    const best = s.bestLaps[`${st.trackId}|${st.classId}`];
    const livery = LIVERIES[s.livery];
    const statBar = (v, max) => `<span class="stats"><i style="width:${Math.round(v / max * 100)}%"></i></span>`;
    this.show(`
      <div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${mode === 'race' ? t('quickRace') : t('timeTrial')}</h2></div>
      <h3>${t('carClass')}</h3>
      <div class="grid classes">
        ${CATEGORIES.map(c => {
          const locked = !uc.has(c.id);
          return `<button class="card ${c.id === st.classId ? 'sel' : ''} ${locked ? 'locked' : ''}" data-action="pickClass" data-id="${c.id}" ${locked ? 'disabled' : ''}>
            <img alt="" src="${this.carIcon(modelsOf(c.id)[0], livery)}">
            <b>${this.L(c.name)}</b><small>${locked ? t('locked') : this.L(c.desc)}</small></button>`;
        }).join('')}
      </div>
      <h3>${t('model')} <span class="muted">· ${t('stats')}</span></h3>
      <div class="grid models">
        ${modelsOf(cat.id).map(m => `<button class="card ${m.id === model.id ? 'sel' : ''}" data-action="pickModel" data-id="${m.id}">
            <img alt="" src="${this.carIcon(m, livery)}"><b>${escapeHtml(m.name)}${m.custom ? ` <small>(${t('custom')})</small>` : ''}</b>
            ${statBar(m.vmax, 100)}${statBar(m.brake, 34)}${statBar(m.grip + m.df * 2500, 40)}</button>`).join('')}
      </div>
      <h3>${t('track')}</h3>
      <div class="grid tracks">
        ${TRACKS.map(tr => {
          const locked = !ut.has(tr.id);
          return `<button class="card ${tr.id === st.trackId ? 'sel' : ''} ${locked ? 'locked' : ''}" data-action="pickTrack" data-id="${tr.id}" ${locked ? 'disabled' : ''}>
            <img alt="" src="${this.thumb(tr, 90)}"><b>${tr.flag} ${tr.name}</b><small>${locked ? t('locked') : `${lapsFor(tr, cat)} ${t('laps')} · ${tr.length} m`}</small></button>`;
        }).join('')}
      </div>
      <h3>${t('customTracks')} <button class="link" data-action="editor">${t('editor')} →</button></h3>
      <div class="grid tracks">
        ${app.custom.tracks.length ? app.custom.tracks.map(tr => `<button class="card ${tr.id === st.trackId ? 'sel' : ''}" data-action="pickTrack" data-id="${tr.id}">
            <img alt="" src="${this.thumb(tr, 90)}"><b>${tr.flag || '🏁'} ${escapeHtml(tr.name)}</b><small>${lapsFor(tr, cat)} ${t('laps')}</small></button>`).join('') : `<p class="muted">${t('noCustomTracks')}</p>`}
      </div>
      <div class="row wrap">
        <div><h3>${t('livery')}</h3><div class="swatches">${LIVERIES.map((l, i) => `<button class="swatch ${i === s.livery ? 'sel' : ''}" data-action="pickLivery" data-id="${i}" style="background:${l.body};border-color:${l.accent}" title="${l.name}"></button>`).join('')}</div></div>
        ${mode === 'race' ? `<div><h3>${t('difficulty')}</h3><div class="seg">${['easy', 'medium', 'hard'].map(d => `<button class="${s.difficulty === d ? 'sel' : ''}" data-action="pickDiff" data-id="${d}">${t(d)}</button>`).join('')}</div></div>` : `<div><h3>${t('yourBest')}</h3><div class="bestlap">${best ? fmtTime(best) : '--:--.---'}</div></div>`}
      </div>
      <div class="row end"><span class="muted">${trackDef.flag || '🏁'} ${escapeHtml(trackDef.name)} · ${escapeHtml(model.name)} · ${mode === 'race' ? `${laps} ${t('laps')}` : t('ttIntro')}</span><button class="big primary" data-action="startQuick">${t('start')}</button></div>
    `, 'scroll');
  }

  careerScreen() {
    const t = (k) => this.t(k), s = this.app.save, livery = LIVERIES[s.livery];
    this.show(`
      <div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${t('career')}</h2></div>
      <p class="muted">${t('careerIntro')}</p>
      <div class="cups">
        ${CUPS.map((c, i) => {
          const unlocked = cupUnlocked(s, i), cs = cupState(s, c.id), cat = categoryById(c.classId);
          const status = !unlocked ? t('locked') : cs.done ? `${t('done')} · ${t('finalPos', cs.finalPos)}` : cs.race > 0 ? `${t('inProgress')} · ${t('raceOf', cs.race + 1, c.tracks.length)}` : t('notStarted');
          return `<button class="cup ${unlocked ? '' : 'locked'} ${cs.done && cs.finalPos <= 3 ? 'won' : ''}" data-action="cup" data-id="${c.id}" ${unlocked ? '' : 'disabled'}>
            <img alt="" src="${this.carIcon(this.app.playerModelFor(cat.id), livery)}">
            <div><b>${this.L(c.name)}</b><small>${this.L(cat.name)} · ${c.tracks.length} ${t('races')}</small><small class="status">${status}</small></div>
            <div class="medal">${cs.done && cs.finalPos <= 3 ? ['🥇', '🥈', '🥉'][cs.finalPos - 1] : unlocked ? '' : '🔒'}</div>
          </button>`;
        }).join('')}
      </div>
      ${allUnlocked(s) ? `<p class="muted">${t('allUnlocked')}</p>` : ''}
    `, 'scroll');
  }

  cupScreen(cupId) {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save, app = this.app;
    const cup = CUPS.find(c => c.id === cupId), cs = cupState(s, cupId), cat = categoryById(cup.classId);
    const table = this.standingsTable(cup, cs);
    const idx = Math.min(cs.race, cup.tracks.length - 1);
    const trackDef = app.trackDefById(cup.tracks[idx]);
    const model = app.playerModelFor(cat.id), livery = LIVERIES[s.livery];
    this.show(`
      <div class="topbar"><button data-action="career">← ${t('back')}</button><h2>${this.L(cup.name)}</h2></div>
      <div class="cols">
        <div>
          <h3>${t('standings')}</h3>${table}
          <button class="link" data-action="resetCup" data-id="${cupId}">${t('resetCup')}</button>
          <h3>${t('model')}</h3>
          <div class="grid models small">${modelsOf(cat.id).map(m => `<button class="card ${m.id === model.id ? 'sel' : ''}" data-action="pickModelCup" data-id="${m.id}" data-cup="${cupId}"><img alt="" src="${this.carIcon(m, livery)}"><b>${escapeHtml(m.name)}</b></button>`).join('')}</div>
        </div>
        <div>
          <h3>${cs.done ? t('done') : t('nextRace')} · ${t('raceOf', idx + 1, cup.tracks.length)}</h3>
          <div class="tracklist">${cup.tracks.map((id, i) => { const tr = app.trackDefById(id); return `<div class="tr ${i < cs.race || cs.done ? 'past' : i === idx ? 'now' : ''}"><img alt="" src="${this.thumb(tr, 60)}"><span>${tr.flag} ${tr.name}</span><small>${lapsFor(tr, cat)} ${t('laps')}</small></div>`; }).join('')}</div>
          ${cs.done ? '' : `<div class="row end"><button class="big primary" data-action="startCup" data-id="${cupId}">${t('startRace')} — ${trackDef.name}</button></div>`}
        </div>
      </div>
    `, 'scroll');
  }

  standingsTable(cup, cs) {
    const t = (k) => this.t(k);
    const rows = Object.entries(cs.points).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return `<p class="muted">—</p>`;
    const me = this.app.playerName();
    return `<table class="tbl"><thead><tr><th>${t('pos')}</th><th>${t('driver')}</th><th>${t('points')}</th></tr></thead><tbody>
      ${rows.map(([n, p], i) => `<tr class="${n === me ? 'me' : ''}"><td>${i + 1}</td><td>${escapeHtml(n)}</td><td>${p}</td></tr>`).join('')}</tbody></table>`;
  }

  resultsScreen(race, ctx) {
    const t = (k, ...a) => this.t(k, ...a);
    const res = race.results, p = race.player;
    const isTT = race.mode === 'timetrial';
    let head = '';
    if (isTT) head = `<h2>${t('timeTrial')} · ${escapeHtml(race.track.name)}</h2><div class="bigstat">${t('bestLap')}: ${fmtTime(p.bestLap)} ${ctx.newRecord ? `<span class="rec">${t('newRecord')}</span>` : ''}</div>`;
    else head = `<h2>${t('results')} · ${escapeHtml(race.track.name)}</h2><div class="bigstat">${t('yourResult', race.positionOf(p))} ${ctx.newRecord ? `<span class="rec">${t('newRecord')}</span>` : ''}</div>`;
    const table = isTT ? `<table class="tbl"><thead><tr><th>${t('lap')}</th><th>${t('time')}</th></tr></thead><tbody>${p.lapTimes.map((lt, i) => `<tr class="${lt === p.bestLap ? 'me' : ''}"><td>${i + 1}</td><td>${fmtTime(lt)}</td></tr>`).join('') || `<tr><td colspan="2">—</td></tr>`}</tbody></table>`
      : `<table class="tbl"><thead><tr><th>${t('pos')}</th><th>${t('driver')}</th><th>${t('model')}</th><th>${t('gap')}</th><th>${t('bestLap')}</th>${ctx.cup ? `<th>${t('points')}</th>` : ''}</tr></thead><tbody>
        ${res.map(r => `<tr class="${r.car.isPlayer ? 'me' : ''}"><td>${r.pos}</td><td><i class="dot" style="background:${r.car.livery.body}"></i>${escapeHtml(r.car.name)}</td><td class="muted">${escapeHtml(r.car.cls.name)}</td><td>${r.pos === 1 ? (r.time != null ? fmtTime(r.time) : '') : r.gap != null ? '+' + r.gap.toFixed(3) : t('dnf')}</td><td>${r.bestLap != null ? fmtTime(r.bestLap) : '—'}</td>${ctx.cup ? `<td>${r.points}</td>` : ''}</tr>`).join('')}</tbody></table>`;
    let cupPart = '';
    if (ctx.cup) {
      const cs = cupState(this.app.save, ctx.cup.id);
      let banner = '';
      if (cs.done) banner = `<div class="banner ${cs.finalPos <= 3 ? 'good' : 'bad'}">${t('cupComplete')} ${cs.finalPos === 1 ? t('cupWon') : cs.finalPos <= 3 ? t('cupPodium') : t('cupFailed')} ${t('finalPos', cs.finalPos)}</div>`;
      cupPart = `<div><h3>${t('standings')} — ${this.L(ctx.cup.name)}</h3>${this.standingsTable(ctx.cup, cs)}${banner}</div>`;
    }
    this.show(`
      ${head}
      <div class="cols"><div>${table}</div>${cupPart}</div>
      <div class="row end">
        <button data-action="menu">${t('menu')}</button>
        ${ctx.cup ? (cupState(this.app.save, ctx.cup.id).done ? `<button class="big primary" data-action="cup" data-id="${ctx.cup.id}">${t('standings')}</button>` : `<button data-action="retryRace">${t('retry')}</button><button class="big primary" data-action="startCup" data-id="${ctx.cup.id}">${t('nextRace')}</button>`) : `<button data-action="setup" data-mode="${race.mode}">${t('back')}</button><button class="big primary" data-action="retryRace">${t('retry')}</button>`}
      </div>
    `, 'scroll');
  }

  pauseScreen(race) {
    const t = (k) => this.t(k);
    this.show(`
      <h2>${t('paused')}</h2>
      <div class="menu">
        <button class="big primary" data-action="resume">${t('resume')}</button>
        ${race.mode === 'timetrial' ? `<button class="big" data-action="endTT">${t('endSession')}</button>` : ''}
        <button data-action="retryRace">${t('restart')}</button>
        <button data-action="quitRace">${t('quit')}</button>
      </div>
      <p class="muted">${t('howto')}</p>
    `, 'center overlay');
  }

  workshopScreen(msg) {
    const t = (k) => this.t(k), app = this.app, livery = LIVERIES[app.save.livery];
    const cars = app.custom.cars;
    this.show(`
      <div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${t('workshop')}</h2></div>
      <p class="muted">${t('wsIntro')}</p>
      <div class="cols">
        <div class="form">
          <label>${t('wsName')}<input id="ws-name" maxlength="24" placeholder="F40 LM"></label>
          <label>${t('wsCat')}<select id="ws-cat">${CATEGORIES.map(c => `<option value="${c.id}">${this.L(c.name)}</option>`).join('')}</select></label>
          <label>${t('wsLength')}<input id="ws-len" type="number" step="0.1" min="2" max="8" value="4.5"></label>
          <label>${t('wsWidth')}<input id="ws-wid" type="number" step="0.1" min="1" max="4" value="2"></label>
          <label>${t('wsSingle')}<input id="ws-single" type="file" accept="image/png,image/webp,image/jpeg"></label>
          <label>${t('wsFolder')}<input id="ws-folder" type="file" accept="image/png" multiple></label>
          <div class="row end"><span id="ws-msg" class="muted">${msg ? escapeHtml(msg) : ''}</span><button class="big primary" data-action="wsAdd">${t('wsAdd')}</button></div>
        </div>
        <div>
          <h3>${t('wsList')}</h3>
          ${cars.length ? `<div class="grid models">${cars.map(c => { const m = modelById(c.id); return `<div class="card"><img alt="" src="${m ? this.carIcon(m, livery) : ''}"><b>${escapeHtml(c.name)}</b><small>${this.L(categoryById(c.catId).name)}</small><button class="link danger" data-action="wsDelete" data-id="${c.id}">${t('deleteTrack')}</button></div>`; }).join('')}</div>` : `<p class="muted">${t('wsNone')}</p>`}
        </div>
      </div>
    `, 'scroll');
  }

  async _workshopAdd() {
    const t = (k) => this.t(k), app = this.app;
    const name = (document.getElementById('ws-name').value || 'Custom').trim();
    const catId = document.getElementById('ws-cat').value;
    const length = +document.getElementById('ws-len').value || 4.5;
    const width = +document.getElementById('ws-wid').value || 2;
    const single = document.getElementById('ws-single').files[0];
    const folder = Array.from(document.getElementById('ws-folder').files || []);
    const layers = { base: null, color: null, extra: [] };
    if (folder.length) {
      const extras = [];
      for (const f of folder) {
        const n = f.name.toLowerCase();
        if (!n.endsWith('.png')) continue;
        if (n === 'car_base.png' || n === 'base.png') layers.base = await readFileAsDataURL(f);
        else if (n === 'car_color.png' || n === 'main_color.png' || n === 'color.png') layers.color = await readFileAsDataURL(f);
        else if (/^car_\d+\.png$/.test(n)) extras.push({ n: +n.match(/\d+/)[0], f });
      }
      extras.sort((a, b) => a.n - b.n);
      for (const ex of extras) layers.extra.push(await readFileAsDataURL(ex.f));
      if (!layers.base && folder.length === 1) layers.base = await readFileAsDataURL(folder[0]);
    } else if (single) {
      layers.base = await readFileAsDataURL(single);
    }
    if (!layers.base) { this.workshopScreen(t('wsNeedBase')); return; }
    const def = { id: uid('car'), name, catId, length, width, layers, mul: {} };
    await Store.put('cars', def);
    await app.refreshCustom();
    this.icons.clear();
    this.workshopScreen(t('wsAdded'));
  }

  // ---------- events ----------
  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    e.stopPropagation();
    const a = btn.dataset.action, id = btn.dataset.id, app = this.app;
    app.audio.start(); app.audio.resume();
    switch (a) {
      case 'menu': app.toMenu(); break;
      case 'settings': this.settings(); break;
      case 'setup': this.setupScreen(btn.dataset.mode); break;
      case 'career': this.careerScreen(); break;
      case 'cup': this.cupScreen(id); break;
      case 'editor': location.href = 'editor.html'; break;
      case 'workshop': this.workshopScreen(); break;
      case 'wsAdd': this._workshopAdd().catch(err => this.workshopScreen(String(err))); break;
      case 'wsDelete': if (confirm(this.t('confirmDelete'))) { Store.del('cars', id).then(() => { unregisterModel(id); return app.refreshCustom(); }).then(() => this.workshopScreen()); } break;
      case 'pickClass': this.setup.classId = id; this.setupScreen(this.setup.mode); break;
      case 'pickModel': { const m = modelById(id); app.save.models[m.catId] = id; storeSave(app.save); this.setupScreen(this.setup.mode); break; }
      case 'pickModelCup': { const m = modelById(id); app.save.models[m.catId] = id; storeSave(app.save); this.cupScreen(btn.dataset.cup); break; }
      case 'pickTrack': this.setup.trackId = id; this.setupScreen(this.setup.mode); break;
      case 'pickLivery': app.save.livery = +id; storeSave(app.save); this.icons.clear(); this.setupScreen(this.setup.mode); break;
      case 'pickDiff': app.save.difficulty = id; storeSave(app.save); this.setupScreen(this.setup.mode); break;
      case 'startQuick': app.startQuick(this.setup.mode, this.setup.classId, this.setup.trackId); break;
      case 'startCup': app.startCupRace(id); break;
      case 'resetCup': delete app.save.cups[id]; storeSave(app.save); this.cupScreen(id); break;
      case 'resetAll': if (confirm(this.t('resetConfirm'))) { app.save = defaultSave(); storeSave(app.save); this.settings(); } break;
      case 'resume': app.resume(); break;
      case 'retryRace': app.retry(); break;
      case 'quitRace': app.toMenu(); break;
      case 'endTT': app.endTimeTrial(); break;
    }
  }

  _onChange(e) {
    const el = e.target, s = this.app.save;
    if (el.id === 'inp-name') { s.name = el.value.trim(); storeSave(s); }
    if (el.id === 'sel-lang') { s.lang = el.value; storeSave(s); this.settings(); }
    if (el.id === 'sel-sound') { s.sound = el.value === '1'; storeSave(s); this.app.audio.setEnabled(s.sound); }
    if (el.id === 'sel-lines') { s.showLines = el.value === '1'; storeSave(s); this.app.renderer.showLines = s.showLines; }
    if (el.id === 'sel-cam') { s.view = el.value; s.camRotate = el.value === 'track'; storeSave(s); this.app.renderer.setView(s.view); }
    if (el.id === 'sel-debug') { s.debug = el.value === '1'; storeSave(s); this.app.renderer.debug = s.debug; }
    if (el.id === 'sel-diff') { s.difficulty = el.value; storeSave(s); }
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
