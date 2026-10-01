/* Eyes On Line — racing together.
 *
 * Everything rides on the presence board of `js/room-rtc.js`: each screen posts one object and
 * sees everyone else's. Nothing is stored anywhere — close the page and the table is gone.
 *
 * One player hosts. The host is whoever opened the table, and the host alone simulates: it reads
 * the others' throttle and line off the board, runs the race, and posts the state of every car.
 * The guests post their two numbers and replay what they receive. No guest predicts anything, so
 * no guest can disagree with the host; what a guest sees is the host's race, a fraction of a
 * second old.
 *
 * Three formats, one lobby:
 *   race   — everyone on the grid, filled up with AI cars, contact on
 *   duel   — the people and no one else
 *   ghost  — the same circuit, each on their own lap, cars passing through each other
 */
'use strict';

const NET_HZ = 30;                 // snapshots per second; the channel coalesces around this anyway
const NET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I, O, 0, 1: they are read aloud
const NET_MODES = ['race', 'duel', 'ghost'];
const NET_SEATS = 8;               // people per table
const NET_STALE = 6000;            // a screen quiet this long has left
/* Au-delà, on part sans attendre celui qui n'a pas répondu.

Une barrière de chargement sans échappatoire est un blocage : un écran dont le téléchargement
échoue, ou qui ferme son onglet entre le coup d'envoi et la grille, retiendrait tous les autres
indéfiniment. Douze secondes couvrent très largement un chargement normal, et au pire on démarre
à sa place plutôt que de laisser la table en plan. */
const NET_CHARGE_MAX = 12000;

function netCode() {
  return Array.from({ length: 4 }, () => NET_CODE[Math.floor(Math.random() * NET_CODE.length)]).join('');
}

// An identity this screen makes up for itself. The transport labels peers its own way and may
// never tell us which one we are, so we do not ask it: we publish who we are and look for
// ourselves in the list.
function netPid() {
  return Math.random().toString(36).slice(2, 10);
}

class Net {
  constructor() {
    this.room = null;
    this.state = 'off';            // off | lobby | playing
    this.code = null;
    this.pid = netPid();
    this.creator = false;          // opened the table, therefore hosts
    this.error = null;
    this.busy = false;
    this.mine = { pid: this.pid, name: '', car: null, ready: false };
    this.table = { mode: 'race', trackId: 'monza', laps: 3, difficulty: 'medium', go: 0 };
    this.grid = null;              // frozen at kick-off by the host: [{p, n, m}, …], host first
    this.roster = null;            // the same list, pids only: [pid, …]
    this.seat = -1;
    this.peers = [];
    this.seq = 0;
    this.lastSeq = -1;
    this.outN = 0;
    this.seenN = {};
    this.sentAtMs = 0;
    this.lastI = null;
    this.snapAt = 0;
    this.onPeers = () => {};
    this.onStart = () => {};
  }

  available() { return typeof RoomRTC !== 'undefined' && RoomRTC.available(); }
  isHost() { return this.roster ? this.seat === 0 : this.creator; }

  /* ---------------------------------------------------------------------------- the table */

  async open(name, asHost, code) {
    this.busy = true; this.error = null;
    try {
      this.room = new RoomRTC();
      this.code = asHost ? netCode() : String(code || '').toUpperCase().trim();
      if (!asHost && !/^[A-Z0-9]{4}$/.test(this.code)) throw new Error('code à quatre lettres');
      this.creator = !!asHost;
      this.mine = { pid: this.pid, name: name || 'Pilote', car: null, ready: false };
      this.room.onPeers(() => { this.peers = this.room.peers(); this.pump(); });
      await this.room.claim(this.code, asHost);
      this.state = 'lobby';
      await this.post();
    } catch (e) {
      this.error = (e && e.message) || 'liaison impossible';
      this.leave();
    }
    this.busy = false;
    this.onPeers();
    return !this.error;
  }

  leave() {
    if (this.room) this.room.close();
    this.room = null;
    this.state = 'off';
    this.code = null;
    this.grid = null;
    this.roster = null;
    this.seat = -1;
    this.peers = [];
    this.creator = false;
    this.onPeers();
  }

