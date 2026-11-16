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

/* La version des listes de circuits et de voitures que connaît le serveur des records.

À relever CHAQUE FOIS qu'on y ajoute un circuit ou une voiture (`supabase/functions/record`) : un
tour refusé comme « inconnu » n'est pas renvoyé à chaque ouverture, mais seulement tant que cette
version n'a pas changé. Sans ce numéro, le refus était définitif — et les tours en F1 ou à Paul
Ricard, refusés tant que le serveur ne les connaissait pas, ne seraient jamais repartis après sa
correction. 2 : les vingt-cinq voitures et les treize circuits. 3 : Watkins Glen (0.52.77) — la
fonction `record` doit être redéployée AVANT que la prod porte le circuit, sinon les tours qui y
partent sont refusés et retenus comme inconnus sous ce numéro. */
const LISTES_SERVEUR = 3;
// Ce que connaissait la version 1 : tout tour hors de ces listes n'a pu qu'être refusé.
const LISTES_V1 = {
  voitures: ['m1procar', 'f40', 'countach', '930', 'gt40', '935', 'corvette', '787b', 'csl'],
  circuits: ['monza', 'spa', 'monaco', 'silverstone', 'suzuka', 'interlagos', 'laguna', 'nurburgring',
    'lemans', 'bathurst', 'redbullring', 'zandvoort'],
};

/* SEULE LA PROD ÉCRIT AU TABLEAU MONDIAL. La recette le lit, et c'est tout.

Avant le 22 octobre 2026, la prod n'était pas ouverte : tous les temps posés jusque-là venaient de
la recette, sur des circuits et une physique qui ont bougé depuis. Le tableau en a été vidé
(`supabase/remise-a-zero-2026-10-22.sql`), et pour qu'ils n'y reviennent pas, la recette n'envoie
plus rien — ni le tour qu'on vient de boucler, ni le rattrapage à la connexion. Les temps locaux
restent où ils sont : ceux de la recette vivent sur son domaine, et la prod, ouverte depuis le 22,
n'en a pas de plus vieux.

`APP_CANAL` vaut « recette » dans le source et « prod » dans le build (`tools/build-dist.js`).
Une variable plutôt qu'un test en place, pour que les essais du tableau puissent la lever. */
let TEMPS_PUBLIES = typeof APP_CANAL !== 'undefined' && APP_CANAL === 'prod';

/* SUR ITCH.IO, LA SESSION VIT DANS UN PONT, PAS DANS LE JEU (0.56.0).

Là-bas le jeu tourne dans un cadre servi par html-classic.itch.zone. Google refuse de s'afficher dans un
cadre, et cette adresse est partagée par TOUS les jeux HTML5 d'itch.io : un jeton rangé par le jeu — il
porte l'e-mail et le nom Google du joueur — serait lisible par n'importe lequel d'entre eux.

Le jeu embarque donc `itch.html`, servi par la prod : un cadre invisible, sur l'origine
grip-game.github.io, qui garde la session et pose les temps à sa place. La connexion Google se fait
dans un nouvel onglet, sur cette même page, qui remet la session au pont et à lui seul. Le jeu n'en
connaît que « connecté : oui ou non ». Le détail est en tête d'itch.html. La LECTURE du tableau, elle,
est publique et se fait d'ici, comme sur le web. */
const PONT_URL = 'https://grip-game.github.io/itch.html';
const PONT_ORIGINE = 'https://grip-game.github.io';

