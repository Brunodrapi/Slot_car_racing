/* Le palmarès : pour chaque circuit et chaque voiture, le plus haut niveau où l'on a gagné.

Bruno a retiré la note de pilotage des voitures (les pneus) et voulu à la place un but par couple
circuit/voiture : finir PREMIER, et le plus haut possible dans l'échelle de difficulté. Chaque niveau
a son trophée :

    facile → chocolat · normal → bronze · difficile → argent · extrême → or · cauchemar → crâne

La médaille en chocolat est celle qu'on donne au quatrième ; ici elle récompense une victoire en
facile, ce qui revient au même. Le crâne est le seul trophée qui ne soit pas une médaille, et c'est
voulu : c'est celui qu'on montre.

LES RÈGLES, et pourquoi.
- Course rapide seulement : ni le contre-la-montre (on y est seul), ni le multijoueur (l'adversaire
  n'est pas un niveau), ni le championnat (sa difficulté est celle de la saison), ni une séance de
  réglage du frein.
- Premier à l'arrivée, après pénalités : c'est le classement que montre l'écran des résultats.
- Trois tours au moins. Une course d'un tour se gagne au départ ; trois tours laissent à l'ordinateur
  le temps de rattraper un bon envol.
- Les aides sont permises (guide de freinage, aimant, anticipation) : le tableau mondial les refuse
  parce qu'il compare des temps ; ici on ne compare personne, et sans elles le chocolat n'aurait
  plus de sens.
- On garde le meilleur : gagner en Normal après l'Or ne retire pas l'Or.

LE PALMARÈS VIT SUR L'APPAREIL (`save.palmares`), comme les records personnels. Connecté avec Google,
il est AUSSI fusionné avec celui du compte (`supabase/palmares.sql`) : un seul appel envoie ce que
l'appareil a de mieux et rend tout le palmarès du compte, gagné ici ou ailleurs. Hors connexion,
réseau coupé ou base pas encore prête, rien ne casse : le palmarès local reste ce qu'il est. */
'use strict';

// L'échelle, dans l'ordre des niveaux de difficulté (voir `NIVEAUX`, js/ui.js).
const TROPHEES = ['chocolat', 'bronze', 'argent', 'or', 'crane'];
const NIVEAUX_TROPHEE = ['easy', 'medium', 'hard', 'extreme', 'cauchemar'];
const TOURS_MIN_TROPHEE = 3;

/** Le rang du trophée d'un niveau de difficulté (0 chocolat … 4 crâne), ou -1. */
function rangTrophee(difficulte) { return NIVEAUX_TROPHEE.indexOf(difficulte); }

/** Le trophée d'un couple circuit/voiture dans la sauvegarde, ou -1. */
function tropheeDe(save, circuit, voiture) {
  const n = save && save.palmares ? save.palmares[`${circuit}|${voiture}`] : undefined;
  return Number.isInteger(n) && n >= 0 && n < TROPHEES.length ? n : -1;
}

/* Ce que la course qui vient de finir rapporte, et l'inscrire.

Rend `null` si la course ne compte pas du tout (autre mode, joueur pas premier…), sinon
{ rang, ancien, nouveau, raison } : `nouveau` dit si le palmarès a monté, `raison` explique une
victoire qui ne rapporte rien (« tours »). */
function attribueTrophee(save, race, ctx) {
  ctx = ctx || {};
  if (!race || race.mode !== 'race' || ctx.online || ctx.cup || ctx.spectator || race.reglage) return null;
  const moi = race.results && race.results.find((r) => r.car.isPlayer);
  if (!moi || moi.pos !== 1 || !race.player.finished) return null;
  const rang = rangTrophee(race.opts.difficulty || 'medium');
  if (rang < 0) return null;
  const circuit = race.track.id, voiture = race.cls.id, ancien = tropheeDe(save, circuit, voiture);
  if ((race.laps || 0) < TOURS_MIN_TROPHEE) return { rang, ancien, nouveau: false, raison: 'tours', circuit, voiture };
  if (!save.palmares) save.palmares = {};
  const nouveau = rang > ancien;
  if (nouveau) save.palmares[`${circuit}|${voiture}`] = rang;
  return { rang, ancien, nouveau, raison: null, circuit, voiture };
}

