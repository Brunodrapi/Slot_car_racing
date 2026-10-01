/* Les records mondiaux : lecture publique, écriture par le serveur seul.

Ce fichier ne contient volontairement aucune bibliothèque. Le jeu est une poignée de fichiers
statiques sans étape de construction, et `supabase-js` aurait apporté un paquet entier pour trois
requêtes HTTP qu'on écrit en vingt lignes. Le prix à payer est la connexion Google, faite à la main
plus bas ; il reste inférieur à celui d'une dépendance dans un projet qui n'en a aucune.

Trois choses vivent ici, et une seule sort d'ici vers le reste du jeu : `Mondial`.

  1. La LECTURE des records. Elle passe par l'API REST, avec la clé publiable, et elle est ouverte
     à tous — y compris à qui n'a pas de compte. Un tableau qu'il faut mériter de voir ne sert à
     rien : c'est ce qu'on regarde avant de jouer.

  2. L'ÉCRITURE d'un temps. Elle ne passe PAS par l'API REST. La table est fermée en écriture, et
     un temps ne s'inscrit que par une fonction serveur qui le vérifie d'abord. C'est le seul
     moyen : la clé publiable vit dans le code de la page, donc tout le monde l'a, et une table
     ouverte en écriture se remplirait de tours en une milliseconde.

  3. La CONNEXION Google, exigée pour écrire et pour elle seule. On joue, on s'améliore et on lit
     le tableau sans compte ; il ne faut un compte que pour y entrer. C'est aussi ce qui permet de
     retrouver ses temps après un changement d'appareil ou de nom.

Rien ici n'est indispensable au jeu. Toute panne — réseau coupé, service indisponible, session
expirée — se termine par un tableau mondial vide et une course qui continue. Un jeu hors-ligne qui
refuse de démarrer parce qu'un serveur de scores ne répond pas serait un jeu cassé par son
classement.
*/
'use strict';

const MONDIAL_URL = 'https://fyaifqvghkvrydcldiup.supabase.co';
/* Cette clé est PUBLIQUE par construction : elle est faite pour vivre dans le code d'une page web,
   elle part dans chaque requête et n'importe qui peut la lire. Ce qu'elle autorise est décidé par
   les règles de la base, pas par son secret. Sa jumelle `sb_secret_…` contourne toutes ces règles
   et ne doit jamais approcher ce fichier. */
const MONDIAL_KEY = 'sb_publishable_O5veQvYKXfUt6e7iKtrDUg_rqPC_CS9';

class Mondial {
  constructor() {
    this.session = null;        // { token, expire, nom, sub } une fois connecté
    this.cache = new Map();     // circuit → { t, lignes } : une lecture par circuit, pas par ligne
    this.erreur = null;
    this.dernierRefus = null;      // le dernier temps refusé par le serveur, et pourquoi
    this.erreurConnexion = null;   // un retour de connexion qui a mal tourné
    this.envoi = null;             // l'état du rattrapage : { total, faits, rien }
    this.envoyes = new Set();
    try { this.envoyes = new Set(JSON.parse(localStorage.getItem('eol.envoyes') || '[]')); } catch (_) {}
    this._litSession();
    this._litRetour();
  }

  /* La session, relue du navigateur puis du fragment d'URL.

  Supabase renvoie le jeton dans le `#fragment` de l'adresse de retour, qui n'est jamais transmis
  au serveur. On le range, et on NETTOIE L'ADRESSE tout de suite : laissé là, il reste dans
  l'historique, dans un favori, dans un lien partagé — un jeton d'accès dans une barre d'adresse
  est un jeton qui finit par circuler. */
  _litSession() {
    try {
      const s = JSON.parse(localStorage.getItem('eol.session') || 'null');
      if (s && s.expire > Date.now() / 1000 + 60) this.session = s;
    } catch (_) { /* un stockage illisible n'est pas une raison de ne pas démarrer */ }
  }