class Mondial {
  constructor(options = {}) {
    this.itch = !!options.itch;    // l'édition itch.io : la session est dans le pont (voir PONT_URL)
    this.pontConnecte = false;     // ce que le pont dit de sa session
    this.enCours = false;          // une connexion est en cours dans un autre onglet
    this.onConnexion = () => {};   // la connexion vient de changer : à qui le dire
    this.session = null;        // { token, expire, nom, sub } une fois connecté
    this.cache = new Map();     // circuit → { t, lignes } : une lecture par circuit, pas par ligne
    this.erreur = null;
    this.dernierRefus = null;      // le dernier temps refusé par le serveur, et pourquoi
    this.erreurConnexion = null;   // un retour de connexion qui a mal tourné
    this.envoi = null;             // l'état du rattrapage : { total, faits, rien }
    /* Qui prévenir quand cet état change.

    Sans ce rappel, l'écran des records montrait l'état du moment où il a été peint, et plus
    jamais : « 0 sur 2 » restait affiché quoi qu'il arrive ensuite — succès, refus, abandon. Le
    joueur regardait une photographie en croyant lire un compteur, et moi aussi. */
    this.onEtat = () => {};
    this.envoyes = new Set();
    try { this.envoyes = new Set(JSON.parse(localStorage.getItem('eol.envoyes') || '[]')); } catch (_) {}
    /* Les refus « inconnu », rangés à part et datés de la version des listes du serveur.

    Jusqu'ici ils allaient dans `envoyes`, mêlés aux tours réellement envoyés. On les en retire UNE
    fois : tout couple hors des listes de la version 1 n'a jamais pu être accepté, donc s'il y est,
    c'est qu'il a été refusé — et il doit repartir maintenant que le serveur le connaît. */
    this.inconnus = new Set();
    try {
      const i = JSON.parse(localStorage.getItem('eol.inconnus') || 'null');
      if (i && i.v === LISTES_SERVEUR && Array.isArray(i.cles)) this.inconnus = new Set(i.cles);
      if (!i) {
        for (const cle of [...this.envoyes]) {
          const [circuit, voiture] = cle.split('|');
          if (!LISTES_V1.voitures.includes(voiture) || !LISTES_V1.circuits.includes(circuit)) this.envoyes.delete(cle);
        }
        localStorage.setItem('eol.envoyes', JSON.stringify([...this.envoyes]));
        localStorage.setItem('eol.inconnus', JSON.stringify({ v: LISTES_SERVEUR, cles: [] }));
      }
    } catch (_) {}
    if (this.itch) this._ouvrePont();
    else { this._litSession(); this._litRetour(); }
  }

  /* ------------------------------------------------------------------ le pont d'itch.io */

  _ouvrePont() {
    this._attentes = new Map(); this._numero = 0;
    this._pontPret = new Promise((res) => { this._pontDit = res; });
    const f = document.createElement('iframe');
    f.src = PONT_URL; f.title = 'GRIP'; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
    window.addEventListener('message', (e) => this._duPont(e));
    (document.body || document.documentElement).appendChild(f);
    this._pont = f;
  }

  // Une demande au pont, et sa réponse. Sans pont (prod injoignable), elle échoue après le délai.
  _auPont(type, corps, delai = 20000) {
    return new Promise((res, rej) => {
      const id = ++this._numero;
      const t = setTimeout(() => { this._attentes.delete(id); rej(new Error('pont')); }, delai);
      this._attentes.set(id, { res, t });
      this._pontPret.then(() => this._pont.contentWindow.postMessage({ grip: 'pont', v: 1, id, type, corps }, PONT_ORIGINE));
    });
  }

  // On n'écoute que le pont : ce cadre-là, et cette origine-là.
  _duPont(e) {
    if (!this._pont || e.source !== this._pont.contentWindow || e.origin !== PONT_ORIGINE) return;
    const m = e.data;
    if (!m || m.grip !== 'pont' || m.v !== 1) return;
    if (m.type === 'pret') { this._pontDit(); this._auPont('etat').catch(() => {}); return; }
    const a = m.id != null && this._attentes.get(m.id);
    if (a) { this._attentes.delete(m.id); clearTimeout(a.t); a.res(m); }
    if (m.type === 'etat') this._etatPont(m);
  }

  _etatPont(m) {
    const avant = this.pontConnecte;
    this.pontConnecte = !!m.connecte;
    if (m.erreur) { this.erreurConnexion = String(m.erreur); this._finOnglet(); }
    else if (this.pontConnecte) { this.erreurConnexion = null; this._finOnglet(); }
    if (avant !== this.pontConnecte || m.erreur) this.onConnexion();
  }