  /* Ce qui ne change plus ne repart plus à chaque image — mais repart quand même.

  La présence est envoyée entière à chaque fois, et c'est une bonne idée : un message perdu se
  répare au suivant, sans accusé de réception ni réémission. Mais en course, elle transporte trente
  fois par seconde la grille complète — identifiant, nom et modèle des huit pilotes — et les
  réglages de la table, qui sont figés depuis le coup d'envoi. Mesuré : plus d'octets que
  l'instantané lui-même, qui est pourtant la seule chose qui bouge.

  On ne les supprime pas pour autant : un écran qui rejoint en retard ou qui a raté le départ en a
  besoin, et c'est tout l'intérêt d'un envoi complet. Ils repartent donc une fois par seconde au
  lieu de trente. La réparation automatique survit, au prix d'une seconde d'attente dans un cas qui
  n'arrive presque jamais, et vingt-neuf envois sur trente disparaissent. */
  post(extra) {
    if (!this.room) return Promise.resolve();
    /* Les deux premières secondes de course partent COMPLÈTES, sans exception.

    C'est la fenêtre où la grille sert : l'hôte bascule en course avant ses invités, et chacun
    d'eux attend de la voir apparaître dans la présence de l'hôte pour geler la sienne. Alléger
    dès la première image la faisait disparaître vingt-neuf fois sur trente pendant ce passage —
    à quatre écrans, les trois invités gelaient des grilles différentes, ce que `e2e-duo.js` a
    attrapé immédiatement. Passé ce délai, plus personne n'en a besoin à chaque image, et le
    rappel d'une fois par seconde suffit à rattraper un retardataire. */
    const course = this.state === 'playing' && performance.now() - (this.playingAt || 0) > 2000;
    const complet = !course || (this.postN = (this.postN || 0) + 1) % NET_HZ === 0;
    const p = Object.assign({}, this.mine, extra || {});
    if (complet) {
      if (this.creator) p.t = this.table;          // only the host's copy of the settings counts
      // La grille du coup d'envoi ne part que de l'hôte : c'est lui qui la décide, et un invité qui
      // la relaierait pourrait en répandre une version périmée.
      if (this.creator && this.grid) p.gr = this.grid;
    } else {
      /* On RETIRE les champs figés, on ne se contente pas de les omettre.

      `presence()` fusionne ce qu'on lui donne dans la présence courante, puis envoie l'ensemble :
      omettre un champ le laisse donc partir quand même, puisqu'il est déjà dedans. Une première
      version se contentait d'envoyer moins et ne changeait rien sur le fil — le genre d'économie
      qui se voit dans le code et nulle part ailleurs. `null` supprime pour de bon.

      L'identifiant reste : c'est à lui qu'on reconnaît un pair, et sans lui il disparaîtrait de la
      table à l'instant même. */
      p.t = null; p.gr = null; p.name = null; p.car = null; p.ready = null;
      p.ch = this.mine.ch;        // l'état de chargement reste : la barrière s'appuie dessus
    }
    return this.room.presence(p);
  }

  /** Everyone at the table, host first, stale screens dropped. */
  members() {
    const now = Date.now();
    const out = [];
    for (const p of this.peers) {
      const q = p.presence || {};
      if (!q.pid) continue;
      if (!p.isMe && p.updatedAt && now - p.updatedAt > NET_STALE) continue;
      out.push({ pid: q.pid, name: q.name || '', car: q.car, ready: !!q.ready, isMe: !!p.isMe, q });
    }
    // The host's label starts with 0 in this transport, so sorting by label puts them first; that
    // ordering is what the roster freezes, and both screens sort the same way.
    const label = (m) => (this.peers.find(p => (p.presence || {}).pid === m.pid) || {}).peer || '';
    out.sort((a, b) => (label(a) < label(b) ? -1 : 1));
    // Un pilote sans nom en reçoit un d'après sa place. Deux « Pilote » identiques à l'écran se
    // lisent comme deux fois soi-même, ce qui est exactement la confusion qu'on veut éviter.
    const fin = out.slice(0, NET_SEATS);
    fin.forEach((m, i) => { if (!m.name) m.name = 'Pilote ' + (i + 1); });
    return fin;
  }