  _litRetour() {
    const h = location.hash || '';
    /* Un retour RATÉ doit se voir autant qu'un retour réussi.

    Quand Google ou Supabase refuse, on ne revient pas les mains vides : on revient avec une
    erreur, dans le fragment ou dans la requête selon l'étage qui a refusé. Ne lire que le cas qui
    marche donnait exactement ce que le joueur décrit — « ça me ramène à l'accueil et rien ne se
    passe ». Le refus était écrit dans la barre d'adresse, et personne ne le lisait. */
    const q = new URLSearchParams((location.search || '').slice(1));
    const hq = new URLSearchParams(h.slice(1));
    const err = hq.get('error_description') || hq.get('error') || q.get('error_description') || q.get('error');
    if (err) {
      this.erreurConnexion = err;
      try { sessionStorage.removeItem('eol.parti'); } catch (_) {}
      history.replaceState(null, '', location.pathname);
      return;
    }
    /* Le flux PKCE revient avec `?code=`, pas avec un jeton. On ne sait pas l'échanger ici — il
    faudrait garder le vérificateur entre deux chargements de page — donc on le DIT plutôt que de
    laisser le joueur devant un écran qui n'a rien à lui montrer. */
    if (!h.includes('access_token=') && q.get('code')) {
      this.erreurConnexion = 'pkce';
      try { sessionStorage.removeItem('eol.parti'); } catch (_) {}
      history.replaceState(null, '', location.pathname);
      return;
    }
    if (h.indexOf('access_token=') < 0) {
      /* Parti se connecter, revenu sans rien : c'est un échec, et il faut le dire.

      On garde ce que portait l'adresse — les NOMS des paramètres, jamais leurs valeurs : un jeton
      ou un code d'autorisation n'a rien à faire à l'écran ni dans une capture envoyée pour
      diagnostic. Les noms suffisent à distinguer les cas, et c'est tout ce qu'on cherche. */
      let parti = 0;
      try { parti = +(sessionStorage.getItem('eol.parti') || 0); } catch (_) {}
      if (parti && Date.now() - parti < 600000) {
        const noms = [...hq.keys(), ...q.keys()];
        this.erreurConnexion = 'vide';
        this.retourVide = noms.length ? noms.join(', ') : 'aucun paramètre';
        try { sessionStorage.removeItem('eol.parti'); } catch (_) {}
      }
      return;
    }
    try { sessionStorage.removeItem('eol.parti'); } catch (_) {}
    const p = new URLSearchParams(h.slice(1));
    const token = p.get('access_token');
    if (token) {
      const charge = decodeJwt(token) || {};
      this.session = {
        token,
        expire: +p.get('expires_at') || charge.exp || 0,
        sub: charge.sub || '',
        nom: (charge.user_metadata && charge.user_metadata.full_name) || charge.email || '',
      };
      try { localStorage.setItem('eol.session', JSON.stringify(this.session)); } catch (_) {}
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  connecte() { return !!(this.session && this.session.expire > Date.now() / 1000 + 60); }

  /* Partir se connecter chez Google, et revenir ici même.

  `redirect_to` doit être déclaré dans le tableau de bord Supabase, sinon la redirection est
  refusée au retour — c'est la protection qui empêche un site tiers de récupérer les jetons. */
  entrer() {
    const retour = location.origin + location.pathname;
    /* On MARQUE le départ, pour pouvoir juger le retour.

    Sans cette marque, un retour les mains vides est indiscernable d'une ouverture ordinaire de la
    page : dans les deux cas il n'y a ni jeton ni erreur dans l'adresse, et le jeu n'a aucune
    raison de dire quoi que ce soit. C'est exactement le symptôme décrit — « ça me ramène à
    l'accueil et rien ne se passe ». Avec la marque, le silence devient un fait qu'on peut nommer. */
    try { sessionStorage.setItem('eol.parti', String(Date.now())); } catch (_) {}
    location.href = `${MONDIAL_URL}/auth/v1/authorize?provider=google`
      + `&redirect_to=${encodeURIComponent(retour)}`;
  }

  sortir() {
    this.session = null;
    try { localStorage.removeItem('eol.session'); } catch (_) {}
  }

  /* Les records d'un circuit, une ligne par voiture.

  Une seule requête par circuit et non une par voiture : neuf requêtes pour peindre un écran
  seraient neuf occasions d'échouer et neuf allers-retours à attendre. Le résultat est gardé
  quelques minutes, parce qu'un record du monde ne change pas entre deux ouvertures d'un menu. */
  async records(circuit) {
    const vu = this.cache.get(circuit);
    if (vu && Date.now() - vu.t < 180000) return vu.lignes;
    try {
      const r = await fetch(`${MONDIAL_URL}/rest/v1/records`
        + `?select=voiture,temps,pilote&circuit=eq.${encodeURIComponent(circuit)}&order=temps.asc`,
        { headers: { apikey: MONDIAL_KEY, Authorization: `Bearer ${MONDIAL_KEY}` } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const lignes = await r.json();
      this.cache.set(circuit, { t: Date.now(), lignes });
      this.erreur = null;
      return lignes;
    } catch (e) {
      // pas de tableau mondial, et c'est tout : la course, elle, n'a besoin de personne
      this.erreur = String(e.message || e);
      return vu ? vu.lignes : [];
    }
  }

  /* Le pseudo est POSÉ ici et ENVOYÉ avec chaque temps ; il n'est plus écrit en base d'ici.

  Le navigateur écrivait lui-même dans la table des pilotes. Cela demandait un privilège
  d'écriture, une politique pour le borner à sa propre ligne, et un ordre de passage strict — le
  nom avant le premier temps. Trois pièces mobiles pour un champ de texte, et chacune a cassé à
  son tour : droits manquants, requête arrivée non authentifiée, déclaration qui ne se rejouait
  qu'au chargement de la page. La fonction serveur a déjà l'identité vérifiée du joueur ; elle
  inscrit le nom elle-même, lié à cet identifiant. Il ne reste ici qu'une chaîne à retenir. */
  poseNom(pseudo) { this.pseudo = pseudo; }

  /* Ce qui est déjà parti, pour ne pas le renvoyer à chaque ouverture. */
  marqueEnvoye(circuit, voiture) {
    this.envoyes.add(`${circuit}|${voiture}`);
    try { localStorage.setItem('eol.envoyes', JSON.stringify([...this.envoyes])); } catch (_) {}
  }

  /* Rattraper les temps d'AVANT le compte.

  Sans cela, un joueur qui s'inscrit après avoir déjà joué ne voit rien venir : ses meilleurs tours
  sont déjà posés dans sa sauvegarde, et seul un NOUVEAU record personnel part au tableau. Il
  faudrait donc qu'il se batte lui-même avant d'exister aux yeux du monde — et pendant ce temps,
  tout a l'air cassé.

  Les envois sont espacés de seize secondes parce que le serveur en refuse deux rapprochés : la
  règle de cadence est là pour empêcher le bourrage, et un rattrapage légitime doit s'y plier plutôt
  que de la faire sauter. Neuf voitures prennent donc deux minutes, en arrière-plan, sans que rien
  n'attende. */
  async rattrape(bestLaps) {
    if (!this.connecte() || this._rattrapeEnCours) return;
    this._rattrapeEnCours = true;
    const aFaire = [];
    for (const cle of Object.keys(bestLaps || {})) {
      const m = cle.split('|');
      if (m.length !== 3) continue;                       // les clés à deux morceaux sont l'ancien format
      const [circuit, , voiture] = m;
      if (this.envoyes.has(`${circuit}|${voiture}`)) continue;
      aFaire.push({ circuit, voiture, temps: bestLaps[cle] });
    }
    /* L'état du rattrapage, publié pour être affiché.

    « Rien à envoyer » n'est pas la même chose que « envoi en cours », et les deux ressemblent à
    « ça ne marche pas » quand l'écran ne dit rien. Le cas vide est le plus fréquent et le moins
    devinable : les records d'avant la version 0.21.48 sont rangés sous une clé à deux morceaux,
    sans voiture, donc ils ne PEUVENT pas être attribués — et le rattrapage n'a rien à faire. */
    this.envoi = { total: aFaire.length, faits: 0, rien: aFaire.length === 0 };
    for (const t of aFaire) {
      const r = await this.propose(t.circuit, t.voiture, t.temps);
      if (r.ok) this.envoi.faits++;
      // un refus définitif (voiture inconnue, temps impossible) ne se retente pas à chaque ouverture
      if (!r.ok && (r.raison === 'inconnu' || r.raison === 'trop_rapide')) this.marqueEnvoye(t.circuit, t.voiture);
      if (!r.ok && (r.raison === 'anonyme' || r.raison === 'session')) break;
      await new Promise((res) => setTimeout(res, 16000));
    }
    this._rattrapeEnCours = false;
  }
}

/* Lire la charge d'un jeton SANS en vérifier la signature.

C'est volontaire et sans danger ici : on ne s'en sert que pour afficher un nom et connaître une
date d'expiration. Rien de ce qu'on y lit n'ouvre une porte — c'est le serveur qui vérifie la
signature, et lui seul décide si un temps entre en base. Un jeton bricolé par le joueur ne lui
donnerait qu'un nom mensonger sur son propre écran. */
function decodeJwt(t) {
  try {
    const c = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(c.padEnd(Math.ceil(c.length / 4) * 4, '=')))));
  } catch (_) { return null; }
}

if (typeof module !== 'undefined') module.exports = { Mondial };
