// Combien une voiture coûte à piloter, mesuré plutôt que décidé.
//
//   node tools/difficulte.js [catégorie]
//
// Le jeu affiche ce coût en pneus, de zéro à cinq. Le rang ne doit pas sortir d'un avis : une
// voiture est difficile pour des raisons qui sont dans la physique, et qui se mesurent en la
// faisant rouler. Trois mesures, sur cinq circuits de caractères différents.
//
// **La secousse dont elle se remet.** En pleine vitesse, on donne à la voiture un coup de lacet et
// on regarde si elle revient. Le coup monte jusqu'à ce qu'elle ne revienne plus : c'est là sa limite.
// Une voiture qui encaisse un demi-tour par seconde de lacet pardonne beaucoup ; une qui part pour un
// dixième punit. C'est ce qu'un joueur ressent — non pas « jusqu'où peux-tu appuyer », mais « quand
// ça bouge, est-ce que ça revient ».
//
// Premier essai, abandonné : pousser l'autopilote de plus en plus près de la limite avec
// `marginBase`. Ça sature. L'autopilote ne peut pas rouler plus vite que le profil que l'adhérence
// autorise, si bien qu'au-delà de 1,0 la marge ne demande plus rien de neuf — six voitures sur neuf
// ne sortaient jamais, même à 1,64, et le classement valait 0-0-0-0-0-1-4-5-5. Une mesure qui sature
// ne classe pas.
//
// **Le prix du caractère.** L'écart entre le tour idéal — ce que vaut la voiture une fois le profil
// de vitesse résolu sur la trajectoire — et le tour réellement bouclé. Une voiture qui glisse
// beaucoup est rapide sur le papier et décevante en main, et cet écart le chiffre.
//
// **La dérive maximale.** L'angle de dérive le plus grand atteint en roulant proprement. Une
// voiture qui met la queue à quinze degrés pour tourner demande à être rattrapée en permanence,
// même quand elle ne part pas.
//
// Ces trois-là ne disent pas la même chose, et c'est voulu : une voiture peut pardonner et rester
// fatigante, une autre être docile puis partir d'un coup. Le rang combine les trois, chacun ramené
// à sa place dans le plateau, parce que ce qui intéresse le joueur est le rang relatif — « plus
// dure que celle d'à côté » — et non une note absolue qui ne voudrait rien dire.
const fs = require('fs'), vm = require('vm');

const ARGS = process.argv.slice(2);
let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const cat = ARGS[0] || 'gt';
const CIRCUITS = ['monza', 'monaco', 'suzuka'];