  settings() {
    if (this.creator) return this.table;
    for (const p of this.peers) { const t = (p.presence || {}).t; if (t) return t; }
    return this.table;
  }

  setTable(patch) {
    if (!this.creator) return;
    Object.assign(this.table, patch);
    this.post();
    this.onPeers();
  }

  setMine(patch) {
    Object.assign(this.mine, patch);
    this.post();
    this.onPeers();
  }

  canStart() {
    const m = this.members();
    const need = this.settings().mode === 'duel' ? 2 : 2;
    return this.creator && m.length >= need && m.every(x => x.ready && x.car);
  }

  /** The host calls the start; everyone freezes the same list, in the same order, at that moment. */
  start() {
    if (!this.canStart()) return;
    this.setTable({ go: Date.now() });
  }

  /** La grille publiée par l'hôte, si elle est arrivée. L'hôte est le seul à publier les
   *  réglages : c'est à ça qu'on le reconnaît, sans avoir à se fier à l'ordre des pairs. */
  hostGrid() {
    for (const p of this.peers) {
      const q = p.presence || {};
      if (q.t && Array.isArray(q.gr) && q.gr.length >= 2) return q.gr;
    }
    return null;
  }

  /* Le coup d'envoi, et la grille qui va avec.

  L'hôte seul compose cette grille — qui est là, dans quel ordre, au volant de quoi — et tout le
  monde l'adopte telle quelle. C'est ce qui manquait : chaque écran recomposait la sienne à partir
  de ce qu'il voyait à cet instant. Or `members()` écarte tout pair resté silencieux quelques
  secondes ; un écran qui en rate un au moment du départ se retrouve avec une liste plus courte,
  donc un décalage de toutes les places qui suivent.

  Ce décalage ne se voit pas tout de suite : la grille se construit, la course part. Mais
  l'instantané de l'hôte est une suite de voitures dans l'ordre de SA liste, appliquée chez
  l'invité à l'ordre de la SIENNE. Chaque voiture reçoit alors l'état d'une autre, et un seul
  pilote qui appuie fait bouger tout l'écran. À deux, l'ordre ne peut pas diverger — ce qui
  explique que rien ne se voyait à deux.

  Publier les places seules ne suffisait pas : un écran qui ne connaît pas encore un pilote garde
  bien sa place, mais lui donne un nom par défaut et une voiture de repli, et la grille diffère
  quand même. La grille porte donc le nom et le modèle de chacun ; l'écran n'a plus rien à
  deviner. */
  pump() {
    this.onPeers();
    if (this.state !== 'lobby') return;
    const t = this.settings();
    if (!t.go) return;
    let grid;
    if (this.creator) {
      const m = this.members();
      if (m.length < 2) return;
      // `l` : la livrée choisie. Elle voyage avec le modèle, sinon chaque écran dessine la voiture
      // d'un autre dans la peinture qu'il a lui-même choisie.
      grid = m.map(x => ({ p: x.pid, n: x.name, m: (x.car && x.car.modelId) || null,
        l: (x.car && x.car.livree) || 0 }));
    } else {
      grid = this.hostGrid();
      if (!grid) return;                         // l'invité attend la grille de l'hôte
    }
    const roster = grid.map(x => x.p);
    const seat = roster.indexOf(this.pid);
    if (seat < 0) return;                        // pas encore dedans : on attend le prochain envoi
    this.grid = grid;
    this.roster = roster;
    this.seat = seat;
    this.state = 'playing';
    /* Le relais s'éteint ici, et ne se rallume qu'au drapeau.

    Il sert au salon — chacun doit voir tout le monde — et à rien d'autre une fois la course
    partie : l'hôte est seul à simuler, donc un invité n'a que faire de l'accélérateur d'un autre
    invité. C'est pourtant là que ça coûte le plus cher : à huit, le relais pèse 156 des 271 ko/s
    que l'hôte envoie, soit 58 % de sa voie montante, et il grandit en N² quand les instantanés ne
    grandissent qu'en N. */
    if (this.room) this.room.relayer = false;
    this.seq = 0; this.lastSeq = -1; this.outN = 0; this.seenN = {}; this.sentAtMs = 0;
    this.lentGarde = null;                 // le dernier bloc lent reçu, pour les images qui n'en ont pas
    this.postN = 0;
    this.playingAt = performance.now();
    this.mine.ch = false;                  // chacun repart « pas encore prêt » à chaque course
    this.snapAt = performance.now();
    this.post();
    this.onStart({
      mode: t.mode, trackId: t.trackId, laps: t.laps, difficulty: t.difficulty,
      // Personne ne choisit sa couleur : la place la donne. L'ordre étant celui de l'hôte, il est
      // le même sur tous les écrans, et chacun sait qui est qui sans qu'un mot passe sur le fil.
      humans: grid.map((g, i) => ({
        name: g.n || ('Pilote ' + (i + 1)),
        modelId: g.m || null,
        livree: g.l || 0,
        livery: i,
        local: g.p === this.pid,
      })),
    });
  }

