// Menus, race setup, career screens, results. Plain DOM, FR/EN.
'use strict';

const I18N = {
  fr: {
    title: 'SLOT RACER', subtitle: 'Un bouton. De vrais circuits. Zéro excuse.',
    career: 'Carrière', quickRace: 'Course rapide', timeTrial: 'Contre-la-montre', settings: 'Réglages', back: 'Retour',
    howto: 'Maintiens n’importe quelle touche, le clic ou le doigt sur l’écran pour accélérer. Relâche pour freiner. Trop vite dans un virage = tout droit dans le bac à gravier.',
    carClass: 'Catégorie', track: 'Circuit', livery: 'Livrée', difficulty: 'Difficulté', easy: 'Facile', medium: 'Normal', hard: 'Difficile',
    laps: 'tours', start: 'Départ !', locked: 'Verrouillé', unlockHint: 'Termine la coupe précédente dans le top 3 pour débloquer.',
    cup: 'Coupe', raceOf: (a, b) => `Course ${a} / ${b}`, standings: 'Classement', nextRace: 'Prochaine course', startRace: 'Lancer la course',
    done: 'Terminée', inProgress: 'En cours', notStarted: 'Pas commencée', resetCup: 'Recommencer cette coupe', finalPos: (p) => `Classement final : P${p}`,
    results: 'Résultats', pos: 'Pos', driver: 'Pilote', time: 'Temps', gap: 'Écart', bestLap: 'Meilleur tour', points: 'Pts', dnf: 'Non classé',
    next: 'Suivant', retry: 'Rejouer', menu: 'Menu', resume: 'Reprendre', restart: 'Recommencer', quit: 'Quitter', paused: 'Pause', endSession: 'Terminer',
    lap: 'Tour', last: 'Dernier', best: 'Meilleur', grip: 'adhérence', holdToGo: 'Maintiens pour accélérer', offTrack: 'SORTIE DE PISTE !', finished: 'ARRIVÉE',
    cupComplete: 'Coupe terminée !', cupWon: 'Champion !', cupPodium: 'Podium ! Coupe suivante débloquée.', cupFailed: 'Hors du podium… retente ta chance.',
    newRecord: 'Nouveau record !', yourBest: 'Ton record', name: 'Nom du pilote', sound: 'Son', language: 'Langue', resetAll: 'Effacer la progression', resetConfirm: 'Effacer toute la progression ?',
    on: 'Activé', off: 'Coupé', playerDefault: 'Vous', allUnlocked: 'Tout est débloqué. Bravo !', careerIntro: 'Tu pars dernier à chaque course. Remonte le peloton, marque des points, débloque des catégories plus rapides.',
    lapDone: (n, t) => `Tour ${n} : ${t}`, tipTitle: 'Comment jouer', p: 'P', yourResult: (p) => `Tu termines P${p}`, crashes: 'sorties', progressLabel: 'Progression',
    ttIntro: 'Seul en piste. Bats ton meilleur tour.',
  },
  en: {
    title: 'SLOT RACER', subtitle: 'One button. Real circuits. No excuses.',
    career: 'Career', quickRace: 'Quick race', timeTrial: 'Time trial', settings: 'Settings', back: 'Back',
    howto: 'Hold any key, the mouse button or your finger on the screen to accelerate. Release to brake. Too fast into a corner = straight into the gravel.',
    carClass: 'Class', track: 'Track', livery: 'Livery', difficulty: 'Difficulty', easy: 'Easy', medium: 'Normal', hard: 'Hard',
    laps: 'laps', start: 'Start!', locked: 'Locked', unlockHint: 'Finish the previous cup in the top 3 to unlock.',
    cup: 'Cup', raceOf: (a, b) => `Race ${a} / ${b}`, standings: 'Standings', nextRace: 'Next race', startRace: 'Start race',
    done: 'Complete', inProgress: 'In progress', notStarted: 'Not started', resetCup: 'Restart this cup', finalPos: (p) => `Final standing: P${p}`,
    results: 'Results', pos: 'Pos', driver: 'Driver', time: 'Time', gap: 'Gap', bestLap: 'Best lap', points: 'Pts', dnf: 'DNF',
    next: 'Next', retry: 'Retry', menu: 'Menu', resume: 'Resume', restart: 'Restart', quit: 'Quit', paused: 'Paused', endSession: 'Finish',
    lap: 'Lap', last: 'Last', best: 'Best', grip: 'grip', holdToGo: 'Hold to accelerate', offTrack: 'OFF TRACK!', finished: 'FINISH',
    cupComplete: 'Cup complete!', cupWon: 'Champion!', cupPodium: 'Podium! Next cup unlocked.', cupFailed: 'Missed the podium… try again.',
    newRecord: 'New record!', yourBest: 'Your best', name: 'Driver name', sound: 'Sound', language: 'Language', resetAll: 'Erase progress', resetConfirm: 'Erase all progress?',
    on: 'On', off: 'Off', playerDefault: 'You', allUnlocked: 'Everything unlocked. Well done!', careerIntro: 'You start every race from the back. Carve through the field, score points, unlock faster classes.',
    lapDone: (n, t) => `Lap ${n}: ${t}`, tipTitle: 'How to play', p: 'P', yourResult: (p) => `You finish P${p}`, crashes: 'offs', progressLabel: 'Progress',
    ttIntro: 'Alone on track. Beat your best lap.',
  },
};