/* Les cinq trophées, en SVG, dessinés comme les pictogrammes du jeu : aplats, contour sombre.

Une médaille pendue à son ruban pour les quatre premiers — le métal se lit à la couleur, et une
étoile en relief la distingue d'un jeton. La médaille en chocolat a une bouchée en moins. Le crâne
est posé sur un disque noir, au bout du même ruban : il reste de la famille, mais on ne le confond
avec aucun autre, même à seize pixels. */
const TROPHEE_COULEURS = {
  chocolat: { bord: '#6b4423', face: '#4e2f17', reflet: '#8a5a2f' },
  bronze: { bord: '#8f5428', face: '#c47f45', reflet: '#e9b27c' },
  argent: { bord: '#7f868c', face: '#c3c9ce', reflet: '#f2f4f5' },
  or: { bord: '#a9790a', face: '#f0bf2c', reflet: '#ffe68c' },
  crane: { bord: '#111311', face: '#262a27', reflet: '#3a3f3b' },
};
function tropheeSVG(rang, taille = 28, titre = '') {
  const nom = TROPHEES[rang];
  if (!nom) return '';
  const c = TROPHEE_COULEURS[nom], trait = '#171c19';
  const ruban = `<path d="M8.5 1.5h6l3.2 11.5h-6z" fill="#c92c23" stroke="${trait}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M23.5 1.5h-6l-3.2 11.5h6z" fill="#264f8f" stroke="${trait}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const etoile = 'M16 14.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z';
  let face;
  if (nom === 'crane') {
    face = `<circle cx="16" cy="20.5" r="10" fill="${c.face}" stroke="${trait}" stroke-width="1.4"/>
      <circle cx="16" cy="20.5" r="8.3" fill="none" stroke="${c.reflet}" stroke-width="1"/>
      <path d="M16 13.2c-3.7 0-6.2 2.6-6.2 6 0 2 .9 3.4 2.1 4.2v2.4h8.2v-2.4c1.2-.8 2.1-2.2 2.1-4.2 0-3.4-2.5-6-6.2-6z" fill="#f3eee2" stroke="${trait}" stroke-width=".9"/>
      <ellipse cx="13.5" cy="19.6" rx="1.7" ry="1.9" fill="${trait}"/><ellipse cx="18.5" cy="19.6" rx="1.7" ry="1.9" fill="${trait}"/>
      <path d="M16 21.6l-1 1.6h2z" fill="${trait}"/>
      <path d="M13.9 23.9v2M15.3 23.9v2M16.7 23.9v2M18.1 23.9v2" stroke="${trait}" stroke-width=".7"/>`;
  } else {
    // la bouchée est découpée dans le tracé du disque lui-même : un masque ou un disque de la couleur
    // du fond se perdrait sur certains fonds, ou dans un écran caché au moment où il est défini
    const disque = nom === 'chocolat'
      ? 'M25.44 17.19A10 10 0 1 1 21.82 12.37A3.6 3.6 0 0 0 25.44 17.19Z'
      : 'M26 20.5A10 10 0 1 1 6 20.5A10 10 0 1 1 26 20.5Z';
    face = `<path d="${disque}" fill="${c.bord}" stroke="${trait}" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="16" cy="20.5" r="7.6" fill="${c.face}"/>
      <path d="M10.6 16.4a7.6 7.6 0 0 1 8.6-3.2" fill="none" stroke="${c.reflet}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="${etoile}" fill="${c.reflet}" stroke="${c.bord}" stroke-width=".6" stroke-linejoin="round"/>`;
  }
  return `<svg class="trophee trophee-${nom}" viewBox="0 0 32 32" width="${taille}" height="${taille}" role="img"${titre ? ` aria-label="${titre}"` : ' aria-hidden="true"'}>${ruban}${face}</svg>`;
}

/* La synchronisation avec le compte.

`etat` vaut null (pas tentée), 'en-cours', 'ok', 'indisponible' (la base n'a pas encore la fonction :
le palmarès reste local, sans alarme) ou 'erreur'. `onEtat` repeint l'écran qui l'affiche. */
const PalmaresSync = {
  etat: null,
  onEtat: () => {},
  canal() { return typeof APP_CANAL !== 'undefined' && APP_CANAL === 'prod' ? 'prod' : 'recette'; },

  async synchronise(mondial, save) {
    if (!mondial || !mondial.connecte() || this._enCours) return false;
    this._enCours = true;
    this.etat = 'en-cours'; this.onEtat();
    try {
      const lignes = Object.entries(save.palmares || {})
        .map(([cle, n]) => { const [c, v] = cle.split('|'); return { c, v, n }; })
        .filter((l) => l.c && l.v && Number.isInteger(l.n) && l.n >= 0 && l.n < TROPHEES.length);
      const r = await fetch(`${MONDIAL_URL}/rest/v1/rpc/synchro_palmares`, {
        method: 'POST',
        headers: { apikey: MONDIAL_KEY, Authorization: `Bearer ${mondial.session.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ p_canal: this.canal(), p_lignes: lignes }),
      });
      if (r.status === 401) { mondial.sortir(); throw new Error('session'); }
      // 404 : la fonction n'existe pas encore en base (`supabase/palmares.sql` pas joué)
      if (r.status === 404) { this.etat = 'indisponible'; return false; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const compte = await r.json();
      if (!save.palmares) save.palmares = {};
      let change = false;
      for (const l of compte || []) {
        const cle = `${l.circuit}|${l.voiture}`, n = +l.niveau;
        if (Number.isInteger(n) && n >= 0 && n < TROPHEES.length && !(save.palmares[cle] >= n)) { save.palmares[cle] = n; change = true; }
      }
      if (change) storeSave(save);
      this.etat = 'ok';
      return change;
    } catch (e) {
      this.etat = 'erreur';
      this.erreur = String(e.message || e);
      return false;
    } finally {
      this._enCours = false;
      this.onEtat();
    }
  },
};

if (typeof module !== 'undefined') module.exports = { TROPHEES, NIVEAUX_TROPHEE, TOURS_MIN_TROPHEE, rangTrophee, tropheeDe, attribueTrophee, tropheeSVG };
