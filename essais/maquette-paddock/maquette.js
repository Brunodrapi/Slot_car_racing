/* LA MAQUETTE DU PADDOCK TÉLÉPHONE — les écrans seulement, sans jeu derrière.

Un paddock sur un seul écran (circuit, voiture, trois réglages, EN PISTE) et ses panneaux : le
circuit, le garage, plus de réglages, la difficulté, l'écran du circuit (fiche et chronos). Puis le
championnat, un mode du menu (son écran de départ, son paddock, l'arrivée avec le classement, le
podium), et le multijoueur (entrée, table, réglages de l'hôte, championnat de la table, en course
ou en contre-la-montre). Les données viennent du jeu
(donnees.json, outils/exporte.cjs) ; les chronos, les arrivées et les amis de la table sont simulés.
Aucune course ne part. Les choix sont gardés dans ce navigateur. */
'use strict';
(() => {
  const RACINE = '../../';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MODES = { race: 'Course rapide', champ: 'Championnat', timetrial: 'Contre-la-montre', training: 'Entraînement' };
  const rang = (n) => n === 1 ? '1er' : `${n}e`;
  // les formats de la table : une course sans voiture de l'IA est un duel
  const FORMATS = { race: 'Course', ghost: 'Contre-la-montre' };
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
  // le championnat : son calendrier et ses séances ; lancé, sa catégorie, ses pilotes et leurs points
  // (avant, les places d'avant la dernière course, pour les flèches du classement)
  const champVide = () => ({ actif: false, calendrier: [], essais: 0, qualifs: 0, place: 0, index: 0, points: {}, places: {}, avant: {}, cat: null, pilotes: null, fini: null });
  const defaut = () => ({ ecran: 'menu', mode: 'race', circuit: 'spa', voiture: 'porsche991gt3r', livrees: {}, tours: 5, difficulte: 'medium',
    nuit: false, degats: true, adversaires: 0, freinage: '', filtre: null, champ: champVide() });
  const sauve = () => { try { localStorage.setItem(CLE, JSON.stringify({ ...etat, table: null })); } catch (e) { /* navigation privée */ } };
  const lit = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; } };

  const circuitPar = (id) => D.circuits.find((c) => c.id === id) || D.circuits[0];
  const voiturePar = (id) => D.voitures.find((v) => v.id === id) || D.voitures[0];
  // le championnat en jeu : celui de la table quand on est à une table, sinon le championnat seul
  const CH = () => etat.table ? etat.table.champ : etat.champ;
  const champEnCours = () => { const ch = CH(); return ch.actif && ch.calendrier.length > 0 && (!!etat.table || etat.mode === 'champ'); };
  // un championnat de contre-la-montre (à la table) : ses manches sont des séances de qualifications
  const champCLM = () => !!etat.table && (CH().actif ? CH().format : etat.table.reglages.format) === 'ghost';
  const motManche = () => champCLM() ? 'Manche' : 'Course';
  const enCourse = () => etat.mode === 'race' || etat.mode === 'champ';   // des adversaires, des tours
  const manche = () => { const ch = CH(); return ch.calendrier[Math.min(ch.index, ch.calendrier.length - 1)]; };
  const circuit = () => champEnCours() ? circuitPar(manche().circuit) : etat.table ? circuitPar(etat.table.reglages.circuit) : circuitPar(etat.circuit);
  const voiture = () => voiturePar(etat.voiture);
  const livreeDe = (v) => Math.min(v.livrees.length - 1, etat.livrees[v.id] || 0);
  const imageDe = (v, l = livreeDe(v)) => RACINE + v.livrees[l].image;
  const categorie = (id) => D.categories.find((c) => c.id === id);
  const nomCat = (id) => id === 'all' ? 'Toutes catégories' : (categorie(id) || {}).nom || '';
  const niveau = (id) => D.niveaux.find((n) => n.id === id) || D.niveaux[1];
  const drapeau = (c) => c.code ? `<img class="drapeau" src="${RACINE}art/interface/flags/${esc(c.code)}.svg" alt="">` : '';
  // la difficulté d'un circuit en mots, aux couleurs des pistes de ski : vert, bleu, rouge, noir
  const NIVEAUX_CIRCUIT = ['Facile', 'Moyen', 'Difficile', 'Extrême'];
  const points = (n) => `<span class="niveau-circuit n${n}">${NIVEAUX_CIRCUIT[n - 1] || ''}</span>`;
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

  // la coupe du championnat (le jeu n'a pas d'image pour elle) : un trait d'encre sur du papier, comme les autres
  const COUPE = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6h20v9c0 7-4 12-10 12S14 22 14 15z" fill="#fbf4e2" stroke="#171b19" stroke-width="3" stroke-linejoin="round"/><path d="M14 10H7c0 7 3 11 8 11M34 10h7c0 7-3 11-8 11" fill="none" stroke="#171b19" stroke-width="3" stroke-linecap="round"/><path d="M21 27h6v7h-6zM15 34h18v7H15z" fill="#fbf4e2" stroke="#171b19" stroke-width="3" stroke-linejoin="round"/><path d="M24 10l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#d0342b"/></svg>`;
  function rendMenu() {
    const ch = etat.champ;
    app.innerHTML = `<div class="menu">
      <img class="logo-grand" src="${RACINE}art/interface/logo-grip.webp" alt="GRIP — Racing the Line">
      <button class="mode rouge titre" data-act="mode" data-id="race"><img src="${RACINE}art/interface/wheel.webp" alt="">Course rapide</button>
      <button class="mode orange titre" data-act="champ">${COUPE}<span>Championnat${ch.actif ? `<small>En cours · course ${ch.index + 1}/${ch.calendrier.length}</small>` : ''}</span></button>
      <button class="mode jaune titre" data-act="mode" data-id="timetrial"><img src="${RACINE}art/interface/clock.webp" alt="">Contre-la-montre</button>
      <button class="mode bleu titre" data-act="mode" data-id="training"><img src="${RACINE}art/interface/plaque-l.svg" alt="">Entraînement</button>
      <button class="mode vert titre" data-act="multi"><img src="${RACINE}art/interface/helmets.webp" alt="">Multijoueur</button>
      <p class="avertissement"><b>Maquette des écrans téléphone.</b> Aucune course ne part. Les circuits, voitures et livrées sont ceux du jeu ; les chronos, les arrivées et les amis du multijoueur sont simulés.</p>
    </div>`;
  }

  // la carte du circuit et celle de la voiture, partagées par le paddock et la table
  // le chrono, en haut à gauche de la carte : la fiche du circuit et ses chronos, sur tous les écrans
  function carteCircuit(c, { acte = 'feuille', id = 'circuits', etiquette = 'Changer', libelle } = {}) {
    return `<div class="carte-zone"><button class="carte carte-circuit ${nuit() ? 'nuit' : ''}" data-act="${acte}" data-id="${id}" style="background-image:url('${RACINE}${esc(c.art)}')" aria-label="${esc(libelle || 'Circuit : ' + c.nom + '. Toucher pour changer.')}">
        <img class="trace" src="${esc(nuit() ? c.traceNuit : c.trace)}" alt="">
        ${etiquette ? `<span class="changer">${esc(etiquette)}</span>` : ''}
        <span class="bandeau-nom"><span class="nom titre">${esc(c.nom)}</span>${drapeau(c)}<small>${metres(c.longueur)} · ${points(c.difficulte)}</small></span>
      </button><button class="info" data-act="page-circuit" aria-label="Chronos et fiche du circuit"><img src="${RACINE}art/interface/clock.webp" alt=""></button></div>`;
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
    const course = enCourse(), champ = champEnCours();
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
    const carteC = champ ? carteCircuit(c, { acte: 'page-calendrier', id: '', etiquette: `Course ${ch.index + 1}/${ch.calendrier.length}`, libelle: `Championnat, course ${ch.index + 1} sur ${ch.calendrier.length} : ${c.nom}. Toucher pour le calendrier.` }) : carteCircuit(c);
    // en championnat, une ligne pour le classement : ta place, le tableau complet à un toucher
    const maPlace = champ && ch.index > 0 ? classement().findIndex((p) => p.nom === 'Toi') + 1 : 0;
    const resume = champ ? puceClassement(maPlace) : '';
    app.innerHTML = `${bandeau(MODES[etat.mode], 'menu')}
      <main class="paddock">
        ${carteC}
        ${carteVoiture(v)}
        ${pastilles}
      </main>
      <footer class="barre-bas${resume ? ' serree' : ''}">${BOUTON_REGLAGES}${resume}<button class="enpiste" data-act="enpiste">En piste ! →</button></footer>`;
  }

  // en bas du paddock et de la table, pendant un championnat : « Classement », et dessous ta place
  const puceClassement = (place) => `<button class="chip etage" data-act="feuille" data-id="classement" aria-label="${place ? `Classement : tu es ${rang(place)}. Toucher pour le tableau complet.` : 'Classement du championnat'}"><b>Classement</b>${place ? `<small>Tu es ${rang(place)}</small>` : ''}</button>`;

  // en bas à gauche de tous les écrans de course : les réglages
  const BOUTON_REGLAGES = '<button class="chip" data-act="feuille" data-id="reglages">Réglages</button>';

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
    etat.table = { role, code, reglages: r, membres: [moi], ping: {}, champ: champVide() };
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
    const liste = pilotes();
    const hote = T.role === 'hote', spect = T.role === 'spectateur';
    // pendant un championnat, le circuit, le format, la catégorie et les tours sont ceux du calendrier
    const ch = T.champ, champ = champEnCours(), regle = hote && !champ, clm = r.format === 'ghost';
    // les mêmes pastilles que le paddock ; l'hôte seul les change, les autres les lisent
    const tours = !clm ? `<div class="compteur" role="group" aria-label="Tours"><button data-act="tours" data-id="-1" aria-label="Un tour de moins" ${!regle || r.tours <= 1 ? 'disabled' : ''}>−</button><div><span class="lib">Tours</span><b>${champ ? manche().tours : r.tours}</b></div><button data-act="tours" data-id="1" aria-label="Un tour de plus" ${!regle || r.tours >= 10 ? 'disabled' : ''}>+</button></div>`
      : champ ? `<div class="pastille fixe"><span class="lib">Séance</span><b>${manche().minutes} min</b></div>` : '';
    const sansIA = !clm && r.ia === 0;
    const format = `<button class="pastille" data-act="feuille" data-id="format" ${regle ? '' : 'disabled'}><span class="lib">Format${regle ? ' ▾' : ''}</span><b>${FORMATS[r.format]}</b>${clm ? '' : `<span class="note">${sansIA ? 'Sans IA : un duel' : `IA : ${r.ia < 0 ? 'auto' : r.ia}`}</span>`}</button>`;
    const cat = `<button class="pastille" data-act="feuille" data-id="categorie" ${regle ? '' : 'disabled'}><span class="lib">Catégorie${regle ? ' ▾' : ''}</span><b>${r.cat === 'all' ? 'Toutes' : esc(categorie(r.cat).nom)}</b></button>`;
    const jourNuit = `<button class="pastille" data-act="nuit" ${hote && nuitPossible() ? '' : 'disabled'} aria-pressed="${nuit()}"><span class="lib">Moment</span><b>${nuit() ? '☾ Nuit' : '☀ Jour'}</b>${nuitPossible() ? '' : '<span class="note">Les F1 roulent de jour</span>'}</button>`;
    // l'hôte n'a pas de « Prêt » : appuyer sur Départ, c'est l'être ; il attend que les autres le soient
    const pils = liste.map((m) => `<span class="pil ${m.hote ? 'hote' : m.pret ? 'ok' : ''} ${m.moi ? 'moi' : ''}">${m.hote ? '★' : m.pret ? '✓' : '…'} ${esc(m.nom)}</span>`).join('');
    const autres = liste.filter((m) => !m.hote), autresPrets = autres.filter((m) => m.pret).length;
    const tousPrets = autres.length > 0 && autresPrets === autres.length;
    const n = ch.calendrier.length;
    const carte = champ ? carteCircuit(c, { acte: 'page-calendrier', id: '', etiquette: `${motManche()} ${ch.index + 1}/${n}`, libelle: `Championnat de la table, ${motManche().toLowerCase()} ${ch.index + 1} sur ${n} : ${c.nom}. Toucher pour le calendrier.` })
      : carteCircuit(c, hote ? { id: 'circuits-table' } : { acte: 'page-circuit', id: '', etiquette: 'Choisi par l\'hôte', libelle: `Circuit choisi par l'hôte : ${c.nom}. Toucher pour sa fiche.` });
    // en bas : le championnat pour l'hôte ; lancé, le classement pour tous
    const maPlace = champ && ch.index > 0 && !spect ? classement().findIndex((p) => p.nom === 'Toi') + 1 : 0;
    const puce = champ ? puceClassement(maPlace) : hote ? '<button class="chip" data-act="page-champ-table">Championnat</button>' : '';
    app.innerHTML = `${bandeau(`Table ${T.code}`, 'feuille', 'Quitter')}
      <main class="paddock">
        <button class="pilotes-barre" data-act="feuille" data-id="pilotes" aria-label="Pilotes : ${liste.length} sur 8, ${autresPrets} prêts sur ${autres.length}, plus l'hôte. Toucher pour la liste et le code de la table.">
          <span class="compte titre">${liste.length}/8</span><span class="pils">${pils}${liste.length < 2 ? '<span class="pil vide">Donne le code à tes amis</span>' : ''}</span><span class="fleche" aria-hidden="true">›</span>
        </button>
        ${carte}
        ${spect ? '<p class="aide encart">Tu regardes : la course s\'affichera quand l\'hôte la lancera.</p>' : carteVoiture(v)}
        <div class="pastilles table-pastilles ${tours ? '' : 'trois'}">${tours}${format}${cat}${jourNuit}</div>
      </main>
      <footer class="barre-bas${puce ? ' serree' : ''}">${BOUTON_REGLAGES}${puce}${spect ? '<span class="attente">L\'hôte lancera la course.</span>'
        : hote ? `<button class="enpiste" data-act="table-depart" ${tousPrets ? '' : 'disabled'} aria-label="${tousPrets ? 'Départ' : `${autresPrets} pilotes prêts sur ${autres.length}`}">${tousPrets ? 'Départ ! →' : autres.length ? `${autresPrets}/${autres.length} prêts` : 'En attente'}</button>`
        : `<button class="enpiste ${moi.pret ? 'pret' : ''}" data-act="pret" aria-pressed="${moi.pret}">${moi.pret ? '✓ Prêt' : 'Prêt ?'}</button>`}</footer>`;
  }

  function rend() {
    if (etat.ecran === 'menu') rendMenu();
    else if (etat.ecran === 'multi') rendMulti();
    else if (etat.ecran === 'table' && etat.table) rendTable();
    else if (etat.ecran === 'champ') rendChampDepart();
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
    const dans = new Set(CH().calendrier.map((m) => m.circuit));
    return `${acteCircuit === 'champ-ajoute' ? '<p class="aide">Toucher un circuit l\'ajoute à la fin du calendrier.</p>' : ''}<div class="grille-circuits">${D.circuits.map((c) => `<button class="vignette ${c.id === sel ? 'sel' : ''}" data-act="${acteCircuit}" data-id="${esc(c.id)}" aria-pressed="${c.id === sel}">
      <span class="art" style="background-image:url('${RACINE}${esc(c.art)}')"><img src="${esc(c.trace)}" alt=""></span>
      <b>${esc(c.nom)}</b><small>${drapeau(c)} ${esc(c.pays)} · ${metres(c.longueur)}</small><small>${points(c.difficulte)}${acteCircuit === 'champ-ajoute' && dans.has(c.id) ? ' déjà au calendrier' : ''}</small></button>`).join('')}</div>`;
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
    const imposee = etat.table ? (etat.table.reglages.cat !== 'all' ? etat.table.reglages.cat : null) : champEnCours() ? etat.champ.cat : null;
    const filtre = imposee || etat.filtre || v.cat;
    const avant = voitureAvant && voitureAvant !== v.id ? D.voitures.find((x) => x.id === voitureAvant) : null;
    const liste = D.voitures.filter((x) => filtre === 'all' || x.cat === filtre);
    return `<div class="garage-tete"><img src="${imageDe(v)}" alt=""></div>
      <div class="garage-nom"><b class="titre">${esc(v.nom)}</b><small>${esc(cat ? cat.nom : '')} · ${esc(v.livrees[l].nom)}</small></div>
      ${v.livrees.length > 1 ? `<div class="livrees" role="group" aria-label="Livrées">${v.livrees.map((lv, i) => `<button class="${i === l ? 'sel' : ''}" data-act="livree-n" data-id="${i}" aria-label="${esc(lv.nom)}" aria-pressed="${i === l}"><img src="${imageDe(v, i)}" alt=""></button>`).join('')}</div>` : ''}
      <dl class="stats">${STATS.map((s) => `<div><dt>${s[0]}</dt><dd class="jauge" style="margin:0"><i style="width:${(part(s, v) * 100).toFixed(1)}%"></i>${avant ? `<u style="left:calc(${(part(s, avant) * 100).toFixed(1)}% - 1px)"></u>` : ''}</dd><dd>${s[2](s[1](v))}</dd></div>`).join('')}</dl>
      ${avant ? `<p class="stats-legende">Trait rouge : la ${esc(avant.nom)}, ta voiture en ouvrant le garage.</p>` : '<p class="stats-legende">Les barres comparent les 35 voitures du jeu sur une même échelle.</p>'}
      ${imposee ? `<p class="aide">${etat.table ? `L'hôte a choisi la catégorie ${esc(categorie(imposee).nom)} pour la table.` : `Le championnat se court en ${esc(categorie(imposee).nom)} : tu changes de voiture dans la catégorie.`}</p>` : `<div class="segments" role="group" aria-label="Catégorie">${[['all', 'Toutes'], ...D.categories.map((c) => [c.id, c.nom])].map(([id, nom]) => `<button data-act="filtre" data-id="${id}" aria-pressed="${filtre === id}">${esc(nom)}</button>`).join('')}</div>`}
      <div class="grille-voitures">${liste.map((x) => `<button class="${x.id === v.id ? 'sel' : ''}" data-act="voiture" data-id="${esc(x.id)}" aria-pressed="${x.id === v.id}"><img src="${imageDe(x)}" alt=""><b>${esc(x.nom)}</b></button>`).join('')}</div>`;
  }

  // plus de réglages : un contrôle par nature de réglage (à la table, seulement le freinage, qui est à chacun)
  const contenuReglages = () => {
    const freinage = `<button class="ligne" data-act="feuille" data-id="freinage"><span><b>Freinage</b><small>Propre à ce circuit et à cette voiture${etat.table ? ', à toi seul' : ''}.</small></span><span class="valeur">${etat.freinage ? esc(etat.freinage) : 'Par défaut'} ›</span></button>`;
    if (etat.table) {
      const T = etat.table, r = T.reglages, hote = T.role === 'hote', maxIA = Math.max(0, 12 - pilotes().length), champ = champEnCours();
      const ia = champ ? T.champ.ia : r.ia, iaTxt = ia < 0 ? 'Auto' : ia === 0 ? '0 : un duel' : ia;
      if (!hote) return `<p class="aide">Réglée par l'hôte.</p>
        ${r.format === 'race' ? `<div class="ligne"><span><b>Voitures de l'IA</b></span><span class="valeur">${iaTxt}</span></div>` : ''}
        <div class="ligne"><span><b>Dégâts</b></span><span class="valeur">${r.degats ? 'Activés' : 'Coupés'}</span></div>
        ${T.role === 'spectateur' ? '' : freinage}`;
      // les voitures de l'IA : sans elles, la course est un duel ; pendant un championnat, celles du départ
      const lignIA = r.format !== 'race' ? '' : champ ? `<div class="ligne"><span><b>Voitures de l'IA</b><small>Celles du départ du championnat.</small></span><span class="valeur">${iaTxt}</span></div>`
        : `<div class="ligne"><span><b>Voitures de l'IA</b><small>Auto, ou de 0 à ${maxIA}. Sans IA, la course est un duel.</small></span><span class="pas"><button data-act="table-ia" data-id="-1" aria-label="Une de moins" ${r.ia < 0 ? 'disabled' : ''}>−</button><span>${r.ia < 0 ? 'Auto' : r.ia}</span><button data-act="table-ia" data-id="1" aria-label="Une de plus" ${r.ia >= maxIA ? 'disabled' : ''}>+</button></span></div>`;
      return `${lignIA}
        <button class="ligne" role="switch" aria-checked="${r.degats}" data-act="table-degats"><span><b>Dégâts</b><small>Les chocs coûtent de la vitesse. On répare aux stands.</small></span><span class="interrupteur" aria-hidden="true"></span></button>
        ${freinage}
        ${champ ? '<button class="ligne" data-act="feuille" data-id="abandon"><span><b class="rouge">Arrêter le championnat</b><small>Pour toute la table : les points sont perdus.</small></span><span class="valeur">›</span></button>' : ''}`;
    }
    // en championnat, les adversaires sont ceux du départ : ils restent sur l'écran du championnat
    const champ = champEnCours();
    return `${enCourse() ? `<button class="ligne" role="switch" aria-checked="${etat.degats}" data-act="degats"><span><b>Dégâts</b><small>Les chocs coûtent de la vitesse. On répare aux stands.</small></span><span class="interrupteur" aria-hidden="true"></span></button>` : ''}
      ${etat.mode === 'race' ? ligneAdversaires() : ''}
      ${freinage}
      <div class="ligne"><span><b>Régler le freinage</b><small>Des tours d'essai pour trouver ton point de freinage.</small></span><button class="noir" data-act="regler">Régler</button></div>
      ${champ ? '<button class="ligne" data-act="feuille" data-id="abandon"><span><b class="rouge">Abandonner le championnat</b><small>Les points sont perdus.</small></span><span class="valeur">›</span></button>' : ''}`;
  };
  const ligneAdversaires = () => `<div class="ligne"><span><b>Adversaires</b><small>Auto, ou de 1 à 11.</small></span><span class="pas"><button data-act="adversaires" data-id="-1" aria-label="Un adversaire de moins" ${etat.adversaires <= 0 ? 'disabled' : ''}>−</button><span>${etat.adversaires || 'Auto'}</span><button data-act="adversaires" data-id="1" aria-label="Un adversaire de plus" ${etat.adversaires >= 11 ? 'disabled' : ''}>+</button></span></div>`;
  const contenuAbandon = () => `<p>${etat.table ? 'Le championnat s\'arrête pour toute la table' : 'Le championnat s\'arrête'} : ses points sont perdus. Le calendrier reste, pour en relancer un.</p>
      <div class="choix"><button class="danger" data-act="champ-abandon"><span><b>${etat.table ? 'Arrêter' : 'Abandonner'}</b></span></button><button data-act="fermer"><span><b>Continuer le championnat</b></span></button></div>`;
  const contenuFreinage = () => `<div class="choix">${[['', 'Par défaut', 'Le freinage de la voiture, sans réglage.'], ['Tardif', 'Tardif', 'Un réglage enregistré (exemple).'], ['Prudent', 'Prudent', 'Un autre réglage enregistré (exemple).']].map(([id, nom, txt]) => `<button class="${etat.freinage === id ? 'sel' : ''}" data-act="freinage" data-id="${id}"><span><b>${nom}</b><small>${txt}</small></span></button>`).join('')}</div>`;
  const contenuDifficulte = () => `<div class="choix">${D.niveaux.map((n) => `<button class="${n.id === etat.difficulte ? 'sel' : ''}" data-act="difficulte" data-id="${n.id}" aria-pressed="${n.id === etat.difficulte}"><span><b>${esc(n.nom)}</b><small>${esc(DESCRIPTIONS[n.id] || '')}</small></span></button>`).join('')}</div>`;

  // le format de la table, comme la difficulté du paddock : une ligne par choix
  const TEXTES_FORMAT = { race: 'Tous ensemble. Avec ou sans voitures de l\'IA (Réglages) : sans elles, c\'est un duel.', ghost: 'Chacun roule seul, le meilleur tour gagne.' };
  const contenuFormat = () => `<div class="choix">${Object.entries(FORMATS).map(([id, nom]) => `<button class="${etat.table.reglages.format === id ? 'sel' : ''}" data-act="table-format" data-id="${id}" aria-pressed="${etat.table.reglages.format === id}"><span><b>${nom}</b><small>${TEXTES_FORMAT[id]}</small></span></button>`).join('')}</div>`;
  // la catégorie de la table : chacun choisit sa voiture dedans
  const contenuCategorie = () => { const r = etat.table.reglages; return `<p class="aide">Chacun choisit sa voiture dans la catégorie de la table. Une voiture d'une autre catégorie change d'elle-même.</p><div class="choix">${[['all', 'Toutes', 'Chacun prend la voiture qu\'il veut.'], ...D.categories.map((k) => [k.id, k.nom, `${D.voitures.filter((v) => v.cat === k.id).length} voitures.`])].map(([id, nom, txt]) => `<button class="${r.cat === id ? 'sel' : ''}" data-act="table-cat" data-id="${id}" aria-pressed="${r.cat === id}"><span><b>${esc(nom)}</b><small>${esc(txt)}</small></span></button>`).join('')}</div>`; };
  // les pilotes : le code à partager, chacun avec sa voiture, son état et sa connexion
  const contenuPilotes = () => {
    const T = etat.table, liste = pilotes(), specs = T.membres.length - liste.length;
    return `<div class="code-carte"><span>Code de la table</span><b class="titre" aria-label="${T.code.split('').join(' ')}">${T.code}</b><button class="noir" data-act="partager">Partager</button></div>
      <ul class="membres">${liste.map((m) => { const mv = voiturePar(m.voiture); return `<li class="${m.moi ? 'moi' : ''}"><img src="${imageDe(mv, 0)}" alt=""><span><b>${esc(m.nom)}</b><small>${[m.hote ? 'hôte' : '', esc(mv.nom), m.moi ? '' : Math.round(28 + hache(m.nom) * 70) + ' ms'].filter(Boolean).join(' · ')}</small></span><span class="etat ${m.hote || m.pret ? 'ok' : ''}">${m.hote ? '★ Lance' : m.pret ? '✓ Prêt' : 'En attente'}</span></li>`; }).join('')}</ul>
      <p class="aide">${liste.length}/8 pilotes${specs ? ` · ${specs} spectateur${specs > 1 ? 's' : ''}` : ''}. Le temps en ms est un aller-retour avec chacun : au-delà de 150, la course peut sauter.</p>
      ${liste.length < 2 ? '<button class="ligne" data-act="discord"><span><b>Trouver des joueurs</b><small>Le Discord de GRIP.</small></span><span class="valeur">›</span></button>' : ''}`;
  };
  const contenuQuitter = () => `<p>${etat.table.role === 'hote' ? 'Tu es l\'hôte : la table se fermera pour tout le monde.' : 'Tu pourras revenir avec le même code.'}</p>
      <div class="choix"><button class="danger" data-act="table-quitter"><span><b>Quitter la table</b></span></button><button data-act="fermer"><span><b>Rester</b></span></button></div>`;

  // la course du calendrier : monter, descendre, retirer
  let mancheChoisie = 0;
  const contenuManche = () => {
    const n = CH().calendrier.length, i = mancheChoisie;
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
        <div class="carte ${nuit() ? 'nuit' : ''}" style="background-image:url('${RACINE}${esc(c.art)}')"><img class="trace" src="${esc(nuit() ? c.traceNuit : c.trace)}" alt=""><span class="bandeau-nom"><span class="nom titre">${esc(c.pays)}</span>${drapeau(c)}<small>${points(c.difficulte)}</small></span></div>
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

  // ---------- le championnat : son écran de départ, son calendrier, son classement ----------
  // le barème et les pilotes sont ceux du départ ; avant, la voiture choisie et les adversaires du réglage
  // la catégorie fait le barème ; une table « Toutes catégories » prend celui de 25 points
  const catChamp = () => { const ch = CH(); return ch.actif && ch.cat ? ch.cat : etat.table ? etat.table.reglages.cat : voiture().cat; };
  const bareme = () => D.baremes[catChamp()] || { points: D.baremes.f1.points, texte: '25 pts pour la victoire.', pole: false };
  // en contre-la-montre, pas de point de pole : la manche est elle-même une qualification
  const texteBareme = () => champCLM() ? `${pts(bareme().points[0])} pts pour le meilleur tour de la séance, ${pts(bareme().points[1])} pour le deuxième ; pas de point de pole.` : bareme().texte;
  // les pilotes : à la table, ceux de la table et l'IA (aucune en contre-la-montre ni en duel)
  const concurrents = () => {
    const ch = CH();
    if (ch.actif && ch.pilotes) return ch.pilotes;
    if (etat.table) { const r = etat.table.reglages, noms = pilotes().map((m) => m.nom), ia = r.format === 'ghost' ? 0 : r.ia < 0 ? Math.max(0, 10 - noms.length) : r.ia; return [...noms, ...D.pilotes.slice(0, ia)]; }
    return ['Toi', ...D.pilotes.slice(0, Math.max(1, etat.adversaires || 9))];
  };
  // à égalité de points, le plus de victoires, puis de deuxièmes places, et ainsi de suite
  const departage = (a, b) => { const pl = CH().places, pa = (pl[a] || []).slice().sort((x, y) => x - y), pb = (pl[b] || []).slice().sort((x, y) => x - y); for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 99) !== (pb[i] || 99)) return (pa[i] || 99) - (pb[i] || 99); return 0; };
  const classement = () => concurrents().map((nom) => ({ nom, pts: CH().points[nom] || 0 })).sort((a, b) => b.pts - a.pts || departage(a.nom, b.nom));
  // une ligne du classement ; la flèche dit combien de places on a gagnées ou perdues à la dernière course
  const ligneClassement = (p, i, { gain, fleche } = {}) => {
    const avant = CH().avant[p.nom], d = fleche && avant ? avant - (i + 1) : 0;
    const f = !fleche || !avant ? '' : d > 0 ? `<span class="mvt haut" aria-label="gagne ${d} place${d > 1 ? 's' : ''}">▲${d}</span>` : d < 0 ? `<span class="mvt bas" aria-label="perd ${-d} place${d < -1 ? 's' : ''}">▼${-d}</span>` : '<span class="mvt" aria-label="même place">=</span>';
    return `<li class="${p.nom === 'Toi' ? 'moi' : ''}"><span class="pos">${i + 1}</span><b>${esc(p.nom)}${p.temps ? ` <small>${temps(p.temps)}</small>` : ''}</b>${f}<span class="pts">${gain ? '+' : ''}${pts(p.pts)} pts</span></li>`;
  };
  // les premiers, et ta ligne si tu es plus loin
  const tete = (liste, n, rendu) => { const moi = liste.findIndex((p) => p.nom === 'Toi'); return liste.slice(0, n).map(rendu).join('') + (moi >= n ? `<li class="saut" aria-hidden="true">…</li>${rendu(liste[moi], moi)}` : ''); };

  // le calendrier : modifiable sur l'écran de départ ; lancé, il se lit (courues, la prochaine, à venir)
  function sectionsChamp(fige) {
    const ch = CH(), n = ch.calendrier.length, clm = champCLM();
    const pas = (act, cle, val, txt, nom, min, max) => fige ? `<span class="valeur">${txt}</span>`
      : `<span class="pas"><button data-act="${act}" data-id="${cle}" data-pas="-1" aria-label="${nom} : moins" ${val <= min ? 'disabled' : ''}>−</button><span>${txt}</span><button data-act="${act}" data-id="${cle}" data-pas="1" aria-label="${nom} : plus" ${val >= max ? 'disabled' : ''}>+</button></span>`;
    const seance = (cle, nom) => `<div class="ligne"><span><b>${nom}</b><small>${ch[cle] ? ch[cle] + ' min avant chaque course' : 'Pas de séance'}</small></span>${pas('champ-seance', cle, ch[cle], ch[cle] ? ch[cle] + ' min' : '—', nom, 0, 60)}</div>`;
    // une manche de course a ses tours, une manche de contre-la-montre la durée de sa séance
    const duree = (m, i) => clm ? (fige ? `<small>séance de ${m.minutes} min</small>` : `<span class="pas petit"><button data-act="manche-minutes" data-id="${i}" data-pas="-1" aria-label="Une minute de moins" ${m.minutes <= 1 ? 'disabled' : ''}>−</button><span>${m.minutes} min</span><button data-act="manche-minutes" data-id="${i}" data-pas="1" aria-label="Une minute de plus" ${m.minutes >= 60 ? 'disabled' : ''}>+</button></span>`)
      : fige ? `<small>${m.tours} tours</small>` : `<span class="pas petit"><button data-act="manche-tours" data-id="${i}" data-pas="-1" aria-label="Un tour de moins" ${m.tours <= 1 ? 'disabled' : ''}>−</button><span>${m.tours} tours</span><button data-act="manche-tours" data-id="${i}" data-pas="1" aria-label="Un tour de plus" ${m.tours >= 99 ? 'disabled' : ''}>+</button></span>`;
    return `<section><h2 class="titre petit-titre">Calendrier <small>${fige ? `${motManche().toLowerCase()} ${ch.index + 1} sur ${n}` : `${n} / 10`}</small></h2>
          <ol class="manches">${ch.calendrier.map((m, i) => { const c = circuitPar(m.circuit), passee = fige && i < ch.index, prochaine = fige && i === ch.index; return `<li class="${passee ? 'passee' : ''} ${prochaine ? 'prochaine' : ''}">
            <span class="num">${i + 1}</span><span class="mini" style="background-image:url('${RACINE}${esc(c.art)}')"></span>
            <span class="infos"><b>${esc(c.nom)}</b>${duree(m, i)}</span>
            ${fige ? `<span class="statut" aria-label="${passee ? 'courue' : prochaine ? 'la prochaine' : 'à venir'}">${passee ? '✓' : prochaine ? '▶' : ''}</span>` : `<button class="trois-points" data-act="manche-menu" data-id="${i}" aria-label="${motManche()} ${i + 1} : avancer, reculer ou retirer">⋯</button>`}</li>`; }).join('')}</ol>
          ${fige ? '' : `<button class="ajouter" data-act="feuille" data-id="circuits-champ" ${n >= 10 ? 'disabled' : ''}>+ Ajouter un circuit</button>`}
          ${!n ? '<p class="aide">Ajoute au moins un circuit pour lancer le championnat.</p>' : ''}
        </section>
        <section><h2 class="titre petit-titre">Séances</h2>${seance('essais', 'Essais')}${clm ? '' : seance('qualifs', 'Qualifications')}</section>
        ${etat.table ? '' : `<section><h2 class="titre petit-titre">Grille de départ</h2>
          ${fige ? `<div class="ligne"><span><b>Adversaires</b></span><span class="valeur">${concurrents().length - 1}</span></div>` : ligneAdversaires()}
          <div class="ligne"><span><b>Ta place</b><small>${ch.place ? 'Fixée pour toutes les courses.' : 'Auto : les qualifications, ou le tirage.'}</small></span>${pas('champ-place', '', ch.place, ch.place || 'Auto', 'Ta place', 0, 10)}</div>
        </section>`}`;
  }
  // l'écran de départ du championnat, ouvert du menu : la voiture (sa catégorie fait le barème), le calendrier, les séances, la grille
  function rendChampDepart() {
    const v = voiture(), cat = categorie(v.cat), n = etat.champ.calendrier.length;
    const haut = app.querySelector('.defile')?.scrollTop || 0;
    app.innerHTML = `${bandeau('Championnat', 'menu')}
      <div class="defile">
        <section><h2 class="titre petit-titre">Voiture</h2>
          <button class="ligne ligne-voiture" data-act="feuille" data-id="garage"><img src="${imageDe(v)}" alt=""><span><b>${esc(v.nom)}</b><small>${esc(cat ? cat.nom : '')} : toutes les courses dans cette catégorie.</small></span><span class="valeur">Garage ›</span></button>
          <p class="bareme"><b>Barème ${esc(cat ? cat.nom : '')}</b> · ${esc(texteBareme())}</p></section>
        ${sectionsChamp(false)}
      </div>
      <footer class="barre-bas"><button class="enpiste" data-act="champ-lancer" ${n ? '' : 'disabled'}>Lancer →</button></footer>`;
    app.querySelector('.defile').scrollTop = haut;
  }
  // le calendrier en cours, depuis la carte du circuit du paddock : à lire seulement
  function rendCalendrier(el) {
    const haut = el.querySelector('.defile')?.scrollTop || 0;
    el.innerHTML = `<div class="app">${bandeau('Calendrier', 'fermer', etat.table ? 'Table' : 'Paddock')}
      <div class="defile">
        <p class="bareme"><b>Barème ${esc(nomCat(CH().cat))}</b> · ${esc(texteBareme())}</p>
        ${sectionsChamp(true)}
        <p class="aide">${etat.table ? 'Le calendrier est figé jusqu\'à la fin. L\'hôte peut arrêter le championnat dans « Réglages ».' : 'Le calendrier et la grille sont figés jusqu\'à la fin. Pour arrêter : « Réglages », « Abandonner le championnat ».'}</p>
      </div></div>`;
    el.querySelector('.defile').scrollTop = haut;
  }
  /* Le championnat de la table, réglé par l'hôte : dans les deux formats. En course, chaque manche est
  une course (sans IA, un duel) ; en contre-la-montre, une séance de qualifications où le meilleur tour
  de chacun fait le classement. Le format et la catégorie restent ceux de la table. */
  function rendChampTable(el) {
    const T = etat.table, r = T.reglages, n = T.champ.calendrier.length;
    const haut = el.querySelector('.defile')?.scrollTop || 0;
    const quoi = r.format === 'ghost' ? 'chaque manche est une séance de qualifications : le meilleur tour de chacun marque les points.'
      : `chaque manche est une course${r.ia === 0 ? ', un duel entre vous, sans IA' : ', avec l\'IA'}.`;
    el.innerHTML = `<div class="app">${bandeau('Championnat', 'fermer', 'Table')}
      <div class="defile">
        <p class="bareme"><b>${FORMATS[r.format]}</b> · ${quoi} Le format et la catégorie se règlent à la table.</p>
        <p class="bareme"><b>Barème ${esc(nomCat(r.cat))}</b> · ${esc(texteBareme())}</p>
        ${sectionsChamp(false)}
      </div>
      <footer class="barre-bas"><button class="enpiste" data-act="champ-lancer" ${n ? '' : 'disabled'}>Lancer →</button></footer></div>`;
    el.querySelector('.defile').scrollTop = haut;
  }
  // le classement complet, depuis la pastille du paddock
  const contenuClassement = () => {
    const ch = CH(), n = ch.calendrier.length, mot = motManche().toLowerCase();
    return `<p class="aide">${ch.index ? `Après ${ch.index} ${mot}${ch.index > 1 ? 's' : ''} sur ${n}. Les flèches : les places gagnées ou perdues à la dernière ${mot}.` : `Aucune ${mot} courue : le classement commence à la première.`}</p>
      <ol class="classement">${classement().map((p, i) => ligneClassement(p, i, { fleche: ch.index > 1 })).join('')}</ol>
      <p class="bareme"><b>Barème ${esc(nomCat(ch.cat))}</b> · ${esc(texteBareme())}</p>`;
  };

  // ---------- le départ, sans course ----------
  function depart({ annonce } = {}) {
    const c = circuit(), v = voiture(), T = etat.table;
    const champ = champEnCours(), ch = CH();
    let lignes, titre = 'En piste !';
    if (T) {
      const r = T.reglages;
      const ia = champ ? ch.ia : r.ia;
      lignes = [['Table', T.code], ['Format', r.format === 'race' && ia === 0 ? 'Course sans IA : duel' : FORMATS[r.format]], ...(champ ? [['Championnat', `${motManche()} ${ch.index + 1} sur ${ch.calendrier.length}`]] : []), ['Circuit', c.nom], ['Pilotes', pilotes().map((m) => m.nom).join(', ')],
        ...(r.format !== 'ghost' ? [['Tours', champ ? manche().tours : r.tours]] : champ ? [['Séance', `${manche().minutes} min`]] : []), ...(r.format === 'race' && ia !== 0 ? [['IA', ia < 0 ? 'Auto' : ia]] : []), ['Catégorie', r.cat === 'all' ? 'Toutes' : categorie(r.cat).nom], ['Dégâts', r.degats ? 'Activés' : 'Coupés'], ['Moment', nuit() ? 'Nuit' : 'Jour'], ...(T.role === 'spectateur' ? [] : [['Ta voiture', v.nom]])];
    } else {
      lignes = [['Mode', MODES[etat.mode]], ...(champ ? [['Course', `${ch.index + 1} sur ${ch.calendrier.length}`]] : []), ['Circuit', c.nom], ['Voiture', v.nom], ['Livrée', v.livrees[livreeDe(v)].nom], ['Moment', nuit() ? 'Nuit' : 'Jour'],
        ...(enCourse() ? [['Tours', champ ? manche().tours : etat.tours], ['Difficulté', niveau(etat.difficulte).nom], ['Adversaires', champ ? concurrents().length - 1 : etat.adversaires || 'Auto'], ['Dégâts', etat.degats ? 'Activés' : 'Coupés']] : []),
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
  /* Une arrivée tirée au sort, plus favorable en facile ; les points du barème, un de plus pour la pole.
  L'écran d'arrivée montre la course, puis le classement du championnat avec les places gagnées ou
  perdues. À la dernière course, le bouton mène au podium. */
  function simuleArrivee(boite) {
    const ch = CH(), b = bareme(), noms = concurrents(), m = manche(), c = circuitPar(m.circuit), clm = champCLM();
    const chance = { easy: 0.2, medium: 0.4, hard: 0.55, extreme: 0.7, cauchemar: 0.85 }[etat.difficulte] ?? 0.4;
    const graine = hache(c.id + ch.index + Date.now());
    const maPlace = Math.min(noms.length - 1, Math.floor(Math.pow(graine, 1.6) * noms.length * chance * 1.6));
    const autres = noms.filter((n) => n !== 'Toi').sort((a, z) => hache(a + ch.index + graine) - hache(z + ch.index + graine));
    if (noms.includes('Toi')) autres.splice(Math.min(maPlace, autres.length), 0, 'Toi');   // un spectateur n'est pas classé
    // en contre-la-montre, le meilleur tour de chacun ; pas de pole : la manche est la qualification
    const base = chronoMonde(voiture(), c);
    const gagnes = autres.map((nom, i) => ({ nom, pts: (b.points[i] || 0) + (!clm && b.pole && ch.qualifs && i === 0 ? 1 : 0), temps: clm ? base * (1.004 + i * 0.0035 + hache(nom + graine) * 0.002) : 0 }));
    ch.avant = ch.index ? Object.fromEntries(classement().map((p, i) => [p.nom, i + 1])) : {};
    gagnes.forEach((g, i) => { ch.points[g.nom] = (ch.points[g.nom] || 0) + g.pts; (ch.places[g.nom] = ch.places[g.nom] || []).push(i + 1); });
    ch.index += 1;
    const n = ch.calendrier.length, derniere = ch.index >= n;
    const general = classement(), moi = general.findIndex((p) => p.nom === 'Toi') + 1;
    if (derniere) { ch.fini = moi; ch.actif = false; }
    // à la table, la course suivante attend que chacun soit prêt (les amis simulés le sont tout de suite)
    if (etat.table) for (const mb of etat.table.membres) mb.pret = !mb.moi;
    boite.classList.add('arrivee');
    boite.innerHTML = `<h2 class="titre">${clm ? 'Fin de la séance' : 'Arrivée'}</h2><p class="sous">${esc(c.nom)} · ${motManche().toLowerCase()} ${ch.index} sur ${n} · simulée</p>
      <ol class="classement serre">${tete(gagnes, 3, (g, i) => ligneClassement(g, i, { gain: true }))}</ol>
      <h3 class="titre petit-titre">Championnat <small>${derniere ? 'final' : `après ${ch.index} ${motManche().toLowerCase()}${ch.index > 1 ? 's' : ''} sur ${n}`}</small></h3>
      <ol class="classement serre">${tete(general, 5, (p, i) => ligneClassement(p, i, { fleche: ch.index > 1 }))}</ol>
      <button class="enpiste" style="margin:4px 0 0" data-act="${derniere ? 'champ-podium' : 'retour-depart'}">${derniere ? 'Voir le podium →' : `${motManche()} suivante →`}</button>`;
    boite.querySelector('.enpiste').focus();
    if (derniere) sauve(); else rend();
  }
  // le podium, après la dernière course : les trois premiers sur leurs marches, puis ta place
  function podium(boite) {
    const ch = CH(), cl = classement(), moi = cl.findIndex((p) => p.nom === 'Toi') + 1, mes = cl[moi - 1];
    const T = etat.table, relance = !T || T.role === 'hote', mot = motManche().toLowerCase();
    const marche = (p, i) => `<li class="marche m${i + 1} ${p.nom === 'Toi' ? 'moi' : ''}"><b>${esc(p.nom)}</b><small>${pts(p.pts)} pts</small><span class="socle titre" aria-label="${rang(i + 1)}">${i + 1}</span></li>`;
    boite.className = 'boite podium-boite';
    boite.innerHTML = `<h2 class="titre">${moi === 1 ? 'Champion !' : 'Podium'}</h2>
      <p class="sous">Championnat ${esc(nomCat(ch.cat))}${champCLM() ? ' · contre-la-montre' : ''} · ${ch.calendrier.length} ${mot}${ch.calendrier.length > 1 ? 's' : ''}</p>
      <ol class="podium">${cl.slice(0, 3).map(marche).join('')}</ol>
      <p class="bandeau-info ${!moi || moi > 3 ? 'neutre' : ''}">${!moi ? `${esc(cl[0].nom)} gagne le championnat.` : moi === 1 ? `Tu gagnes le championnat avec ${pts(mes.pts)} points.` : moi <= 3 ? `Tu montes sur le podium : ${rang(moi)}, ${pts(mes.pts)} points.` : `Tu finis ${rang(moi)} sur ${cl.length}, avec ${pts(mes.pts)} points.`}</p>
      ${relance ? '<button class="enpiste" style="margin:4px 0 0" data-act="champ-nouveau">Nouveau championnat</button>' : ''}
      <button class="${relance ? 'chip' : 'enpiste'}" data-act="champ-menu">${T ? 'Table' : 'Menu'}</button>`;
    boite.querySelector('button').focus();
  }

  let minuteur = 0;
  function toast(txt) { const t = $('#toast'); t.textContent = txt; t.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(() => { t.hidden = true; }, 3200); }

  // ---------- les actions ----------
  const FEUILLES = {
    circuits: () => { acteCircuit = 'circuit'; return ['Circuit', contenuCircuits, 'haute']; },
    'circuits-champ': () => { acteCircuit = 'champ-ajoute'; return ['Ajouter un circuit', contenuCircuits, 'haute']; },
    'circuits-table': () => { acteCircuit = 'table-circuit'; return ['Circuit de la table', contenuCircuits, 'haute']; },
    garage: () => ['Garage', contenuGarage, 'haute'],
    reglages: () => [etat.table && etat.table.role !== 'hote' ? 'Réglages de la course' : 'Réglages', contenuReglages, 'moyenne'],
    freinage: () => ['Freinage', contenuFreinage, 'moyenne'],
    difficulte: () => ['Difficulté', contenuDifficulte, 'moyenne'],
    format: () => ['Format', contenuFormat, 'moyenne'],
    pilotes: () => ['Pilotes', contenuPilotes, 'haute'],
    categorie: () => ['Catégorie', contenuCategorie, 'haute'],
    manche: () => [`${motManche()} ${mancheChoisie + 1} · ${circuitPar(CH().calendrier[mancheChoisie].circuit).nom}`, contenuManche, 'moyenne'],
    classement: () => ['Classement', contenuClassement, 'haute'],
    abandon: () => [etat.table ? 'Arrêter le championnat ?' : 'Abandonner le championnat ?', contenuAbandon, 'moyenne'],
  };
  const montreMoi = () => etat.table && (etat.table.membres.find((m) => m.moi).voiture = etat.voiture);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const id = b.dataset.id, v = voiture(), ch = CH(), T = etat.table;
    switch (b.dataset.act) {
      case 'mode': etat.mode = id; etat.ecran = 'paddock'; rend(); break;
      // le championnat, au menu : son paddock s'il est en cours, sinon son écran de départ
      case 'champ': etat.mode = 'champ'; etat.ecran = ch.actif ? 'paddock' : 'champ'; rend(); break;
      case 'menu': etat.ecran = 'menu'; rend(); break;
      case 'multi': etat.ecran = 'multi'; rend(); break;
      case 'feuille':
        if (!id && T) { ouvreFeuille('quitter', 'Quitter la table ?', contenuQuitter, 'moyenne'); break; }
        if (id === 'garage') { voitureAvant = etat.voiture; etat.filtre = null; }
        ouvreFeuille(id, ...FEUILLES[id]()); break;
      case 'fermer': history.back(); break;
      case 'page-circuit': ouvrePage(rendPage); break;
      case 'page-calendrier': ouvrePage(rendCalendrier); break;
      case 'page-champ-table': ouvrePage(rendChampTable); break;
      case 'circuit': etat.circuit = id; rend(); history.back(); break;
      case 'voiture': etat.voiture = id; if (T) { montreMoi(); T.membres.find((m) => m.moi).pret = false; } rafraichit(); break;
      case 'filtre': etat.filtre = id; rafraichit(); break;
      case 'filtre-chronos': filtreChronos = id; rafraichit(); break;
      case 'livree': etat.livrees[v.id] = (livreeDe(v) + Number(id) + v.livrees.length) % v.livrees.length; rafraichit(); break;
      case 'livree-n': etat.livrees[v.id] = Number(id); rafraichit(); break;
      case 'tours': if (T) T.reglages.tours = Math.max(1, Math.min(10, T.reglages.tours + Number(id))); else etat.tours = Math.max(1, Math.min(99, etat.tours + Number(id))); rend(); break;
      case 'nuit': if (T) T.reglages.nuit = !T.reglages.nuit; else etat.nuit = !etat.nuit; rafraichit(); break;
      case 'difficulte': etat.difficulte = id; rend(); history.back(); break;
      case 'degats': etat.degats = !etat.degats; rafraichit(); break;
      case 'adversaires': etat.adversaires = Math.max(0, Math.min(11, etat.adversaires + Number(id))); rafraichit(); break;
      case 'freinage': etat.freinage = id; rafraichit(); history.back(); break;
      case 'regler': toast('Dans le jeu : la course part en mode RÉGLER, des tours d\'essai pour régler le freinage de ce circuit avec cette voiture.'); break;
      case 'enpiste': depart(); break;
      case 'retour-depart': b.closest('.depart').remove(); break;
      // le championnat
      case 'champ-ajoute': if (ch.calendrier.length < 10) ch.calendrier.push({ circuit: id, tours: T ? T.reglages.tours : etat.tours, minutes: 10 }); ch.fini = null; rafraichit(); history.back(); break;
      case 'manche-tours': { const m = ch.calendrier[Number(id)]; m.tours = Math.max(1, Math.min(99, m.tours + Number(b.dataset.pas))); rafraichit(); break; }
      case 'manche-minutes': { const m = ch.calendrier[Number(id)]; m.minutes = Math.max(1, Math.min(60, (m.minutes || 10) + Number(b.dataset.pas))); rafraichit(); break; }
      case 'manche-menu': mancheChoisie = Number(id); ouvreFeuille('manche', ...FEUILLES.manche()); break;
      case 'manche-monter': case 'manche-descendre': { const i = mancheChoisie, j = i + (b.dataset.act === 'manche-monter' ? -1 : 1); [ch.calendrier[i], ch.calendrier[j]] = [ch.calendrier[j], ch.calendrier[i]]; history.back(); setTimeout(rafraichit, 30); break; }
      case 'manche-retirer': ch.calendrier.splice(mancheChoisie, 1); history.back(); setTimeout(rafraichit, 30); break;
      case 'champ-seance': ch[id] = Math.max(0, Math.min(60, ch[id] + Number(b.dataset.pas))); rafraichit(); break;
      case 'champ-place': ch.place = Math.max(0, Math.min(10, ch.place + Number(b.dataset.pas))); rafraichit(); break;
      // lancé, le championnat garde sa catégorie et ses pilotes jusqu'au bout
      case 'champ-lancer':
        if (T) {   // à la table : le format, la catégorie, les pilotes et l'IA du moment, jusqu'au bout
          const noms = concurrents();
          Object.assign(ch, { actif: true, index: 0, points: {}, places: {}, avant: {}, fini: null, cat: T.reglages.cat, format: T.reglages.format, pilotes: noms, ia: T.reglages.format === 'ghost' ? 0 : noms.length - pilotes().length });
          for (const mb of T.membres) mb.pret = !mb.moi;
          history.back(); setTimeout(rafraichit, 30); break;
        }
        Object.assign(ch, { actif: true, index: 0, points: {}, places: {}, avant: {}, fini: null, cat: v.cat, pilotes: concurrents() }); etat.mode = 'champ'; etat.ecran = 'paddock'; rend(); break;
      case 'champ-abandon': Object.assign(ch, { actif: false, index: 0, points: {}, places: {}, avant: {}, fini: null }); if (!T) etat.ecran = 'menu'; fermeTout(); setTimeout(rend, 40); break;
      case 'champ-simuler': simuleArrivee(b.closest('.boite')); break;
      case 'champ-podium': podium(b.closest('.boite')); break;
      case 'champ-nouveau': b.closest('.depart').remove(); Object.assign(ch, { index: 0, points: {}, places: {}, avant: {}, fini: null });
        if (T) { rend(); ouvrePage(rendChampTable); break; }
        etat.mode = 'champ'; etat.ecran = 'champ'; rend(); break;
      case 'champ-menu': b.closest('.depart').remove(); if (!T) etat.ecran = 'menu'; rend(); break;
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
      case 'table-format': T.reglages.format = id; rafraichit(); history.back(); break;
      case 'table-circuit': T.reglages.circuit = id; rafraichit(); history.back(); break;
      case 'table-cat': T.reglages.cat = id; if (id !== 'all' && voiture().cat !== id) { etat.voiture = voitureAuHasard(id, 'moi'); montreMoi(); } for (const m of T.membres) if (!m.moi && id !== 'all' && voiturePar(m.voiture).cat !== id) m.voiture = voitureAuHasard(id, m.nom); rafraichit(); history.back(); break;
      case 'table-ia': T.reglages.ia = Math.max(-1, Math.min(12, T.reglages.ia + Number(id))); rafraichit(); break;
      case 'table-degats': T.reglages.degats = !T.reglages.degats; rafraichit(); break;
    }
  });

  fetch('donnees.json').then((r) => r.json()).then((d) => {
    D = d;
    etat = Object.assign(defaut(), lit() || {});
    etat.champ = Object.assign(champVide(), etat.champ || {});
    etat.table = null;
    if (etat.ecran === 'table') etat.ecran = 'multi';
    // un championnat fini ou abandonné : on revient à son écran de départ
    if (etat.mode === 'champ' && !etat.champ.actif && etat.ecran === 'paddock') etat.ecran = 'champ';
    if (etat.champ.actif && !etat.champ.pilotes) Object.assign(etat.champ, { cat: voiture().cat, pilotes: concurrents() });
    if (!D.circuits.some((c) => c.id === etat.circuit)) etat.circuit = D.circuits[0].id;
    if (!D.voitures.some((v) => v.id === etat.voiture)) etat.voiture = D.voitures[0].id;
    rend();
  }).catch(() => { app.innerHTML = '<p style="padding:20px">Les données de la maquette n\'ont pas pu être lues (donnees.json).</p>'; });
})();