/* Un coup de lacet, et on regarde si elle revient — comparée à elle-même sans le coup.

Le coup ajoute d'un coup une vitesse de rotation, ce que produit un appui trop tôt ou un aileron qui
décroche. Reste à décider ce que « revenir » veut dire, et c'est là que le premier essai s'est
trompé : il demandait une dérive et un lacet quasi nuls, ce qui n'arrive jamais sur un circuit où la
voiture tourne en permanence. Toutes les voitures échouaient dès le plus petit coup, et la mesure
disait donc la même chose de toutes — c'est-à-dire rien.

On la compare donc **à elle-même**. Deux courses identiques, l'autopilote étant déterministe : dans
l'une on secoue, dans l'autre non. Revenir, c'est que l'écart entre les deux trajectoires retombe
sous trente centimètres et y reste. Le critère ne doit plus rien au tracé, et il correspond à ce
qu'on veut savoir : la voiture a-t-elle retrouvé la ligne qu'elle aurait suivie sans l'incident. */
function trajectoire(cat, id, tid, coup) {
  const td = TRACKS.find(t => t.id === tid);
  const race = new Race({ trackDef: td, classId: cat, modelId: id, difficulty: 'medium',
                          playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial' });
  const p = race.player;
  const thr = () => aiThrottle(p, race.cars, race.dt, { marginBase: 0.95, marginSpread: 0 });
  while (race.time < 8 && race.state !== 'finished') race.update(race.dt, thr());
  if (race.state !== 'racing') return null;
  const sortiesAvant = p.crashes;
  if (coup) p.w += coup;
  const lat = [], s = [];
  let beta = 0;
  for (let i = 0; i < 300; i++) {                                  // cinq secondes
    race.update(race.dt, thr());
    lat.push(p.lat); s.push(p.s);
    beta = Math.max(beta, Math.abs(p.beta));
  }
  return { lat, s, beta: beta * 57.3, sortie: p.crashes > sortiesAvant };
}

function encaisse(ref, essai) {
  if (!ref || !essai || essai.sortie) return false;
  // L'écart doit retomber sous trente centimètres et y rester une demi-seconde.
  let tenu = 0;
  for (let i = 0; i < Math.min(ref.lat.length, essai.lat.length); i++) {
    tenu = Math.abs(essai.lat[i] - ref.lat[i]) < 0.30 ? tenu + 1 : 0;
    if (tenu >= 30) return true;
  }
  return false;
}

const out = [];
for (const m of modelsOf(cat)) {
  // Le plus gros coup dont elle se remet, cherché par dichotomie sur les trois circuits — huit
  // essais valent mieux que trente-deux pour la même précision.
  const refs = CIRCUITS.map(tid => trajectoire(cat, m.id, tid, 0));
  let lo = 0, hi = 2.4;
  for (let k = 0; k < 8; k++) {
    const mid = (lo + hi) / 2;
    let ok = true;
    for (let i = 0; i < CIRCUITS.length; i++) {
      if (!encaisse(refs[i], trajectoire(cat, m.id, CIRCUITS[i], mid))) { ok = false; break; }
    }
    if (ok) lo = mid; else hi = mid;
  }
  const tient = lo;
  // La dérive atteinte pour un coup de référence, le même pour toutes : une voiture peut revenir et
  // l'avoir mis en travers, ce qui est fatigant même sans être perdu.
  let betaRef = 0;
  for (const tid of CIRCUITS) {
    const e = trajectoire(cat, m.id, tid, 0.35);
    if (e) betaRef = Math.max(betaRef, e.beta);
  }
  // Le prix du caractère : l'écart entre le tour idéal et le tour réellement bouclé.
  let prix = 0, n = 0;
  for (const tid of CIRCUITS) {
    const td = TRACKS.find(t => t.id === tid);
    const race = new Race({ trackDef: td, classId: cat, modelId: m.id, difficulty: 'medium',
                            playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial' });
    const p = race.player, T = race.track;
    let ti = 0;
    const vp = speedProfile(T, p.cls, 'racing', 1);
    for (let i = 0; i < T.n; i++) ti += T.ds / Math.max(3, vp[i]);
    while (race.state !== 'finished' && race.time < 400 && p.lap < 3) {
      race.update(race.dt, aiThrottle(p, race.cars, race.dt, { marginBase: 0.98, marginSpread: 0 }));
    }
    if (p.bestLap) { prix += (p.bestLap - ti) / ti; n++; }
  }
  out.push({ id: m.id, nom: m.name, tient, prix: n ? prix / n : 0, beta: betaRef });
}
OUT.res = out;
`;

const sandbox = { ARGS, OUT: {}, console, performance: { now: () => Date.now() } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const res = sandbox.OUT.res;

// Chaque mesure ramenée à sa place dans le plateau, de 0 (la plus facile) à 1 (la plus dure), puis
// moyennées. Une mesure identique pour toutes ne pèse alors rien, ce qui est le bon comportement :
// elle ne distingue pas.
const rang = (vals, v) => {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  return hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo);
};
const tients = res.map(r => -r.tient), prixs = res.map(r => r.prix), betas = res.map(r => r.beta);
for (const r of res) {
  r.score = (rang(tients, -r.tient) + rang(prixs, r.prix) + rang(betas, r.beta)) / 3;
}
res.sort((a, b) => a.score - b.score);
// Zéro à cinq pneus, étalés sur le plateau : le plus facile n'en porte aucun, le plus dur cinq.
const s0 = res[0].score, s1 = res[res.length - 1].score;
for (const r of res) r.pneus = Math.round(((r.score - s0) / Math.max(1e-9, s1 - s0)) * 5);

console.log('\n  voiture        encaisse   prix du caractère   dérive max   score   pneus');
for (const r of res) {
  console.log('  ' + r.nom.padEnd(15)
    + (r.tient.toFixed(2) + ' rad/s').padStart(12)
    + (r.prix * 100).toFixed(1).padStart(14) + ' %'
    + r.beta.toFixed(1).padStart(12) + '°'
    + r.score.toFixed(2).padStart(8)
    + ('  ' + '●'.repeat(r.pneus) + '○'.repeat(5 - r.pneus)).padStart(10));
}
console.log('\n  à coller dans js/cars.js :');
for (const r of res) console.log(`    ${r.id}: ${r.pneus},`);
