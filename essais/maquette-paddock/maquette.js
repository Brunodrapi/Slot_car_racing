/* LA MAQUETTE DU PADDOCK TÉLÉPHONE — les écrans seulement, sans jeu derrière.

Un paddock sur un seul écran (circuit, voiture, trois réglages, EN PISTE), et cinq panneaux : le
circuit, le garage, plus de réglages, la difficulté, l'écran du circuit (fiche et chronos). Les
données viennent du jeu (donnees.json, outils/exporte.cjs) ; les chronos sont des exemples, calculés
depuis la longueur du circuit et la vitesse de la voiture. EN PISTE ne lance aucune course : il
résume ce qui partirait. Les choix sont gardés dans ce navigateur. */
'use strict';
(() => {
  const RACINE = '../../';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MODES = { race: 'Course rapide', timetrial: 'Contre-la-montre', training: 'Entraînement' };
  const DESCRIPTIONS = {   // à écrire : une ligne par niveau, sous son nom
    easy: 'Les adversaires freinent tôt et pardonnent les erreurs.',
    medium: 'Une course disputée, à la portée de tous.',
    hard: 'Il faut des trajectoires propres pour gagner.',
    extreme: 'Les adversaires ne laissent rien passer.',
    cauchemar: 'Le niveau du fantôme de l\'entraînement.',
  };
  let D = null;
  let etat = null;
  const CLE = 'grip-maquette-paddock';
  const defaut = () => ({ ecran: 'menu', mode: 'race', circuit: 'spa', voiture: 'porsche991gt3r', livrees: {}, tours: 5, difficulte: 'medium',
    nuit: false, degats: true, adversaires: 0, freinage: '', championnat: false, filtre: null });
  const sauve = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* navigation privée */ } };
  const lit = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; } };

  const circuit = () => D.circuits.find((c) => c.id === etat.circuit) || D.circuits[0];
  const voiture = () => D.voitures.find((v) => v.id === etat.voiture) || D.voitures[0];
  const livreeDe = (v) => Math.min(v.livrees.length - 1, etat.livrees[v.id] || 0);
  const imageDe = (v, l = livreeDe(v)) => RACINE + v.livrees[l].image;
  const categorie = (id) => D.categories.find((c) => c.id === id);
  const niveau = (id) => D.niveaux.find((n) => n.id === id) || D.niveaux[1];
  const drapeau = (c) => c.code ? `<img class="drapeau" src="${RACINE}art/interface/flags/${esc(c.code)}.svg" alt="">` : '';
  const points = (n) => `<span class="points" aria-label="difficulté ${n} sur 4">${'●'.repeat(n)}${'○'.repeat(4 - n)}</span>`;
  const metres = (m) => `${m.toLocaleString('fr-FR')} m`;
  const temps = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(3).padStart(6, '0')}`; };
  const nuitPossible = () => voiture().cat !== 'f1';
  const nuit = () => etat.nuit && nuitPossible();

  /* Les chronos d'exemple : la vitesse moyenne d'un tour, tirée de la vitesse de pointe, plus basse
  sur un circuit difficile ; le « ton record » n'existe que pour une voiture sur trois. */
  const hache = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  const chronoMonde = (v, c) => c.longueur / (v.perf.vmax / 3.6 * [0.52, 0.48, 0.45, 0.41][c.difficulte - 1] * (1 + (v.perf.adherence - 2) * 0.05)) * (0.99 + hache(v.id + c.id) * 0.03);
  const chronoPerso = (v, c) => hache(c.id + v.id + 'moi') < 0.34 ? chronoMonde(v, c) * (1.02 + hache(v.id) * 0.05) : null;

  // ---------- les écrans ----------
  const app = $('#app');
  function bandeau(titre, retour, libelle = 'Retour') {
    return `<header class="bandeau"><button class="retour" data-act="${retour}" aria-label="${esc(libelle)}">← <span>${esc(libelle)}</span></button><span class="damier" aria-hidden="true"></span>
      <h1 class="titre${titre.length > 13 ? ' long' : ''}">${esc(titre)}</h1><span class="logo"><img src="${RACINE}art/interface/logo-grip.webp" alt="GRIP"></span></header>`;
  }

  function rendMenu() {
    app.innerHTML = `<div class="menu">
      <img class="logo-grand" src="${RACINE}art/interface/logo-grip.webp" alt="GRIP — Racing the Line">
      <button class="mode rouge titre" data-act="mode" data-id="race"><img src="${RACINE}art/interface/wheel.webp" alt="">Course rapide</button>
      <button class="mode jaune titre" data-act="mode" data-id="timetrial"><img src="${RACINE}art/interface/clock.webp" alt="">Contre-la-montre</button>
      <button class="mode bleu titre" data-act="mode" data-id="training"><img src="${RACINE}art/interface/plaque-l.svg" alt="">Entraînement</button>
      <p class="avertissement"><b>Maquette du paddock téléphone.</b> Les écrans seulement : aucune course ne part. Les circuits, voitures et livrées sont ceux du jeu ; les chronos sont des exemples.</p>
    </div>`;
  }

  function rendPaddock() {
    const c = circuit(), v = voiture(), l = livreeDe(v), cat = categorie(v.cat);
    const course = etat.mode === 'race';
    let pastilles;
    const jourNuit = `<button class="pastille" data-act="nuit" ${nuitPossible() ? '' : 'disabled'} aria-pressed="${nuit()}"><span class="lib">Moment</span><b>${nuit() ? '☾ Nuit' : '☀ Jour'}</b>${nuitPossible() ? '' : '<span class="note">Les F1 roulent de jour</span>'}</button>`;
    if (course) {
      pastilles = `<div class="pastilles">
        <div class="compteur" role="group" aria-label="Tours"><button data-act="tours" data-id="-1" aria-label="Un tour de moins" ${etat.tours <= 1 ? 'disabled' : ''}>−</button><div><span class="lib">Tours</span><b>${etat.tours}</b></div><button data-act="tours" data-id="1" aria-label="Un tour de plus" ${etat.tours >= 99 ? 'disabled' : ''}>+</button></div>
        <button class="pastille" data-act="feuille" data-id="difficulte"><span class="lib">Difficulté ▾</span><b>${esc(niveau(etat.difficulte).nom)}</b></button>
        ${jourNuit}</div>`;
    } else if (etat.mode === 'timetrial') {
      const monde = chronoMonde(v, c), perso = chronoPerso(v, c);
      pastilles = `<div class="pastilles deux"><button class="pastille" data-act="page-circuit"><span class="lib">Record à battre</span><b class="monde" style="color:#c9a7ff">${temps(monde)}</b><span class="note">${perso ? 'Ton record ' + temps(perso) : 'Pas encore de tour à toi'} · exemple</span></button>${jourNuit}</div>`;
    } else {
      pastilles = `<div class="pastilles deux"><div class="pastille" style="clip-path:none"><span class="lib">Avec toi</span><b style="font-size:16px">Fantôme et guide</b><span class="note">Ta voiture au niveau Cauchemar, sur la ligne idéale</span></div>${jourNuit}</div>`;
    }
    app.innerHTML = `${bandeau(MODES[etat.mode], 'menu')}
      <main class="paddock">
        <button class="carte carte-circuit ${nuit() ? 'nuit' : ''}" data-act="feuille" data-id="circuits" style="background-image:url('${RACINE}${esc(c.art)}')" aria-label="Circuit : ${esc(c.nom)}. Toucher pour changer.">
          <img class="trace" src="${esc(nuit() ? c.traceNuit : c.trace)}" alt="">
          <span class="changer">Changer</span>
          <span class="bandeau-nom"><span class="nom titre">${esc(c.nom)}</span>${drapeau(c)}<small>${metres(c.longueur)} · ${points(c.difficulte)}</small></span>
        </button>
        <button class="info" data-act="page-circuit" aria-label="Fiche et chronos du circuit" style="top:calc(52px + var(--haut) + 18px);left:18px;position:absolute">i</button>
        <button class="carte carte-garage" data-act="feuille" data-id="garage" aria-label="Voiture : ${esc(v.nom)}. Toucher pour ouvrir le garage.">
          <img class="voiture-img" src="${imageDe(v)}" alt="">
          <span class="changer">Garage</span>
          <span class="bandeau-nom"><span class="nom titre">${esc(v.nom)}</span><small>${esc(cat ? cat.nom : '')}</small></span>
        </button>
        <div class="livree-barre"><button data-act="livree" data-id="-1" aria-label="Livrée précédente" ${v.livrees.length < 2 ? 'disabled' : ''}>‹</button><span>${esc(v.livrees[l].nom)}</span><button data-act="livree" data-id="1" aria-label="Livrée suivante" ${v.livrees.length < 2 ? 'disabled' : ''}>›</button></div>
        ${pastilles}
        <div class="liens"><button data-act="feuille" data-id="reglages">Plus de réglages</button><button data-act="page-circuit">Chronos et fiche du circuit</button></div>
      </main>
      <footer class="barre-bas">${course ? `<button class="chip" data-act="feuille" data-id="championnat" aria-pressed="${etat.championnat}">Championnat${etat.championnat ? ' ✓' : ''}</button>` : ''}<button class="enpiste" data-act="enpiste">En piste ! →</button></footer>`;
  }

  function rend() {
    if (etat.ecran === 'menu') rendMenu(); else rendPaddock();
    sauve();
  }

  // ---------- les feuilles ----------
  const pile = [];   // les feuilles et pages ouvertes, la dernière au-dessus
  const zone = $('#feuilles');
  function ouvreFeuille(id, titre, contenu, taille = 'haute') {
    const voile = document.createElement('div'); voile.className = 'voile';
    const f = document.createElement('section');
    f.className = `feuille ${taille}`; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', titre); f.dataset.id = id;
    f.innerHTML = `<div class="prise" aria-hidden="true"></div><header><h2 class="titre">${esc(titre)}</h2><button class="fermer" data-act="fermer">Fermer</button></header><div class="corps"></div>`;
    zone.append(voile, f);
    const entree = { id, f, voile, contenu, type: 'feuille' };
    pile.push(entree);
    remplit(entree);
    voile.addEventListener('click', () => history.back());
    glisse(f);
    requestAnimationFrame(() => { voile.classList.add('ouvert'); f.classList.add('ouverte'); });
    history.pushState({ maquette: pile.length }, '');
    setTimeout(() => { const b = f.querySelector('.corps button, .corps summary'); (b || f.querySelector('.fermer')).focus({ preventScroll: true }); }, 280);
  }
  function remplit(entree) {
    const corps = entree.f.querySelector('.corps'), haut = corps.scrollTop;
    corps.innerHTML = entree.contenu();
    corps.scrollTop = haut;
  }
  function fermeDessus() {
    const e = pile.pop(); if (!e) return;
    if (e.type === 'page') { e.el.classList.remove('ouverte'); setTimeout(() => e.el.remove(), 260); return; }
    e.f.classList.remove('ouverte'); e.voile.classList.remove('ouvert');
    setTimeout(() => { e.f.remove(); e.voile.remove(); }, 260);
  }
  window.addEventListener('popstate', () => { if (pile.length) fermeDessus(); });
  // une feuille se ferme d'un geste vers le bas, pris sur sa prise ou son titre
  function glisse(f) {
    let y0 = null, dy = 0;
    const debut = (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; f.style.transition = 'none'; e.currentTarget.setPointerCapture?.(e.pointerId); };
    const bouge = (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); f.style.transform = `translate(-50%, ${dy}px)`; };
    const fin = () => { if (y0 === null) return; y0 = null; f.style.transition = ''; f.style.transform = ''; if (dy > 90) history.back(); };
    for (const el of [f.querySelector('.prise'), f.querySelector('header')]) {
      el.addEventListener('pointerdown', debut); el.addEventListener('pointermove', bouge);
      el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
    }
  }
  const rafraichit = () => { for (const e of pile) if (e.type === 'feuille') remplit(e); else e.rend(); rend(); };

  // le panneau Circuit : les quatorze en grille
  const contenuCircuits = () => `<div class="grille-circuits">${D.circuits.map((c) => `<button class="vignette ${c.id === etat.circuit ? 'sel' : ''}" data-act="circuit" data-id="${esc(c.id)}" aria-pressed="${c.id === etat.circuit}">
      <span class="art" style="background-image:url('${RACINE}${esc(c.art)}')"><img src="${esc(c.trace)}" alt=""></span>
      <b>${esc(c.nom)}</b><small>${drapeau(c)} ${esc(c.pays)} · ${metres(c.longueur)} · ${points(c.difficulte)}</small></button>`).join('')}</div>`;

  // le garage : la voiture en grand, ses livrées, cinq barres sur une échelle commune, puis la grille
  let voitureAvant = null;
  const STATS = [
    ['Vitesse max.', (v) => v.perf.vmax, (x) => `${x} km/h`, 1],
    ['Adhérence', (v) => v.perf.adherence, (x) => `${x.toFixed(2).replace('.', ',')} g`, 1],
    ['Accélération', (v) => v.perf.acceleration, (x) => `${x.toFixed(1).replace('.', ',')} s`, -1],
    ['Poids', (v) => v.poids || 0, (x) => x ? `≈ ${x.toLocaleString('fr-FR')} kg` : '—', 1],
    ['Freinage', (v) => v.perf.freinage, (x) => `${x.toFixed(1).replace('.', ',')} m`, -1],
  ];
  const part = (stat, v) => {
    const vals = D.voitures.map(stat[1]).filter((x) => x > 0), min = Math.min(...vals), max = Math.max(...vals), x = stat[1](v);
    if (!(x > 0) || max === min) return 0;
    const r = stat[3] > 0 ? (x - min) / (max - min) : (max - x) / (max - min);
    return 0.1 + 0.9 * r;
  };
  function contenuGarage() {
    const v = voiture(), l = livreeDe(v), cat = categorie(v.cat);
    const filtre = etat.filtre || v.cat;
    const avant = voitureAvant && voitureAvant !== v.id ? D.voitures.find((x) => x.id === voitureAvant) : null;
    const liste = D.voitures.filter((x) => filtre === 'all' || x.cat === filtre);
    return `<div class="garage-tete"><img src="${imageDe(v)}" alt=""></div>
      <div class="garage-nom"><b class="titre">${esc(v.nom)}</b><small>${esc(cat ? cat.nom : '')} · ${esc(v.livrees[l].nom)}</small></div>
      ${v.livrees.length > 1 ? `<div class="livrees" role="group" aria-label="Livrées">${v.livrees.map((lv, i) => `<button class="${i === l ? 'sel' : ''}" data-act="livree-n" data-id="${i}" aria-label="${esc(lv.nom)}" aria-pressed="${i === l}"><img src="${imageDe(v, i)}" alt=""></button>`).join('')}</div>` : ''}
      <dl class="stats">${STATS.map((s) => `<div><dt>${s[0]}</dt><dd class="jauge" style="margin:0"><i style="width:${(part(s, v) * 100).toFixed(1)}%"></i>${avant ? `<u style="left:calc(${(part(s, avant) * 100).toFixed(1)}% - 1px)"></u>` : ''}</dd><dd>${s[2](s[1](v))}</dd></div>`).join('')}</dl>
      ${avant ? `<p class="stats-legende">Trait rouge : la ${esc(avant.nom)}, ta voiture en ouvrant le garage.</p>` : '<p class="stats-legende">Les barres comparent les 35 voitures du jeu sur une même échelle.</p>'}
      <div class="segments" role="group" aria-label="Catégorie">${[['all', 'Toutes'], ...D.categories.map((c) => [c.id, c.nom])].map(([id, nom]) => `<button data-act="filtre" data-id="${id}" aria-pressed="${filtre === id}">${esc(nom)}</button>`).join('')}</div>
      <div class="grille-voitures">${liste.map((x) => `<button class="${x.id === v.id ? 'sel' : ''}" data-act="voiture" data-id="${esc(x.id)}" aria-pressed="${x.id === v.id}"><img src="${imageDe(x)}" alt=""><b>${esc(x.nom)}</b></button>`).join('')}</div>`;
  }

  // plus de réglages : un contrôle par nature de réglage
  const contenuReglages = () => {
    const course = etat.mode === 'race';
    return `${course ? `<button class="ligne" role="switch" aria-checked="${etat.degats}" data-act="degats"><span><b>Dégâts</b><small>Les chocs coûtent de la vitesse. On répare aux stands.</small></span><span class="interrupteur" aria-hidden="true"></span></button>
      <div class="ligne"><span><b>Adversaires</b><small>Auto, ou de 1 à 11.</small></span><span class="pas"><button data-act="adversaires" data-id="-1" aria-label="Un adversaire de moins" ${etat.adversaires <= 0 ? 'disabled' : ''}>−</button><span>${etat.adversaires || 'Auto'}</span><button data-act="adversaires" data-id="1" aria-label="Un adversaire de plus" ${etat.adversaires >= 11 ? 'disabled' : ''}>+</button></span></div>` : ''}
      <button class="ligne" data-act="feuille" data-id="freinage"><span><b>Freinage</b><small>Propre à ce circuit et à cette voiture.</small></span><span class="valeur">${etat.freinage ? esc(etat.freinage) : 'Par défaut'} ›</span></button>
      <div class="ligne"><span><b>Régler le freinage</b><small>Des tours d'essai pour trouver ton point de freinage.</small></span><button class="noir" data-act="regler">Régler</button></div>`;
  };
  const contenuFreinage = () => `<div class="choix">${[['', 'Par défaut', 'Le freinage de la voiture, sans réglage.'], ['Tardif', 'Tardif', 'Un réglage enregistré (exemple).'], ['Prudent', 'Prudent', 'Un autre réglage enregistré (exemple).']].map(([id, nom, txt]) => `<button class="${etat.freinage === id ? 'sel' : ''}" data-act="freinage" data-id="${id}"><span><b>${nom}</b><small>${txt}</small></span></button>`).join('')}</div>`;
  const contenuDifficulte = () => `<div class="choix">${D.niveaux.map((n) => `<button class="${n.id === etat.difficulte ? 'sel' : ''}" data-act="difficulte" data-id="${n.id}" aria-pressed="${n.id === etat.difficulte}"><span><b>${esc(n.nom)}</b><small>${esc(DESCRIPTIONS[n.id] || '')}</small></span></button>`).join('')}</div>`;
  const contenuChampionnat = () => `<p>Dans le jeu, l'écran du championnat s'ouvre ici : le calendrier des manches et les points. Il n'est pas dans cette maquette.</p>
      <button class="ligne" role="switch" aria-checked="${etat.championnat}" data-act="championnat"><span><b>Championnat actif</b><small>EN PISTE lancerait la manche suivante.</small></span><span class="interrupteur" aria-hidden="true"></span></button>`;

  // l'écran du circuit : quatre chiffres, les détails repliés, les chronos par catégorie
  let filtreChronos = 'all';
  function ouvrePage() {
    const el = document.createElement('div'); el.className = 'page-circuit';
    document.body.append(el);
    const entree = { type: 'page', el, rend: () => rendPage(el) };
    pile.push(entree);
    rendPage(el);
    requestAnimationFrame(() => el.classList.add('ouverte'));
    history.pushState({ maquette: pile.length }, '');
  }
  function rendPage(el) {
    const c = circuit(), v = voiture();
    const haut = el.querySelector('.defile')?.scrollTop || 0;
    const liste = D.voitures.filter((x) => filtreChronos === 'all' || x.cat === filtreChronos)
      .map((x) => ({ x, monde: chronoMonde(x, c), perso: chronoPerso(x, c) })).sort((a, b) => a.monde - b.monde);
    const record = liste.length ? liste[0] : null;
    el.innerHTML = `<div class="app">${bandeau(c.nom, 'fermer', 'Paddock')}
      <div class="defile">
        <div class="carte ${nuit() ? 'nuit' : ''}" style="background-image:url('${RACINE}${esc(c.art)}')"><img class="trace" src="${esc(nuit() ? c.traceNuit : c.trace)}" alt=""><span class="bandeau-nom"><span class="nom titre">${esc(c.pays)}</span>${drapeau(c)}<small>difficulté ${points(c.difficulte)}</small></span></div>
        <dl class="faits">
          <div><dt>Longueur</dt><dd>${metres(c.longueur)}</dd></div>
          <div><dt>Virages</dt><dd>${c.virages}</dd></div>
          <div><dt>Record du circuit</dt><dd class="monde">${record ? temps(record.monde) : '—'}<small>${record ? esc(record.x.nom) + ' · exemple' : ''}</small></dd></div>
          <div><dt>Mes tours</dt><dd>${Math.round(hache(c.id) * 40)}<small>exemple</small></dd></div>
        </dl>
        <details class="plus"><summary>Plus de détails</summary><dl>
          <div><dt>Rayon minimal</dt><dd>${c.rayon ? String(c.rayon).replace('.', ',') + ' m' : '—'}</dd></div>
          <div><dt>Plus longue ligne droite</dt><dd>${c.droite ? metres(c.droite) : '—'}</dd></div>
          <div><dt>Vitesse de pointe</dt><dd>${c.pointe ? `${c.pointe.kmh} km/h · ${esc(c.pointe.voiture)}` : '—'}</dd></div>
          <div><dt>Tours de tous les pilotes</dt><dd>—</dd></div>
        </dl></details>
        <section class="chronos"><h2 class="titre">Chronos du circuit</h2>
          <div class="segments" role="group" aria-label="Catégorie">${[['all', 'Toutes'], ...D.categories.map((k) => [k.id, k.nom])].map(([id, nom]) => `<button data-act="filtre-chronos" data-id="${id}" aria-pressed="${filtreChronos === id}">${esc(nom)}</button>`).join('')}</div>
          <div class="chronos-lignes"><div class="chronos-tete"><span></span><span>Voiture</span><span>Ton record</span><span>Monde</span></div>
            ${liste.map(({ x, monde, perso }) => `<div class="chrono" ${x.id === v.id ? 'style="border:2px solid var(--rouge)"' : ''}><img src="${imageDe(x)}" alt=""><b>${esc(x.nom)}</b><span>${perso ? temps(perso) : '—'}</span><span class="monde">${temps(monde)}</span></div>`).join('')}
          </div>
          <p class="exemple">Chronos d'exemple : la maquette n'est pas reliée au tableau mondial.</p>
        </section>
      </div></div>`;
    el.querySelector('.defile').scrollTop = haut;
  }

  // ---------- le départ, sans course ----------
  function depart() {
    const c = circuit(), v = voiture(), course = etat.mode === 'race';
    const lignes = [['Mode', MODES[etat.mode]], ['Circuit', c.nom], ['Voiture', v.nom], ['Livrée', v.livrees[livreeDe(v)].nom], ['Moment', nuit() ? 'Nuit' : 'Jour'],
      ...(course ? [['Tours', etat.tours], ['Difficulté', niveau(etat.difficulte).nom], ['Adversaires', etat.adversaires || 'Auto'], ['Dégâts', etat.degats ? 'Activés' : 'Coupés'], ['Championnat', etat.championnat ? 'Manche suivante' : 'Non']] : []),
      ['Freinage', etat.freinage || 'Par défaut']];
    const el = document.createElement('div'); el.className = 'depart'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="boite"><h2 class="titre">En piste !</h2><p>La course partirait ici. C'est une maquette : pas de jeu derrière.</p>
      <dl>${lignes.map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>
      <button class="enpiste" style="margin:6px 0 0" data-act="retour-depart">← Paddock</button></div>`;
    document.body.append(el);
    el.querySelector('button').focus();
  }

  let minuteur = 0;
  function toast(txt) { const t = $('#toast'); t.textContent = txt; t.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(() => { t.hidden = true; }, 3200); }

  // ---------- les actions ----------
  const FEUILLES = {
    circuits: ['Circuit', contenuCircuits, 'haute'],
    garage: ['Garage', contenuGarage, 'haute'],
    reglages: ['Plus de réglages', contenuReglages, 'moyenne'],
    freinage: ['Freinage', contenuFreinage, 'moyenne'],
    difficulte: ['Difficulté', contenuDifficulte, 'moyenne'],
    championnat: ['Championnat', contenuChampionnat, 'moyenne'],
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const id = b.dataset.id, v = voiture();
    switch (b.dataset.act) {
      case 'mode': etat.mode = id; etat.ecran = 'paddock'; rend(); break;
      case 'menu': etat.ecran = 'menu'; rend(); break;
      case 'feuille': if (id === 'garage') { voitureAvant = etat.voiture; etat.filtre = null; } ouvreFeuille(id, ...FEUILLES[id]); break;
      case 'fermer': history.back(); break;
      case 'page-circuit': ouvrePage(); break;
      case 'circuit': etat.circuit = id; rend(); history.back(); break;
      case 'voiture': etat.voiture = id; rafraichit(); break;
      case 'filtre': etat.filtre = id; rafraichit(); break;
      case 'filtre-chronos': filtreChronos = id; rafraichit(); break;
      case 'livree': etat.livrees[v.id] = (livreeDe(v) + Number(id) + v.livrees.length) % v.livrees.length; rafraichit(); break;
      case 'livree-n': etat.livrees[v.id] = Number(id); rafraichit(); break;
      case 'tours': etat.tours = Math.max(1, Math.min(99, etat.tours + Number(id))); rend(); break;
      case 'nuit': etat.nuit = !etat.nuit; rafraichit(); break;
      case 'difficulte': etat.difficulte = id; rend(); history.back(); break;
      case 'degats': etat.degats = !etat.degats; rafraichit(); break;
      case 'adversaires': etat.adversaires = Math.max(0, Math.min(11, etat.adversaires + Number(id))); rafraichit(); break;
      case 'freinage': etat.freinage = id; rafraichit(); history.back(); break;
      case 'championnat': etat.championnat = !etat.championnat; rafraichit(); break;
      case 'regler': toast('Dans le jeu : la course part en mode RÉGLER, des tours d\'essai pour régler le freinage de ce circuit avec cette voiture.'); break;
      case 'enpiste': depart(); break;
      case 'retour-depart': b.closest('.depart').remove(); break;
    }
  });

  fetch('donnees.json').then((r) => r.json()).then((d) => {
    D = d;
    etat = Object.assign(defaut(), lit() || {});
    if (!D.circuits.some((c) => c.id === etat.circuit)) etat.circuit = D.circuits[0].id;
    if (!D.voitures.some((v) => v.id === etat.voiture)) etat.voiture = D.voitures[0].id;
    rend();
  }).catch(() => { app.innerHTML = '<p style="padding:20px">Les données de la maquette n\'ont pas pu être lues (donnees.json).</p>'; });
})();