class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.thumbs = new Map();
    this.setup = { mode: 'race', classId: 'kart', trackId: 'zandvoort' };
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
    const url = c.toDataURL();
    this.thumbs.set(key, url);
    return url;
  }

  carIcon(cls, livery) {
    const c = document.createElement('canvas'); c.width = 120; c.height = 60;
    const g = c.getContext('2d');
    const fake = { cls, livery, pos: { x: 0, y: 0 }, heading: 0, throttle: false, v: 0, state: 'ok', isPlayer: false };
    g.translate(60, 30); g.scale(18, 18);
    this.app.renderer._drawCar(g, fake);
    return c.toDataURL();
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
        <button data-action="settings">${t('settings')}</button>
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
        <label>${t('difficulty')}<select id="sel-diff">${['easy', 'medium', 'hard'].map(d => `<option value="${d}" ${s.difficulty === d ? 'selected' : ''}>${t(d)}</option>`).join('')}</select></label>
      </div>
      <div class="row"><button data-action="menu">${t('back')}</button><button class="danger" data-action="resetAll">${t('resetAll')}</button></div>
    `);
  }

  setupScreen(mode) {
    const t = (k) => this.t(k), s = this.app.save, st = this.setup;
    st.mode = mode;
    const uc = unlockedClasses(s), ut = unlockedTracks(s);
    if (!uc.has(st.classId)) st.classId = CAR_CLASSES.find(c => uc.has(c.id)).id;
    if (!ut.has(st.trackId)) st.trackId = TRACKS.find(tr => ut.has(tr.id)).id;
    const cls = carClassById(st.classId);
    const trackDef = TRACKS.find(tr => tr.id === st.trackId);
    const laps = lapsFor(trackDef, cls);
    const bestKey = `${st.trackId}|${st.classId}`;
    const best = s.bestLaps[bestKey];
    this.show(`
      <div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${mode === 'race' ? t('quickRace') : t('timeTrial')}</h2></div>
      <h3>${t('carClass')}</h3>
      <div class="grid classes">
        ${CAR_CLASSES.map(c => {
          const locked = !uc.has(c.id);
          return `<button class="card ${c.id === st.classId ? 'sel' : ''} ${locked ? 'locked' : ''}" data-action="pickClass" data-id="${c.id}" ${locked ? 'disabled' : ''}>
            <img alt="" src="${this.carIcon(c, LIVERIES[s.livery])}">
            <b>${this.L(c.name)}</b><small>${locked ? t('locked') : this.L(c.desc)}</small>
            <span class="stats"><i style="width:${c.vmax / 96 * 100}%"></i></span></button>`;
        }).join('')}
      </div>
      <h3>${t('track')}</h3>
      <div class="grid tracks">
        ${TRACKS.map(tr => {
          const locked = !ut.has(tr.id);
          return `<button class="card ${tr.id === st.trackId ? 'sel' : ''} ${locked ? 'locked' : ''}" data-action="pickTrack" data-id="${tr.id}" ${locked ? 'disabled' : ''}>
            <img alt="" src="${this.thumb(tr, 90)}"><b>${tr.flag} ${tr.name}</b><small>${locked ? t('locked') : `${lapsFor(tr, cls)} ${t('laps')} · ${tr.length} m`}</small></button>`;
        }).join('')}
      </div>
      <div class="row wrap">
        <div><h3>${t('livery')}</h3><div class="swatches">${LIVERIES.map((l, i) => `<button class="swatch ${i === s.livery ? 'sel' : ''}" data-action="pickLivery" data-id="${i}" style="background:${l.body};border-color:${l.accent}" title="${l.name}"></button>`).join('')}</div></div>
        ${mode === 'race' ? `<div><h3>${t('difficulty')}</h3><div class="seg">${['easy', 'medium', 'hard'].map(d => `<button class="${s.difficulty === d ? 'sel' : ''}" data-action="pickDiff" data-id="${d}">${t(d)}</button>`).join('')}</div></div>` : `<div><h3>${t('yourBest')}</h3><div class="bestlap">${best ? fmtTime(best) : '--:--.---'}</div></div>`}
      </div>
      <div class="row end"><span class="muted">${trackDef.flag} ${trackDef.name} · ${this.L(cls.name)} · ${mode === 'race' ? `${laps} ${t('laps')}` : t('ttIntro')}</span><button class="big primary" data-action="startQuick">${t('start')}</button></div>
    `, 'scroll');
  }

  careerScreen() {
    const t = (k) => this.t(k), s = this.app.save;
    this.show(`
      <div class="topbar"><button data-action="menu">← ${t('back')}</button><h2>${t('career')}</h2></div>
      <p class="muted">${t('careerIntro')}</p>
      <div class="cups">
        ${CUPS.map((c, i) => {
          const unlocked = cupUnlocked(s, i), cs = cupState(s, c.id), cls = carClassById(c.classId);
          const status = !unlocked ? t('locked') : cs.done ? `${t('done')} · ${t('finalPos', cs.finalPos)}` : cs.race > 0 ? `${t('inProgress')} · ${t('raceOf', cs.race + 1, c.tracks.length)}` : t('notStarted');
          return `<button class="cup ${unlocked ? '' : 'locked'} ${cs.done && cs.finalPos <= 3 ? 'won' : ''}" data-action="cup" data-id="${c.id}" ${unlocked ? '' : 'disabled'}>
            <img alt="" src="${this.carIcon(cls, LIVERIES[s.livery])}">
            <div><b>${this.L(c.name)}</b><small>${this.L(cls.name)} · ${c.tracks.length} ${t('cup').toLowerCase() === 'cup' ? 'races' : 'courses'}</small><small class="status">${status}</small></div>
            <div class="medal">${cs.done && cs.finalPos <= 3 ? ['🥇', '🥈', '🥉'][cs.finalPos - 1] : unlocked ? '' : '🔒'}</div>
          </button>`;
        }).join('')}
      </div>
      ${allUnlocked(s) ? `<p class="muted">${t('allUnlocked')}</p>` : ''}
    `, 'scroll');
  }

  cupScreen(cupId) {
    const t = (k, ...a) => this.t(k, ...a), s = this.app.save;
    const cup = CUPS.find(c => c.id === cupId), cs = cupState(s, cupId), cls = carClassById(cup.classId);
    const table = this.standingsTable(cup, cs);
    const idx = Math.min(cs.race, cup.tracks.length - 1);
    const trackDef = TRACKS.find(tr => tr.id === cup.tracks[idx]);
    this.show(`
      <div class="topbar"><button data-action="career">← ${t('back')}</button><h2>${this.L(cup.name)}</h2></div>
      <div class="cols">
        <div>
          <h3>${t('standings')}</h3>${table}
          <button class="link" data-action="resetCup" data-id="${cupId}">${t('resetCup')}</button>
        </div>
        <div>
          <h3>${cs.done ? t('done') : t('nextRace')} · ${t('raceOf', idx + 1, cup.tracks.length)}</h3>
          <div class="tracklist">${cup.tracks.map((id, i) => { const tr = TRACKS.find(x => x.id === id); return `<div class="tr ${i < cs.race || cs.done ? 'past' : i === idx ? 'now' : ''}"><img alt="" src="${this.thumb(tr, 60)}"><span>${tr.flag} ${tr.name}</span><small>${lapsFor(tr, cls)} ${t('laps')}</small></div>`; }).join('')}</div>
          ${cs.done ? '' : `<div class="row end"><button class="big primary" data-action="startCup" data-id="${cupId}">${t('startRace')} — ${trackDef.name}</button></div>`}
        </div>
      </div>
    `, 'scroll');
  }

  standingsTable(cup, cs, highlight) {
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
    if (isTT) head = `<h2>${t('timeTrial')} · ${race.track.name}</h2><div class="bigstat">${t('bestLap')}: ${fmtTime(p.bestLap)} ${ctx.newRecord ? `<span class="rec">${t('newRecord')}</span>` : ''}</div>`;
    else head = `<h2>${t('results')} · ${race.track.name}</h2><div class="bigstat">${t('yourResult', race.positionOf(p))} ${ctx.newRecord ? `<span class="rec">${t('newRecord')}</span>` : ''}</div>`;
    const table = isTT ? `<table class="tbl"><thead><tr><th>${t('lap')}</th><th>${t('time')}</th></tr></thead><tbody>${p.lapTimes.map((lt, i) => `<tr class="${lt === p.bestLap ? 'me' : ''}"><td>${i + 1}</td><td>${fmtTime(lt)}</td></tr>`).join('') || `<tr><td colspan="2">—</td></tr>`}</tbody></table>`
      : `<table class="tbl"><thead><tr><th>${t('pos')}</th><th>${t('driver')}</th><th>${t('gap')}</th><th>${t('bestLap')}</th>${ctx.cup ? `<th>${t('points')}</th>` : ''}</tr></thead><tbody>
        ${res.map(r => `<tr class="${r.car.isPlayer ? 'me' : ''}"><td>${r.pos}</td><td><i class="dot" style="background:${r.car.livery.body}"></i>${escapeHtml(r.car.name)}</td><td>${r.pos === 1 ? (r.time != null ? fmtTime(r.time) : '') : r.gap != null ? '+' + r.gap.toFixed(3) : t('dnf')}</td><td>${r.bestLap != null ? fmtTime(r.bestLap) : '—'}</td>${ctx.cup ? `<td>${r.points}</td>` : ''}</tr>`).join('')}</tbody></table>`;
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
      case 'pickClass': this.setup.classId = id; this.setupScreen(this.setup.mode); break;
      case 'pickTrack': this.setup.trackId = id; this.setupScreen(this.setup.mode); break;
      case 'pickLivery': app.save.livery = +id; storeSave(app.save); this.setupScreen(this.setup.mode); break;
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
    if (el.id === 'sel-diff') { s.difficulty = el.value; storeSave(s); }
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