  /* La connexion, dans un NOUVEL ONGLET. `window.open` part dans le geste du joueur, sans rien attendre
  avant, sinon le navigateur le bloque ; et sans `noopener` : c'est par ce lien que la page de retour
  retrouve le pont. Si l'onglet est fermé sans connexion, on cesse d'attendre. */
  _entrerParOnglet() {
    this.erreurConnexion = null;
    let w = null;
    try { w = window.open(PONT_URL + '?entrer=1', '_blank'); } catch (_) {}
    if (!w) { this.erreurConnexion = 'onglet'; this.onConnexion(); return; }
    this._finOnglet();
    this._onglet = w; this.enCours = true;
    this._veille = setInterval(() => {
      let ferme = true;
      try { ferme = w.closed; } catch (_) {}
      if (!ferme) return;
      clearInterval(this._veille);
      // le pont annonce la connexion juste avant que l'onglet se ferme : on lui laisse le temps d'arriver
      setTimeout(() => { if (this._onglet === w && this.enCours) { this._finOnglet(); this.onConnexion(); } }, 1500);
    }, 700);
    this.onConnexion();
  }
  _finOnglet() { this.enCours = false; clearInterval(this._veille); this._onglet = null; }
  annuler() {
    if (this._onglet) try { this._onglet.close(); } catch (_) {}
    this._finOnglet(); this.onConnexion();
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
        this.retourVide = noms.join(', ');   // vide : l'interface dit « aucun paramètre » dans sa langue
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

  connecte() {
    if (this.itch) return this.pontConnecte;
    return !!(this.session && this.session.expire > Date.now() / 1000 + 60);
  }

  /* Partir se connecter chez Google, et revenir ici même.

  `redirect_to` doit être déclaré dans le tableau de bord Supabase, sinon la redirection est
  refusée au retour — c'est la protection qui empêche un site tiers de récupérer les jetons. */
  entrer() {
    if (this.itch) return this._entrerParOnglet();
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
    if (this.itch) {
      if (this.pontConnecte) this._auPont('sortir').catch(() => {});
      this.pontConnecte = false;
      return;
    }
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

  /* Proposer un temps. Le serveur décide.

  On n'envoie rien sans session : sans jeton, la fonction refuserait de toute façon, et partir quand
  même n'ajouterait qu'un aller-retour à une réponse déjà connue.

  Le nom voyage AVEC le temps. Le serveur l'inscrit lui-même, lié à l'identifiant qu'il a vérifié :
  on ne peut donc poser un nom que pour soi, et l'index unique empêche de prendre celui d'un autre
  compte. Signer un record du nom de quelqu'un d'autre reste impossible. */
  async propose(circuit, voiture, temps) {
    if (!TEMPS_PUBLIES) return { ok: false, raison: 'recette' };
    if (!this.connecte()) return { ok: false, raison: 'anonyme' };
    try {
      const r = await this._poste({ circuit, voiture, temps, pilote: this.pseudo || '' });
      const rep = r.rep;
      if (r.ok) this.cache.delete(circuit);   // le tableau vient de changer : on le relira
      if (r.status === 401) this.sortir();    // session périmée : on redemandera la connexion
      if (this.itch && rep.raison === 'anonyme') this.pontConnecte = false;   // le pont n'a plus de session
      const raison = rep.raison || rep.message || ('HTTP ' + r.status);
      /* Le DÉTAIL du serveur, gardé et montré.

      La fonction renvoie déjà le message exact de la base — « permission denied », « column does
      not exist », le nom de la contrainte violée — et on le jetait pour n'afficher qu'un mot. Ce
      mot désigne la famille du problème ; le détail désigne le problème. Sans lui on repart pour un
      tour d'hypothèses, et on en a déjà fait trois. */
      this.detailRefus = r.ok ? null : (rep.detail || null);
      /* Un refus se RETIENT, pour pouvoir être dit.

      Il partait dans le vide : le joueur bouclait un tour, rien n'arrivait au tableau, et aucune
      explication nulle part. Chaque raison a une cause que le joueur peut traiter — une voiture que
      le serveur ne connaît pas encore, un temps sous le plancher, une session périmée, un envoi
      trop rapproché — et aucune ne se devine depuis l'écran. */
      this.dernierRefus = r.ok ? null : { raison, circuit, voiture };
      if (r.ok) this.marqueEnvoye(circuit, voiture);
      return { ok: r.ok, raison };
    } catch (e) {
      this.dernierRefus = { raison: 'reseau', circuit, voiture };
      return { ok: false, raison: 'reseau' };
    }
  }

  /* Le temps part : d'ici avec le jeton sur le web, par le pont sur itch.io (qui a le jeton, pas nous).
  Dans les deux cas : { ok, status, rep }, la réponse du serveur des records. */
  async _poste(corps) {
    if (this.itch) {
      const m = await this._auPont('poser', corps);
      return { ok: !!m.ok, status: m.status || 0, rep: m.rep || {} };
    }
    const r = await fetch(`${MONDIAL_URL}/functions/v1/record`, {
      method: 'POST',
      headers: {
        apikey: MONDIAL_KEY,
        Authorization: `Bearer ${this.session.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(corps),
    });
    return { ok: r.ok, status: r.status, rep: await r.json().catch(() => ({})) };
  }

  /* Ce qui est déjà parti, pour ne pas le renvoyer à chaque ouverture. */
  marqueEnvoye(circuit, voiture) {
    this.envoyes.add(`${circuit}|${voiture}`);
    try { localStorage.setItem('eol.envoyes', JSON.stringify([...this.envoyes])); } catch (_) {}
  }

  /* Ce que le serveur ne connaît pas encore : ne se retente pas avant que ses listes changent. */
  marqueInconnu(circuit, voiture) {
    this.inconnus.add(`${circuit}|${voiture}`);
    try { localStorage.setItem('eol.inconnus', JSON.stringify({ v: LISTES_SERVEUR, cles: [...this.inconnus] })); } catch (_) {}
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
    if (!TEMPS_PUBLIES || !this.connecte() || this._rattrapeEnCours) return;
    this._rattrapeEnCours = true;
    const aFaire = [];
    for (const cle of Object.keys(bestLaps || {})) {
      const m = cle.split('|');
      if (m.length !== 3) continue;                       // les clés à deux morceaux sont l'ancien format
      const [circuit, , voiture] = m;
      if (this.envoyes.has(`${circuit}|${voiture}`) || this.inconnus.has(`${circuit}|${voiture}`)) continue;
      aFaire.push({ circuit, voiture, temps: bestLaps[cle] });
    }
    /* L'état du rattrapage, publié pour être affiché.

    « Rien à envoyer » n'est pas la même chose que « envoi en cours », et les deux ressemblent à
    « ça ne marche pas » quand l'écran ne dit rien. Le cas vide est le plus fréquent et le moins
    devinable : les records d'avant la version 0.21.48 sont rangés sous une clé à deux morceaux,
    sans voiture, donc ils ne PEUVENT pas être attribués — et le rattrapage n'a rien à faire. */
    this.envoi = { total: aFaire.length, faits: 0, rien: aFaire.length === 0, attente: 0 };
    this.onEtat();
    for (let i = 0; i < aFaire.length; i++) {
      const t = aFaire[i];
      const r = await this.propose(t.circuit, t.voiture, t.temps);
      if (r.ok) this.envoi.faits++;
      // un temps impossible ne se retente jamais ; un couple inconnu, pas avant que le serveur change
      if (!r.ok && r.raison === 'trop_rapide') this.marqueEnvoye(t.circuit, t.voiture);
      if (!r.ok && r.raison === 'inconnu') this.marqueInconnu(t.circuit, t.voiture);
      this.onEtat();
      /* Un refus définitif ARRÊTE le rattrapage au lieu de le poursuivre en pure perte.

      Les quatre refus qui ne dépendent pas du temps proposé — pas de session, pseudo refusé, nom
      déjà pris, panne de réseau — toucheront les suivants à l'identique. Continuer, c'était
      attendre seize secondes entre deux échecs annoncés, et laisser « 0 sur 9 » à l'écran pendant
      deux minutes et demie pour une cause connue dès le premier envoi. */
      if (!r.ok && ['anonyme', 'session', 'pseudo', 'pseudo_pris', 'pseudo_forme', 'reseau'].includes(r.raison)) break;
      if (i === aFaire.length - 1) break;
      /* L'attente entre deux envois, DÉCOMPTÉE à l'écran.

      Le serveur refuse deux temps rapprochés ; la règle est là pour empêcher le bourrage et un
      rattrapage légitime s'y plie. Mais seize secondes d'immobilité sans un mot, c'est
      indiscernable d'un blocage — d'autant que le compteur ne bougeait de toute façon pas. */
      for (let w = 16; w > 0; w--) {
        this.envoi.attente = w;
        this.onEtat();
        await new Promise((res) => setTimeout(res, 1000));
      }
      this.envoi.attente = 0;
    }
    this._rattrapeEnCours = false;
    this.onEtat();
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