  /** Back to the lobby after the flag, keeping the table open. */
  backToLobby() {
    if (this.state !== 'playing') return;
    this.state = 'lobby';
    if (this.room) this.room.relayer = true;      // le salon a de nouveau besoin de voir tout le monde
    this.grid = null;
    this.roster = null;
    this.seat = -1;
    if (this.creator) this.table.go = 0;
    this.mine.ready = false;
    this.post();
    this.onPeers();
  }

  /* ------------------------------------------------------------------- during the race */

  /** The host: read everyone's input, then publish the state of the race. Once per frame. */
  hostTick(race) {
    if (!this.room || !this.isHost()) return;
    for (const p of this.peers) {
      const q = p.presence || {};
      if (p.isMe || !q.pid || !Array.isArray(q.i)) continue;
      const seat = this.roster ? this.roster.indexOf(q.pid) : -1;
      if (seat < 1) continue;
      // The channel is neither reliable nor ordered: a frame of input can arrive after a newer
      // one. Replaying it would resurrect a throttle already released, so only what moves
      // forward is read. The window lets the counter wrap round.
      const n = typeof q.n === 'number' ? q.n : null;
      if (n !== null) {
        const seen = this.seenN[q.pid];
        if (seen !== undefined && n <= seen && n > seen - 120) continue;
        this.seenN[q.pid] = n;
      }
      race.netInput[seat] = { thr: !!q.i[0], sel: (q.i[1] || 0) / 100 };
    }
    const now = performance.now();
    if (now - this.sentAtMs < 1000 / NET_HZ) return;
    this.sentAtMs = now;
    /* L'instantané part en octets, pas en texte.

    581 octets de JSON par image, trente fois par seconde, vers chacun des sept invités : 2,73
    Mbit/s de voie montante, au-dessus de ce qu'une 4G faible accepte. Le même contenu tient en 214
    octets. `Race.snapshot()` n'a pas bougé d'une ligne — le codec traduit son tableau et le rend
    tel quel à l'arrivée, si bien qu'une erreur de quantification reste une erreur de transport et
    ne devient jamais une erreur de physique. */
    /* LE BLOC LENT EST FORCÉ dès que la course n'est plus en train de rouler.

    Il ne part qu'une image sur quinze, ce qui est juste tant que les champs qu'il porte ne changent
    qu'au passage de la ligne. L'arrivée est l'exception : l'hôte envoie UNE image d'état « terminé »
    puis se tait, et si celle-là ne portait pas le bloc lent, l'invité construisait son classement
    avec les fautes et les pénalités d'avant — mesuré : zéro seconde de pénalité là où l'hôte en
    comptait 3,5. Quatorze chances sur quinze de se tromper, sur la seule image qui compte. */
    const lent = race.state === 'racing' ? undefined : true;
    this.post({ s: pqEncode(race.snapshot(++this.seq), race.track, lent) });
  }

