/* LA MAQUETTE DU PADDOCK TÉLÉPHONE — les écrans seulement, sans jeu derrière.

Un paddock sur un seul écran (circuit, voiture, trois réglages, EN PISTE) et ses panneaux : le
circuit, le garage, plus de réglages, la difficulté, l'écran du circuit (fiche et chronos). Puis le
championnat (calendrier, séances, grille, classement) et le multijoueur (entrée, table, réglages de
l'hôte). Les données viennent du jeu (donnees.json, outils/exporte.cjs) ; les chronos, les arrivées et
les amis de la table sont simulés. Aucune course ne part. Les choix sont gardés dans ce navigateur. */
'use strict';
(() => {
  const RACINE = '../../';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MODES = { race: 'Course rapide', timetrial: 'Contre-la-montre', training: 'Entraînement' };
  const FORMATS = { race: 'Course', duel: 'Duel', ghost: 'Contre-la-montre' };
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
  const champVide = () => ({ actif: false, calendrier: [], essais: 0, qualifs: 0, place: 0, index: 0, points: {}, fini: null });
  const defaut = () => ({ ecran: 'menu', mode: 'race', circuit: 'spa', voiture: 'porsche991gt3r', livrees: {}, tours: 5, difficulte: 'medium',
    nuit: false, degats: true, adversaires: 0, freinage: '', filtre: null, champ: champVide() });
  const sauve = () => { try { localStorage.setItem(CLE, JSON.stringify({ ...etat, table: null })); } catch (e) { /* navigation privée */ } };
  const lit = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; } };

  const circuitPar = (id) => D.circuits.find((c) => c.id === id) || D.circuits[0];
  const voiturePar = (id) => D.voitures.find((v) => v.id === id) || D.voitures[0];
  const champEnCours = () => etat.mode === 'race' && etat.champ.actif && etat.champ.calendrier.length && etat.ecran === 'paddock';
  const manche = () => etat.champ.calendrier[Math.min(etat.champ.index, etat.champ.calendrier.length - 1)];
  const circuit = () => etat.table ? circuitPar(etat.table.reglages.circuit) : champEnCours() ? circuitPar(manche().circuit) : circuitPar(etat.circuit);
  const voiture = () => voiturePar(etat.voiture);
  const livreeDe = (v) => Math.min(v.livrees.length - 1, etat.livrees[v.id] || 0);
  const imageDe = (v, l = livreeDe(v)) => RACINE + v.livrees[l].image;
  const categorie = (id) => D.categories.find((c) => c.id === id);
  const niveau = (id) => D.niveaux.find((n) => n.id === id) || D.niveaux[1];
  const drapeau = (c) => c.code ? `<img class="drapeau" src="${RACINE}art/interface/flags/${esc(c.code)}.svg" alt="">` : '';
  const points = (n) => `<span class="points" aria-label="difficulté ${n} sur 4">${'●'.repeat(n)}${'○'.repeat(4 - n)}</span>`;
  const metres = (m) => `${m.toLocaleString('fr-FR')} m`;
  const pts = (x) => String(+x.toFixed(1)).replace('.', ',');
  const temps = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(3).padStart(6, '0')}`; };
  const nuitDemandee = () => etat.table ? etat.table.reglages.nuit : etat.nuit;
  const nuitPossible = () => voiture().cat !== 'f1';
  const nuit = () => nuitDemandee() && nuitPossible();

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
      <button class="mode vert titre" data-act="multi"><img src="${RACINE}art/interface/helmets.webp" alt="">Multijoueur</button>
      <p class="avertissement"><b>Maquette des écrans téléphone.</b> Aucune course ne part. Les circuits, voitures et livrées sont ceux du jeu ; les chronos, les arrivées et les amis du multijoueur sont simulés.</p>
    </div>`;
  }

  // la carte du circuit et celle de la voiture, partagées par le paddock et la table
  function carteCircuit(c, { acte = 'feuille', id = 'circuits', etiquette = 'Changer', libelle } = {}) {
    return `<button class="carte carte-circuit ${nuit() ? 'nuit' : ''}" data-act="${acte}" data-id="${id}" style="background-image:url('${RACINE}${esc(c.art)}')" aria-label="${esc(libelle || 'Circuit : ' + c.nom + '. Toucher pour changer.')}">
        <img class="trace" src="${esc(nuit() ? c.traceNuit : c.trace)}" alt="">
        ${etiquette ? `<span class="changer">${esc(etiquette)}</span>` : ''}
        <span class="bandeau-nom"><span class="nom titre">${esc(c.nom)}</span>${drapeau(c)}<small>${metres(c.longueur)} · ${points(c.difficulte)}</small></span>
      </button>`;
  }
  function carteVoiture(v, petite = false) {
    const l = livreeDe(v), cat = categorie(v.cat);
    return `<button class="carte carte-garage${petite ? ' petite' : ''}" data-act="feuille" data-id="garage" aria-label="Voiture : ${esc(v.nom)}. Toucher pour ouvrir le garage.">
        <img class="voiture-img" src="${imageDe(v)}" alt="">
        <span class="changer">Garage</span>
        <span class="bandeau-nom"><span class="nom titre">${esc(v.nom)}</span><small>${esc(cat ? cat.nom : '')}</small></span>
      </button>
      <div class="livree-barre"><button data-act="livree" data-id="-1" aria-label="Livrée précédente" ${v.livrees.length < 2 ? 'disabled' : ''}>‹</button><span>${esc(v.livrees[l].nom)}</span><button data-act="livree" data-id="1" aria-label="Livrée suivante" ${v.livrees.length < 2 ? 'disabled' : ''}>›</button></div>`;
  }

  function rendPaddock() {
    const c = circuit(), v = voiture();
    const course = etat.mode === 'race', champ = champEnCours();
    const ch = etat.champ;
    let pastilles;
    const jourNuit = `<button class="pastille" data-act="nuit" ${nuitPossible() ? '' : 'disabled'} aria-pressed="${nuit()}"><span class="lib">Moment</span><b>${nuit() ? '☾ Nuit' : '☀ Jour'}</b>${nuitPossible() ? '' : '<span class="note">Les F1 roulent de jour</span>'}</button>`;
    if (course) {
      const tours = champ ? manche().tours : etat.tours;
      pastilles = `<div class="pastilles">
        <div class="compteur" role="group" aria-label="Tours"><button data-act="tours" data-id="-1" aria-label="Un tour de moins" ${champ || tours <= 1 ? 'disabled' : ''}>−</button><div><span class="lib">Tours</span><b>${tours}</b></div><button data-act="tours" data-id="1" aria-label="Un tour de plus" ${champ || tours >= 99 ? 'disabled' : ''}>+</button></div>
        <button class="pastille" data-act="feuille" data-id="difficulte"><span class="lib">Difficulté ▾</span><b>${esc(niveau(etat.difficulte).nom)}</b></button>
        ${jourNuit}</div>`;
    } else if (etat.mode === 'timetrial') {
      const monde = chronoMonde(v, c), perso = chronoPerso(v, c);
      pastilles = `<div class="pastilles deux"><button class="pastille" data-act="page-circuit"><span class="lib">Record à battre</span><b style="color:#c9a7ff">${temps(monde)}</b><span class="note">${perso ? 'Ton record ' + temps(perso) : 'Pas encore de tour à toi'} · exemple</span></button>${jourNuit}</div>`;
    } else {
      pastilles = `<div class="pastilles deux"><div class="pastille" style="clip-path:none"><span class="lib">Avec toi</span><b style="font-size:16px">Fantôme et guide</b><span class="note">Ta voiture au niveau Cauchemar, sur la ligne idéale</span></div>${jourNuit}</div>`;
    }
    const carteC = champ ? carteCircuit(c, { acte: 'page-champ', id: '', etiquette: `Course ${ch.index + 1}/${ch.calendrier.length}`, libelle: `Championnat, course ${ch.index + 1} sur ${ch.calendrier.length} : ${c.nom}. Toucher pour voir le championnat.` }) : carteCircuit(c);
    app.innerHTML = `${bandeau(MODES[etat.mode], 'menu')}
      <main class="paddock">
        ${carteC}
        <button class="info" data-act="page-circuit" aria-label="Fiche et chronos du circuit" style="top:calc(52px + var(--haut) + 18px);left:18px;position:absolute">i</button>
        ${carteVoiture(v)}
        ${pastilles}
        <div class="liens"><button data-act="feuille" data-id="reglages">Plus de réglages</button><button data-act="page-circuit">Chronos et fiche du circuit</button></div>
      </main>
      <footer class="barre-bas">${course ? `<button class="chip" data-act="page-champ" aria-pressed="${!!champ}">${champ ? `Championnat ${ch.index + 1}/${ch.calendrier.length}` : 'Championnat'}</button>` : ''}<button class="enpiste" data-act="enpiste">En piste ! →</button></footer>`;
  }

  // ---------- le multijoueur : l'entrée ----------
  function rendMulti() {
    app.innerHTML = `${bandeau('Multijoueur', 'menu')}
      <main class="multi">
        <p class="intro">Une table, jusqu'à huit pilotes, et des voitures de l'IA pour compléter la grille. L'un la crée, les autres la rejoignent avec son code.</p>
        <button class="gros rouge titre" data-act="table-creer">Créer une table</button>
        <section class="bloc rejoindre" aria-labelledby="rej"><h2 id="rej" class="titre">Rejoindre une table</h2>
          <label for="code">Le code que l'hôte t'a donné</label>
          <input id="code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD" aria-describedby="rej-aide">
          <div class="deux"><button class="gros noir titre" data-act="table-rejoindre" disabled>Rejoindre</button><button class="gros clair titre" data-act="table-regarder" disabled>Regarder</button></div>
          <p id="rej-aide" class="aide">« Regarder » : tu suis la course sans piloter.</p>
        </section>
        <button class="ligne" data-act="discord"><span><b>Trouver des joueurs</b><small>Le Discord de GRIP, pour trouver une table.</small></span><span class="valeur">›</span></button>
      </main>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      champ.value = champ.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      app.querySelectorAll('[data-act="table-rejoindre"], [data-act="table-regarder"]').forEach((b) => { b.disabled = champ.value.length !== 4; });
    });
  }

  // ---------- le multijoueur : la table (des amis simulés) ----------
  const AMIS = ['Léa', 'Marco', 'Inès'];
  let minuteurs = [];
  const plus_tard = (ms, f) => minuteurs.push(setTimeout(() => { if (etat.table) { f(); rafraichit(); } }, ms));
  // une voiture de la catégorie, différente de celles déjà prises à la table quand c'est possible
  const voitureAuHasard = (cat, graine) => {
    const prises = new Set(etat.table ? etat.table.membres.map((m) => m.voiture) : []);
    const toutes = D.voitures.filter((v) => cat === 'all' || v.cat === cat), libres = toutes.filter((v) => !prises.has(v.id));
    const l = libres.length ? libres : toutes;
    return l[Math.floor(hache(graine) * l.length)].id;
  };
  function ouvreTable(role, code) {
    minuteurs.forEach(clearTimeout); minuteurs = [];
    const moi = { nom: 'Toi', moi: true, hote: role === 'hote', pret: false, spect: role === 'spectateur', voiture: etat.voiture };
    const r = { format: 'race', circuit: etat.circuit, cat: 'all', tours: 3, ia: -1, degats: true, nuit: false };
    etat.table = { role, code, reglages: r, membres: [moi], ping: {} };
    if (role === 'hote') {
      plus_tard(1500, () => etat.table.membres.push({ nom: AMIS[0], pret: false, voiture: voitureAuHasard(r.cat, AMIS[0]) }));
      plus_tard(3500, () => etat.table.membres.push({ nom: AMIS[1], pret: false, voiture: voitureAuHasard(r.cat, AMIS[1]) }));
      plus_tard(5500, () => { etat.table.membres[1].pret = true; });
      plus_tard(8500, () => { const m = etat.table.membres[2]; if (m) m.pret = true; });
    } else {
      r.circuit = 'monaco'; r.cat = 'gt3'; r.tours = 5;
      etat.table.membres = [{ nom: AMIS[1], hote: true, pret: true, voiture: voitureAuHasard('gt3', AMIS[1]) }, { nom: AMIS[0], pret: true, voiture: voitureAuHasard('gt3', AMIS[0]) }, moi];
      if (D.voitures.find((v) => v.id === etat.voiture)?.cat !== 'gt3') etat.voiture = voitureAuHasard('gt3', 'moi');
      moi.voiture = etat.voiture;
      if (role === 'spectateur') plus_tard(7000, () => depart({ annonce: `${AMIS[1]} lance la course : tu la regardes.` }));
    }
    etat.ecran = 'table';
    rend();
  }
  const pilotes = () => etat.table.membres.filter((m) => !m.spect);
  function rendTable() {
    const T = etat.table, r = T.reglages, c = circuit(), v = voiture(), moi = T.membres.find((m) => m.moi);
    const liste = pilotes(), prets = liste.filter((m) => m.pret).length, specs = T.membres.length - liste.length;
    const hote = T.role === 'hote', spect = T.role === 'spectateur';
    const resume = [FORMATS[r.format], r.format === 'race' ? `${r.tours} tours` : '', r.format === 'race' ? (r.ia < 0 ? 'IA auto' : `${r.ia} IA`) : '', r.cat === 'all' ? 'toutes catégories' : categorie(r.cat).nom, r.degats ? 'dégâts' : 'sans dégâts', nuit() ? 'nuit' : ''].filter(Boolean).join(' · ');
    app.innerHTML = `${bandeau(`Table ${T.code}`, 'feuille', 'Quitter')}
      <main class="table">
        <div class="code-carte"><span>Code de la table</span><b class="titre" aria-label="${T.code.split('').join(' ')}">${T.code}</b><button class="noir" data-act="partager">Partager</button></div>
        <section aria-labelledby="pil"><h2 id="pil" class="titre petit-titre">Pilotes <small>${liste.length}/8${specs ? ` · ${specs} spectateur${specs > 1 ? 's' : ''}` : ''}</small></h2>
          <ul class="membres">${liste.map((m) => { const mv = voiturePar(m.voiture); return `<li class="${m.moi ? 'moi' : ''}"><img src="${imageDe(mv, 0)}" alt=""><span><b>${esc(m.nom)}</b><small>${[m.hote ? 'hôte' : '', esc(mv.nom)].filter(Boolean).join(' · ')}</small></span><span class="etat ${m.pret ? 'ok' : ''}">${m.pret ? '✓ Prêt' : 'En attente'}</span></li>`; }).join('')}</ul>
          ${liste.length < 2 ? '<p class="aide">Personne encore : donne le code à tes amis, ou trouve des joueurs sur le Discord.</p>' : ''}
        </section>
        <button class="course-carte" ${hote ? 'data-act="feuille" data-id="table"' : 'data-act="page-circuit"'} style="background-image:url('${RACINE}${esc(c.art)}')">
          <span class="course-texte"><b class="titre">${esc(c.nom)}</b> ${drapeau(c)}<small>${esc(resume)}</small></span><span class="course-action">${hote ? 'Modifier ›' : 'Réglée par l\'hôte'}</span>
        </button>
        ${spect ? '<p class="aide">Tu regardes : la course s\'affichera quand l\'hôte la lancera.</p>' : carteVoiture(v, true)}
        <div class="liens">${spect ? '' : '<button data-act="feuille" data-id="reglages">Mon freinage</button>'}<button data-act="feuille" data-id="connexion">Connexion</button></div>
      </main>
      <footer class="barre-bas">${spect ? '<span class="attente">L\'hôte lancera la course.</span>' : `<button class="chip ${moi.pret ? 'pret' : ''}" data-act="pret" aria-pressed="${moi.pret}">${moi.pret ? '✓ Prêt' : 'Prêt ?'}</button>`}
        ${hote ? `<button class="enpiste" data-act="table-depart" ${prets === liste.length && liste.length > 1 ? '' : 'disabled'}>${prets === liste.length && liste.length > 1 ? 'Départ ! →' : `${prets}/${liste.length} prêts`}</button>` : spect ? '' : '<span class="attente">L\'hôte lance quand tout le monde est prêt.</span>'}</footer>`;
  }

  function rend() {
    if (etat.ecran === 'menu') rendMenu();
    else if (etat.ecran === 'multi') rendMulti();
    else if (etat.ecran === 'table' && etat.table) rendTable();
    else rendPaddock();
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
    setTimeout(() => { const b = f.querySelector('.corps button:not(:disabled), .corps summary'); (b || f.querySelector('.fermer')).focus({ preventScroll: true }); }, 280);
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
  let ignorePop = false;
  window.addEventListener('popstate', () => { if (ignorePop) { ignorePop = false; return; } if (pile.length) fermeDessus(); });
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
  const fermeTout = () => { const n = pile.length; while (pile.length) fermeDessus(); if (n) { ignorePop = true; history.go(-n); } };

  // le panneau Circuit : les quatorze en grille ; on choisit (paddock, table) ou on ajoute (championnat)
  let acteCircuit = 'circuit';
  const contenuCircuits = () => {
    const sel = acteCircuit === 'table-circuit' ? etat.table.reglages.circuit : acteCircuit === 'champ-ajoute' ? null : etat.circuit;
    const dans = new Set(etat.champ.calendrier.map((m) => m.circuit));
    return `${acteCircuit === 'champ-ajoute' ? '<p class="aide">Toucher un circuit l\'ajoute à la fin du calendrier.</p>' : ''}<div class="grille-circuits">${D.circuits.map((c) => `<button class="vignette ${c.id === sel ? 'sel' : ''}" data-act="${acteCircuit}" data-id="${esc(c.id)}" aria-pressed="${c.id === sel}">
      <span class="art" style="background-image:url('${RACINE}${esc(c.art)}')"><img src="${esc(c.trace)}" alt=""></span>
      <b>${esc(c.nom)}</b><small>${drapeau(c)} ${esc(c.pays)} · ${metres(c.longueur)} · ${points(c.difficulte)}${acteCircuit === 'champ-ajoute' && dans.has(c.id) ? ' · déjà au calendrier' : ''}</small></button>`).join('')}</div>`;
  };

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
    const imposee = etat.table && etat.table.reglages.cat !== 'all' ? etat.table.reglages.cat : null;
    const filtre = imposee || etat.filtre || v.cat;
    const avant = voitureAvant && voitureAvant !== v.id ? D.voitures.find((x) => x.id === voitureAvant) : null;
    const liste = D.voitures.filter((x) => filtre === 'all' || x.cat === filtre);
    return `<div class="garage-tete"><img src="${imageDe(v)}" alt=""></div>
      <div class="garage-nom"><b class="titre">${esc(v.nom)}</b><small>${esc(cat ? cat.nom : '')} · ${esc(v.livrees[l].nom)}</small></div>
      ${v.livrees.length > 1 ? `<div class="livrees" role="group" aria-label="Livrées">${v.livrees.map((lv, i) => `<button class="${i === l ? 'sel' : ''}" data-act="livree-n" data-id="${i}" aria-label="${esc(lv.nom)}" aria-pressed="${i === l}"><img src="${imageDe(v, i)}" alt=""></button>`).join('')}</div>` : ''}
      <dl class="stats">${STATS.map((s) => `<div><dt>${s[0]}</dt><dd class="jauge" style="margin:0"><i style="width:${(part(s, v) * 100).toFixed(1)}%"></i>${avant ? `<u style="left:calc(${(part(s, avant) * 100).toFixed(1)}% - 1px)"></u>` : ''}</dd><dd>${s[2](s[1](v))}</dd></div>`).join('')}</dl>
      ${avant ? `<p class="stats-legende">Trait rouge : la ${esc(avant.nom)}, ta voiture en ouvrant le garage.</p>` : '<p class="stats-legende">Les barres comparent les 35 voitures du jeu sur une même échelle.</p>'}
      ${imposee ? `<p class="aide">L'hôte a choisi la catégorie ${esc(categorie(imposee).nom)} pour la table.</p>` : `<div class="segments" role="group" aria-label="Catégorie">${[['all', 'Toutes'], ...D.categories.map((c) => [c.id, c.nom])].map(([id, nom]) => `<button data-act="filtre" data-id="${id}" aria-pressed="${filtre === id}">${esc(nom)}</button>`).join('')}</div>`}
      <div class="grille-voitures">${liste.map((x) => `<button class="${x.id === v.id ? 'sel' : ''}" data-act="voiture" data-id="${esc(x.id)}" aria-pressed="${x.id === v.id}"><img src="${imageDe(x)}" alt=""><b>${esc(x.nom)}</b></button>`).join('')}</div>`;
  }

  // plus de réglages : un contrôle par nature de réglage (à la table, seulement le freinage, qui est à chacun)
  const contenuReglages = () => {
    const course = etat.mode === 'race' && !etat.table;
    return `${course ? `<button class="ligne" role="switch" aria-checked="${etat.degats}" data-act="degats"><span><b>Dégâts</b><small>Les chocs coûtent de la vitesse. On répare aux stands.</small></span><span class="interrupteur" aria-hidden="true"></span></button>
      <div class="ligne"><span><b>Adversaires</b><small>Auto, ou de 1 à 11.</small></span><span class="pas"><button data-act="adversaires" data-id="-1" aria-label="Un adversaire de moins" ${etat.adversaires <= 0 ? 'disabled' : ''}>−</button><span>${etat.adversaires || 'Auto'}</span><button data-act="adversaires" data-id="1" aria-label="Un adversaire de plus" ${etat.adversaires >= 11 ? 'disabled' : ''}>+</button></span></div>` : ''}
      <button class="ligne" data-act="feuille" data-id="freinage"><span><b>Freinage</b><small>Propre à ce circuit et à cette voiture.</small></span><span class="valeur">${etat.freinage ? esc(etat.freinage) : 'Par défaut'} ›</span></button>
      ${etat.table ? '' : '<div class="ligne"><span><b>Régler le freinage</b><small>Des tours d\'essai pour trouver ton point de freinage.</small></span><button class="noir" data-act="regler">Régler</button></div>'}`;
  };
  const contenuFreinage = () => `<div class="choix">${[['', 'Par défaut', 'Le freinage de la voiture, sans réglage.'], ['Tardif', 'Tardif', 'Un réglage enregistré (exemple).'], ['Prudent', 'Prudent', 'Un autre réglage enregistré (exemple).']].map(([id, nom, txt]) => `<button class="${etat.freinage === id ? 'sel' : ''}" data-act="freinage" data-id="${id}"><span><b>${nom}</b><small>${txt}</small></span></button>`).join('')}</div>`;
  const contenuDifficulte = () => `<div class="choix">${D.niveaux.map((n) => `<button class="${n.id === etat.difficulte ? 'sel' : ''}" data-act="difficulte" data-id="${n.id}" aria-pressed="${n.id === etat.difficulte}"><span><b>${esc(n.nom)}</b><small>${esc(DESCRIPTIONS[n.id] || '')}</small></span></button>`).join('')}</div>`;

  // les réglages de la table, pour l'hôte
  const contenuTable = () => {
    const r = etat.table.reglages, c = circuitPar(r.circuit), maxIA = Math.max(0, 12 - pilotes().length);
    return `<div class="segments trois" role="group" aria-label="Format">${Object.entries(FORMATS).map(([id, nom]) => `<button data-act="table-format" data-id="${id}" aria-pressed="${r.format === id}">${nom}</button>`).join('')}</div>
      <p class="aide">${{ race: 'Tous ensemble, avec l\'IA pour compléter la grille.', duel: 'Les pilotes de la table seulement, sans IA.', ghost: 'Chacun son tour, le meilleur chrono gagne.' }[r.format]}</p>
      <button class="ligne" data-act="feuille" data-id="circuits-table"><span><b>Circuit</b><small>${esc(c.nom)} · ${metres(c.longueur)}</small></span><span class="valeur">Changer ›</span></button>
      <div><p class="aide" style="margin:0 0 4px">Catégorie des voitures</p><div class="segments" role="group" aria-label="Catégorie">${[['all', 'Toutes'], ...D.categories.map((k) => [k.id, k.nom])].map(([id, nom]) => `<button data-act="table-cat" data-id="${id}" aria-pressed="${r.cat === id}">${esc(nom)}</button>`).join('')}</div></div>
      ${r.format === 'race' ? `<div class="ligne"><span><b>Tours</b><small>De 1 à 10.</small></span><span class="pas"><button data-act="table-tours" data-id="-1" aria-label="Un tour de moins" ${r.tours <= 1 ? 'disabled' : ''}>−</button><span>${r.tours}</span><button data-act="table-tours" data-id="1" aria-label="Un tour de plus" ${r.tours >= 10 ? 'disabled' : ''}>+</button></span></div>
      <div class="ligne"><span><b>Voitures de l'IA</b><small>Auto, ou de 0 à ${maxIA}.</small></span><span class="pas"><button data-act="table-ia" data-id="-1" aria-label="Une de moins" ${r.ia < 0 ? 'disabled' : ''}>−</button><span>${r.ia < 0 ? 'Auto' : r.ia}</span><button data-act="table-ia" data-id="1" aria-label="Une de plus" ${r.ia >= maxIA ? 'disabled' : ''}>+</button></span></div>` : ''}
      <button class="ligne" role="switch" aria-checked="${r.degats}" data-act="table-degats"><span><b>Dégâts</b><small>Les chocs coûtent de la vitesse. On répare aux stands.</small></span><span class="interrupteur" aria-hidden="true"></span></button>
      <button class="ligne" role="switch" aria-checked="${r.nuit}" data-act="table-nuit"><span><b>De nuit</b><small>Les F1 roulent quand même de jour.</small></span><span class="interrupteur" aria-hidden="true"></span></button>
      ${r.format !== 'ghost' ? '<button class="ligne" data-act="champ-table"><span><b>Championnat</b><small>Le même écran que le championnat seul, pour toute la table.</small></span><span class="valeur">›</span></button>' : ''}`;
  };
  const contenuConnexion = () => `<p class="aide">Le temps d'un aller-retour entre ton téléphone et chaque pilote. Au-delà de 150 ms, la course peut sauter.</p>
      <div class="choix">${etat.table.membres.filter((m) => !m.moi).map((m) => `<div class="ligne"><span><b>${esc(m.nom)}</b><small>${m.hote ? 'hôte' : 'pilote'}</small></span><span class="valeur">${Math.round(28 + hache(m.nom) * 70)} ms</span></div>`).join('') || '<p class="aide">Personne d\'autre à la table.</p>'}</div>`;
  const contenuQuitter = () => `<p>${etat.table.role === 'hote' ? 'Tu es l\'hôte : la table se fermera pour tout le monde.' : 'Tu pourras revenir avec le même code.'}</p>
      <div class="choix"><button class="danger" data-act="table-quitter"><span><b>Quitter la table</b></span></button><button data-act="fermer"><span><b>Rester</b></span></button></div>`;

  // la course du calendrier : monter, descendre, retirer
  let mancheChoisie = 0;
  const contenuManche = () => {
    const n = etat.champ.calendrier.length, i = mancheChoisie;
    return `<div class="choix"><button data-act="manche-monter" ${i === 0 ? 'disabled' : ''}><span><b>Avancer</b><small>Courir ce circuit plus tôt.</small></span></button>
      <button data-act="manche-descendre" ${i >= n - 1 ? 'disabled' : ''}><span><b>Reculer</b><small>Courir ce circuit plus tard.</small></span></button>
      <button class="danger" data-act="manche-retirer"><span><b>Retirer du calendrier</b></span></button></div>`;
  };

  // ---------- l'écran du circuit : quatre chiffres, les détails repliés, les chronos par catégorie ----------
  let filtreChronos = 'all';
  function ouvrePage(rendu) {
    const el = document.createElement('div'); el.className = 'page-circuit';
    document.body.append(el);
    const entree = { type: 'page', el, rend: () => rendu(el) };
    pile.push(entree);
    rendu(el);
    requestAnimationFrame(() => el.classList.add('ouverte'));
    history.pushState({ maquette: pile.length }, '');
  }
  function rendPage(el) {
    const c = circuit(), v = voiture();
    const haut = el.querySelector('.defile')?.scrollTop || 0;
    const liste = D.voitures.filter((x) => filtreChronos === 'all' || x.cat === filtreChronos)
      .map((x) => ({ x, monde: chronoMonde(x, c), perso: chronoPerso(x, c) })).sort((a, b) => a.monde - b.monde);
    const record = liste.length ? liste[0] : null;
    el.innerHTML = `<div class="app">${bandeau(c.nom, 'fermer', etat.table ? 'Table' : 'Paddock')}
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

  // ---------- le championnat : calendrier, séances, grille, classement ----------
  const bareme = () => D.baremes[voiture().cat] || D.baremes.gt;
  const concurrents = () => ['Toi', ...D.pilotes.slice(0, Math.max(1, etat.adversaires || 9))];
  const classement = () => concurrents().map((nom) => ({ nom, pts: etat.champ.points[nom] || 0 })).sort((a, b) => b.pts - a.pts || (a.nom === 'Toi' ? -1 : 1));
  function rendChamp(el) {
    const ch = etat.champ, n = ch.calendrier.length, b = bareme(), fige = ch.actif;
    const haut = el.querySelector('.defile')?.scrollTop || 0;
    const seance = (cle, nom) => `<div class="ligne"><span><b>${nom}</b><small>${ch[cle] ? ch[cle] + ' min avant chaque course' : 'Pas de séance'}</small></span><span class="pas"><button data-act="champ-seance" data-id="${cle}" data-pas="-5" aria-label="${nom} : 5 min de moins" ${fige || ch[cle] <= 0 ? 'disabled' : ''}>−</button><span>${ch[cle] || '—'}</span><button data-act="champ-seance" data-id="${cle}" data-pas="5" aria-label="${nom} : 5 min de plus" ${fige || ch[cle] >= 60 ? 'disabled' : ''}>+</button></span></div>`;
    el.innerHTML = `<div class="app">${bandeau('Championnat', 'fermer', etat.table ? 'Table' : 'Paddock')}
      <div class="defile">
        <p class="bareme"><b>${esc(categorie(voiture().cat).nom)}</b> · ${esc(b.texte)}</p>
        ${ch.fini ? `<p class="bandeau-info">Championnat terminé : tu finis ${ch.fini}${ch.fini === 1 ? 'er' : 'e'}.</p>` : ''}
        ${fige || ch.fini ? `<section><h2 class="titre petit-titre">Classement ${fige ? `<small>après ${ch.index} course${ch.index > 1 ? 's' : ''} sur ${n}</small>` : ''}</h2>
          <ol class="classement">${classement().slice(0, 6).map((p, i) => `<li class="${p.nom === 'Toi' ? 'moi' : ''}"><span class="pos">${i + 1}</span><b>${esc(p.nom)}</b><span>${pts(p.pts)} pts</span></li>`).join('')}</ol></section>` : ''}
        <section><h2 class="titre petit-titre">Calendrier <small>${n} / 10</small></h2>
          ${fige ? '<p class="aide">Le calendrier est figé pendant le championnat.</p>' : ''}
          <ol class="manches">${ch.calendrier.map((m, i) => { const c = circuitPar(m.circuit), passee = fige && i < ch.index, prochaine = fige && i === ch.index; return `<li class="${passee ? 'passee' : ''} ${prochaine ? 'prochaine' : ''}">
            <span class="num">${i + 1}</span><span class="mini" style="background-image:url('${RACINE}${esc(c.art)}')"></span>
            <span class="infos"><b>${esc(c.nom)}</b><span class="pas petit"><button data-act="manche-tours" data-id="${i}" data-pas="-1" aria-label="Un tour de moins" ${fige || m.tours <= 1 ? 'disabled' : ''}>−</button><span>${m.tours} tours</span><button data-act="manche-tours" data-id="${i}" data-pas="1" aria-label="Un tour de plus" ${fige || m.tours >= 99 ? 'disabled' : ''}>+</button></span></span>
            ${fige ? `<span class="statut" aria-label="${passee ? 'courue' : prochaine ? 'la prochaine' : 'à venir'}">${passee ? '✓' : prochaine ? '▶' : ''}</span>` : `<button class="trois-points" data-act="manche-menu" data-id="${i}" aria-label="Course ${i + 1} : avancer, reculer ou retirer">⋯</button>`}</li>`; }).join('')}</ol>
          ${fige ? '' : `<button class="ajouter" data-act="feuille" data-id="circuits-champ" ${n >= 10 ? 'disabled' : ''}>+ Ajouter un circuit</button>`}
          ${!n ? '<p class="aide">Ajoute au moins un circuit pour lancer le championnat.</p>' : ''}
        </section>
        <section><h2 class="titre petit-titre">Séances</h2>${seance('essais', 'Essais')}${seance('qualifs', 'Qualifications')}</section>
        <section><h2 class="titre petit-titre">Grille de départ</h2>
          <div class="ligne"><span><b>Ta place</b><small>${ch.place ? 'Fixée pour toutes les courses.' : 'Auto : les qualifications, ou le tirage.'}</small></span><span class="pas"><button data-act="champ-place" data-id="-1" aria-label="Plus devant" ${fige || ch.place <= 0 ? 'disabled' : ''}>−</button><span>${ch.place || 'Auto'}</span><button data-act="champ-place" data-id="1" aria-label="Plus derrière" ${fige || ch.place >= 10 ? 'disabled' : ''}>+</button></span></div>
        </section>
      </div>
      <footer class="barre-bas">${fige ? '<button class="chip" data-act="champ-arreter">Arrêter</button><button class="enpiste" data-act="fermer">Paddock →</button>' : `<button class="enpiste" data-act="champ-lancer" ${n ? '' : 'disabled'}>Lancer →</button>`}</footer></div>`;
    el.querySelector('.defile').scrollTop = haut;
  }

  // ---------- le départ, sans course ----------
  function depart({ annonce } = {}) {
    const c = circuit(), v = voiture(), T = etat.table;
    const champ = champEnCours(), ch = etat.champ;
    let lignes, titre = 'En piste !';
    if (T) {
      const r = T.reglages;
      lignes = [['Table', T.code], ['Format', FORMATS[r.format]], ['Circuit', c.nom], ['Pilotes', pilotes().map((m) => m.nom).join(', ')], ...(r.format === 'race' ? [['Tours', r.tours], ['IA', r.ia < 0 ? 'Auto' : r.ia]] : []), ['Dégâts', r.degats ? 'Activés' : 'Coupés'], ['Moment', nuit() ? 'Nuit' : 'Jour'], ...(T.role === 'spectateur' ? [] : [['Ta voiture', v.nom]])];
    } else {
      lignes = [['Mode', MODES[etat.mode]], ...(champ ? [['Championnat', `Course ${ch.index + 1} sur ${ch.calendrier.length}`]] : []), ['Circuit', c.nom], ['Voiture', v.nom], ['Livrée', v.livrees[livreeDe(v)].nom], ['Moment', nuit() ? 'Nuit' : 'Jour'],
        ...(etat.mode === 'race' ? [['Tours', champ ? manche().tours : etat.tours], ['Difficulté', niveau(etat.difficulte).nom], ['Adversaires', etat.adversaires || 'Auto'], ['Dégâts', etat.degats ? 'Activés' : 'Coupés']] : []),
        ...(champ ? [['Séances', [ch.essais ? `essais ${ch.essais} min` : '', ch.qualifs ? `qualifications ${ch.qualifs} min` : ''].filter(Boolean).join(', ') || 'aucune']] : []),
        ['Freinage', etat.freinage || 'Par défaut']];
    }
    const el = document.createElement('div'); el.className = 'depart'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="boite"><h2 class="titre">${titre}</h2><p>${esc(annonce || 'La course partirait ici. C\'est une maquette : pas de jeu derrière.')}</p>
      <dl>${lignes.map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>
      ${champ ? '<button class="enpiste" style="margin:6px 0 0" data-act="champ-simuler">Simuler l\'arrivée →</button>' : ''}
      <button class="${champ ? 'chip' : 'enpiste'}" style="margin:6px 0 0" data-act="retour-depart">← ${T ? 'Table' : 'Paddock'}</button></div>`;
    document.body.append(el);
    el.querySelector('button').focus();
  }
  // une arrivée tirée au sort, plus favorable en facile ; les points du barème, la pole à la gagnante
  function simuleArrivee(boite) {
    const ch = etat.champ, b = bareme(), noms = concurrents(), m = manche(), c = circuitPar(m.circuit);
    const chance = { easy: 0.2, medium: 0.4, hard: 0.55, extreme: 0.7, cauchemar: 0.85 }[etat.difficulte] ?? 0.4;
    const graine = hache(c.id + ch.index + Date.now());
    const maPlace = Math.min(noms.length - 1, Math.floor(Math.pow(graine, 1.6) * noms.length * chance * 1.6));
    const autres = noms.filter((n) => n !== 'Toi').sort((a, z) => hache(a + ch.index + graine) - hache(z + ch.index + graine));
    autres.splice(maPlace, 0, 'Toi');
    const gagnes = autres.map((nom, i) => ({ nom, place: i + 1, pts: (b.points[i] || 0) + (b.pole && ch.qualifs && i === 0 ? 1 : 0) }));
    for (const g of gagnes) ch.points[g.nom] = (ch.points[g.nom] || 0) + g.pts;
    ch.index += 1;
    let fin = '';
    if (ch.index >= ch.calendrier.length) {
      ch.fini = classement().findIndex((p) => p.nom === 'Toi') + 1; ch.actif = false;
      fin = `<p class="bandeau-info">Dernière course : tu finis le championnat ${ch.fini}${ch.fini === 1 ? 'er' : 'e'}.</p>`;
    }
    boite.innerHTML = `<h2 class="titre">Arrivée</h2><p>${esc(c.nom)} · course ${ch.index} sur ${ch.calendrier.length} (simulée)</p>
      <ol class="classement">${gagnes.slice(0, 6).map((g) => `<li class="${g.nom === 'Toi' ? 'moi' : ''}"><span class="pos">${g.place}</span><b>${esc(g.nom)}</b><span>+${pts(g.pts)} pts</span></li>`).join('')}</ol>
      ${maPlace >= 6 ? `<p>Toi : ${maPlace + 1}e, +${pts(gagnes[maPlace].pts)} pts.</p>` : ''}${fin}
      <button class="enpiste" style="margin:6px 0 0" data-act="retour-depart">${ch.fini ? 'Voir le classement' : 'Course suivante →'}</button>`;
    rend();
    if (ch.fini) boite.querySelector('button').dataset.act = 'fin-champ';
  }

  let minuteur = 0;
  function toast(txt) { const t = $('#toast'); t.textContent = txt; t.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(() => { t.hidden = true; }, 3200); }

  // ---------- les actions ----------
  const FEUILLES = {
    circuits: () => { acteCircuit = 'circuit'; return ['Circuit', contenuCircuits, 'haute']; },
    'circuits-champ': () => { acteCircuit = 'champ-ajoute'; return ['Ajouter un circuit', contenuCircuits, 'haute']; },
    'circuits-table': () => { acteCircuit = 'table-circuit'; return ['Circuit de la table', contenuCircuits, 'haute']; },
    garage: () => ['Garage', contenuGarage, 'haute'],
    reglages: () => [etat.table ? 'Mon freinage' : 'Plus de réglages', contenuReglages, 'moyenne'],
    freinage: () => ['Freinage', contenuFreinage, 'moyenne'],
    difficulte: () => ['Difficulté', contenuDifficulte, 'moyenne'],
    table: () => ['Réglages de la table', contenuTable, 'haute'],
    connexion: () => ['Connexion', contenuConnexion, 'moyenne'],
    manche: () => [`Course ${mancheChoisie + 1} · ${circuitPar(etat.champ.calendrier[mancheChoisie].circuit).nom}`, contenuManche, 'moyenne'],
  };
  const montreMoi = () => etat.table && (etat.table.membres.find((m) => m.moi).voiture = etat.voiture);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const id = b.dataset.id, v = voiture(), ch = etat.champ, T = etat.table;
    switch (b.dataset.act) {
      case 'mode': etat.mode = id; etat.ecran = 'paddock'; rend(); break;
      case 'menu': etat.ecran = 'menu'; rend(); break;
      case 'multi': etat.ecran = 'multi'; rend(); break;
      case 'feuille':
        if (!id && T) { ouvreFeuille('quitter', 'Quitter la table ?', contenuQuitter, 'moyenne'); break; }
        if (id === 'garage') { voitureAvant = etat.voiture; etat.filtre = null; }
        ouvreFeuille(id, ...FEUILLES[id]()); break;
      case 'fermer': history.back(); break;
      case 'page-circuit': ouvrePage(rendPage); break;
      case 'page-champ': ouvrePage(rendChamp); break;
      case 'champ-table': toast('Dans le jeu : le même écran que le championnat seul, pour toute la table.'); break;
      case 'circuit': etat.circuit = id; rend(); history.back(); break;
      case 'voiture': etat.voiture = id; if (T) { montreMoi(); T.membres.find((m) => m.moi).pret = false; } rafraichit(); break;
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
      case 'regler': toast('Dans le jeu : la course part en mode RÉGLER, des tours d\'essai pour régler le freinage de ce circuit avec cette voiture.'); break;
      case 'enpiste': depart(); break;
      case 'retour-depart': b.closest('.depart').remove(); break;
      // le championnat
      case 'champ-ajoute': if (ch.calendrier.length < 10) ch.calendrier.push({ circuit: id, tours: etat.tours }); ch.fini = null; rafraichit(); history.back(); break;
      case 'manche-tours': { const m = ch.calendrier[Number(id)]; m.tours = Math.max(1, Math.min(99, m.tours + Number(b.dataset.pas))); rafraichit(); break; }
      case 'manche-menu': mancheChoisie = Number(id); ouvreFeuille('manche', ...FEUILLES.manche()); break;
      case 'manche-monter': case 'manche-descendre': { const i = mancheChoisie, j = i + (b.dataset.act === 'manche-monter' ? -1 : 1); [ch.calendrier[i], ch.calendrier[j]] = [ch.calendrier[j], ch.calendrier[i]]; history.back(); setTimeout(rafraichit, 30); break; }
      case 'manche-retirer': ch.calendrier.splice(mancheChoisie, 1); history.back(); setTimeout(rafraichit, 30); break;
      case 'champ-seance': ch[id] = Math.max(0, Math.min(60, ch[id] + Number(b.dataset.pas))); rafraichit(); break;
      case 'champ-place': ch.place = Math.max(0, Math.min(10, ch.place + Number(id))); rafraichit(); break;
      case 'champ-lancer': Object.assign(ch, { actif: true, index: 0, points: {}, fini: null }); rafraichit(); history.back(); break;
      case 'champ-arreter': ch.actif = false; rafraichit(); break;
      case 'champ-simuler': simuleArrivee(b.closest('.boite')); break;
      case 'fin-champ': b.closest('.depart').remove(); ouvrePage(rendChamp); break;
      // le multijoueur
      case 'table-creer': ouvreTable('hote', Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')); break;
      case 'table-rejoindre': ouvreTable('invite', $('#code').value); break;
      case 'table-regarder': ouvreTable('spectateur', $('#code').value); break;
      case 'discord': toast('Dans le jeu : le lien vers le Discord de GRIP.'); break;
      case 'partager': toast(`Code ${T.code} copié : envoie-le à tes amis.`); break;
      case 'pret': {
        const moi = T.membres.find((m) => m.moi); moi.pret = !moi.pret; rend();
        if (moi.pret && T.role === 'invite') plus_tard(2500, () => { if (T.membres.find((m) => m.moi).pret) depart({ annonce: `${AMIS[1]} lance la course.` }); });
        break;
      }
      case 'table-depart': depart(); break;
      case 'table-quitter': minuteurs.forEach(clearTimeout); minuteurs = []; etat.table = null; etat.ecran = 'multi'; fermeTout(); setTimeout(rend, 40); break;
      case 'table-format': T.reglages.format = id; rafraichit(); break;
      case 'table-circuit': T.reglages.circuit = id; rafraichit(); history.back(); break;
      case 'table-cat': T.reglages.cat = id; if (id !== 'all' && voiture().cat !== id) { etat.voiture = voitureAuHasard(id, 'moi'); montreMoi(); } for (const m of T.membres) if (!m.moi && id !== 'all' && voiturePar(m.voiture).cat !== id) m.voiture = voitureAuHasard(id, m.nom); rafraichit(); break;
      case 'table-tours': T.reglages.tours = Math.max(1, Math.min(10, T.reglages.tours + Number(id))); rafraichit(); break;
      case 'table-ia': T.reglages.ia = Math.max(-1, Math.min(12, T.reglages.ia + Number(id))); rafraichit(); break;
      case 'table-degats': T.reglages.degats = !T.reglages.degats; rafraichit(); break;
      case 'table-nuit': T.reglages.nuit = !T.reglages.nuit; rafraichit(); break;
    }
  });

  fetch('donnees.json').then((r) => r.json()).then((d) => {
    D = d;
    etat = Object.assign(defaut(), lit() || {});
    etat.champ = Object.assign(champVide(), etat.champ || {});
    etat.table = null;
    if (etat.ecran === 'table') etat.ecran = 'multi';
    if (!D.circuits.some((c) => c.id === etat.circuit)) etat.circuit = D.circuits[0].id;
    if (!D.voitures.some((v) => v.id === etat.voiture)) etat.voiture = D.voitures[0].id;
    rend();
  }).catch(() => { app.innerHTML = '<p style="padding:20px">Les données de la maquette n\'ont pas pu être lues (donnees.json).</p>'; });
})();