  /** A guest: publish my two numbers, apply the newest state received. Once per frame. */
  guestTick(race, input) {
    if (!this.room || this.isHost()) return;
    const host = this.members()[0];
    const brut = host && host.q && host.q.s;
    /* On accepte les deux formes : un tableau comme avant, des octets désormais.

    Deux écrans ne portent pas forcément la même version — l'un vient de recharger, l'autre non —
    et refuser l'ancienne forme aurait transformé une mise à jour en panne pour celui des deux qui
    a le mauvais goût d'être en retard. Lire les deux ne coûte qu'une ligne. */
    let snap = null;
    if (Array.isArray(brut)) snap = brut;
    else if (brut && typeof pqDecode === 'function') {
      const r = pqDecode(brut, race.track, this.lentGarde);
      if (r) { snap = r.snap; if (r.lent) this.lentGarde = r.lent; }
    }
    // An older snapshot than the one already applied would make the race walk backwards. It is
    // let through only when it comes from far behind, which means a fresh race has started.
    if (snap && (snap[0] > this.lastSeq || snap[0] < this.lastSeq - 120)) {
      if (race.applySnapshot(snap)) { this.lastSeq = snap[0]; this.snapAt = performance.now(); }
    }
    const i = [input.throttle ? 1 : 0, Math.round(clamp(input.sel || 0, -1, 1) * 100)];
    // Un appui part tout de suite, sans attendre le prochain envoi. Le reste du temps le rythme
    // ordinaire suffit — rien n'a changé, et répéter la même chose n'apprend rien à l'hôte. Ce
    // qui coûte cher au joueur, c'est le moment où il appuie : jusqu'à trente-trois millisecondes
    // gagnées là où il les sent le plus.
    const now = performance.now();
    const change = !this.lastI || this.lastI[0] !== i[0] || Math.abs(this.lastI[1] - i[1]) > 4;
    if (!change && now - this.sentAtMs < 1000 / NET_HZ) return;
    if (change && now - this.sentAtMs < 1000 / 60) return;    // sans inonder le canal pour autant
    this.lastI = i;
    this.sentAtMs = now;
    this.post({ i, n: ++this.outN });
  }

  /** How long since the last state arrived — the game greys the screen when it gets long. */
  silence() {
    if (this.state !== 'playing' || this.isHost()) return 0;
    /* Tant que le PREMIER instantané n'est pas arrivé, il n'y a pas de silence à mesurer.

    Le compteur partait du passage en course, donc il courait pendant que l'hôte construisait
    encore son circuit et ses voitures — plusieurs secondes où il n'a rien à envoyer. L'invité
    annonçait « liaison perdue » alors que la liaison allait très bien : personne n'avait encore
    rien dit. On ne parle de perte qu'après avoir reçu au moins une fois. */
    if (this.lastSeq < 0) return 0;
    return (performance.now() - this.snapAt) / 1000;
  }

  /** Cet écran a fini de charger ce qu'il lui faut pour courir. */
  setCharge(ok) {
    if (!!this.mine.ch === !!ok) return;
    this.mine.ch = !!ok;
    this.post();
  }

  /* Qui n'a pas encore annoncé qu'il était prêt.

  Seul l'hôte s'en sert : c'est lui qui tient le décompte, et les invités reçoivent son état tel
  quel. On compte sur la GRILLE gelée au coup d'envoi et non sur les présences du moment : un
  écran momentanément silencieux disparaîtrait de `members()` et serait compté comme prêt, ce qui
  reviendrait à lever la barrière pour celui-là même qu'elle protège. */
  attendus() {
    if (!this.roster) return { reste: 0, total: 0 };
    const vus = new Set();
    for (const p of this.peers) {
      const q = p.presence || {};
      if (q.pid && (p.isMe ? this.mine.ch : q.ch)) vus.add(q.pid);
    }
    const total = this.roster.length;
    const prets = this.roster.filter((pid) => vus.has(pid)).length;
    const trop = performance.now() - (this.playingAt || 0) > NET_CHARGE_MAX;
    return { reste: trop ? 0 : total - prets, total, prets, trop };
  }
}

if (typeof module !== 'undefined') module.exports = { Net, netCode, NET_MODES, NET_SEATS };
