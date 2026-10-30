// L'équilibre du plateau, dans les deux sens : entre les voitures d'une catégorie, et entre les
// catégories.
//
//   node tools/plateau-banc.js                      tour idéal, douze circuits (quelques secondes)
//   node tools/plateau-banc.js --sim                autopilote, deux tours par circuit (minutes)
//   node tools/plateau-banc.js --sim --cars=962,xjr9 --tracks=monza,spa --workers=4 --out=x.json
//
// DEUX MESURES, PARCE QU'ELLES NE RÉPONDENT PAS À LA MÊME QUESTION.
//
// Le **tour idéal** résout le profil de vitesse sur la trajectoire idéale : virage limité par
// l'adhérence, freinage, accélération dans le cercle d'adhérence. C'est ce que la voiture vaut sur
// le papier, et c'est déterministe et immédiat, donc c'est lui qu'on règle.
//
// Le **tour de l'autopilote** est ce qu'un pilote en tire, glisse et motricité comprises. Il sert à
// vérifier que le réglage tient en roulant. On garde le meilleur tour BRUT, sali ou non : à Monaco
// l'autopilote pose une roue dehors à chaque tour avec toutes les voitures, et le meilleur tour
// propre y vaut « aucun ». `tools/models.js` comptait alors 999 secondes et moyennait ce 999 avec
// les autres circuits, ce qui donnait 275 s de tour moyen et un classement qui ne disait plus rien.
//
// CE QU'ON LIT. Dans une catégorie, l'écart de chaque voiture à la moyenne de SA catégorie : c'est
// l'équilibre interne, et il doit rester serré. Entre catégories, le rapport de chaque moyenne à
// celle des GT : c'est le rang, et il est voulu. Une colonne par circuit dit où chaque voiture brille,
// parce qu'un plateau équilibré en moyenne où une voiture gagne partout ne l'est pas.
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { Worker, isMainThread, parentPort } = require('node:worker_threads');

/* `--patch` essaie un réglage sans toucher à `js/cars.js` : `{"m1procar":{"grip":1.06}}` remplace des
multiplicateurs d'une voiture, `{"@gt":{"vmax":72}}` des valeurs de base d'une catégorie. Les voitures
sont ensuite résolues de nouveau, exactement comme au chargement du jeu. */
function contexte(patch) {
  const math = Object.create(Math);
  const c = vm.createContext({ Math: math, console, Date, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array, Int32Array });
  const src = ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race']
    .map(f => fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8')
      .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '')).join('\n');
  vm.runInContext(src + '\nthis.__T = { TRACKS, MODELS, CATEGORIES, Track, Race, speedProfile, aiThrottle, perfOf, categoryById };', c);
  if (patch && Object.keys(patch).length) {
    c.PATCH = patch;
    vm.runInContext(`for (const cat of CATEGORIES) {
      if (PATCH['@' + cat.id]) Object.assign(cat.base, PATCH['@' + cat.id]);
      for (const m of cat.models) if (PATCH[m.id]) m.mul = Object.assign({}, m.mul, PATCH[m.id]);
    }
    MODELS.length = 0;
    for (const cat of CATEGORIES) for (const m of cat.models) MODELS.push(resolveModel(cat, m));`, c);
  }
  return c;
}

// Le tour idéal sur la trajectoire de course, à la largeur de route de la catégorie.
function tourIdeal(G, model, trackId, pistes) {
  const cat = G.categoryById(model.catId);
  const cle = trackId + '|' + (cat.roadScale || 1);
  if (!pistes.has(cle)) pistes.set(cle, new G.Track(G.TRACKS.find(t => t.id === trackId), cat.roadScale || 1));
  const T = pistes.get(cle);
  const v = G.speedProfile(T, model, 'racing', 1);
  let t = 0;
  for (let i = 0; i < T.n; i++) t += T.ds / Math.max(3, v[i]);
  return t;
}

const SIM = `(() => {
  let graine = 42761;
  Math.random = () => { graine ^= graine << 13; graine ^= graine >>> 17; graine ^= graine << 5; return (graine >>> 0) / 4294967296; };
  const race = new Race({ trackDef: TRACKS.find(t => t.id === JOB.track), modelId: JOB.car, difficulty: 'medium',
                          playerAI: true, nCars: 1, mode: 'timetrial' });
  const p = race.player, hist = new Uint32Array(91);
  let vMax = 0;
  while (p.lap < JOB.laps && race.time < 600) {
    race.update(race.dt, aiThrottle(p, race.cars, race.dt, { marginBase: JOB.marge, marginSpread: 0 }));
    if (race.state === 'racing' && p.v > 10) hist[Math.min(90, Math.floor(Math.abs(p.beta) * 180 / Math.PI))]++;
    if (race.state === 'racing') vMax = Math.max(vMax, p.v);
  }
  // la dérive que la voiture atteint en roulant proprement, au 95e centile : ce qu'il faut rattraper
  let total = 0, cumul = 0, derive = 0;
  for (const h of hist) total += h;
  for (let i = 0; i < hist.length; i++) { cumul += hist[i]; if (cumul >= total * 0.95) { derive = i; break; } }
  return { car: JOB.car, track: JOB.track, brut: p.bestLapBrut, propre: p.bestLap, sorties: p.crashes, tours: p.lap, derive, kmh: vMax * 3.6 };
})()`;

if (!isMainThread) {
  let c = null, cle = null;
  const script = new vm.Script(SIM);
  parentPort.on('message', (job) => {
    if (!job) { parentPort.close(); return; }
    if (!c || cle !== JSON.stringify(job.patch || {})) { cle = JSON.stringify(job.patch || {}); c = contexte(job.patch); }
    c.JOB = job;
    parentPort.postMessage(script.runInContext(c, { timeout: 300000 }));
  });
} else if (require.main === module) {
  const arg = (nom, d) => { const a = process.argv.find(x => x === '--' + nom || x.startsWith('--' + nom + '=')); return a == null ? d : (a.includes('=') ? a.slice(nom.length + 3) : true); };
  const patch = JSON.parse(arg('patch', '{}'));
  const G = contexte(patch).__T;
  const sim = !!arg('sim', false);
  const TOUS = G.TRACKS.map(t => t.id);
  const circuits = String(arg('tracks', sim ? 'monza,spa,suzuka,zandvoort,interlagos,silverstone,lemans' : TOUS.join(','))).split(',');
  const voulues = arg('cars', null);
  const modeles = G.MODELS.filter(m => !m.custom && (!voulues || String(voulues).split(',').includes(m.id)));

  const affiche = (temps, titre) => {
    // temps[id][circuit] = secondes
    const moyCat = {}, lignes = [];
    for (const cat of G.CATEGORIES) {
      const ms = modeles.filter(m => m.catId === cat.id);
      if (!ms.length) continue;
      // moyenne de la catégorie, circuit par circuit
      const ref = {};
      for (const tid of circuits) {
        const vals = ms.map(m => temps[m.id] && temps[m.id][tid]).filter(Number.isFinite);
        ref[tid] = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
      }
      moyCat[cat.id] = ref;
      lignes.push(`\n== ${cat.id.toUpperCase()} ==  écart à la moyenne de la catégorie, en %`);
      lignes.push('voiture'.padEnd(15) + 'moy.'.padStart(6) + '  ' + circuits.map(t => t.slice(0, 6).padStart(6)).join('') + '   km/h  0-100  100-0  g@180');
      const ecarts = [];
      for (const m of ms) {
        const parC = circuits.map(t => (temps[m.id][t] / ref[t] - 1) * 100);
        const moy = parC.reduce((a, b) => a + b, 0) / parC.length;
        ecarts.push(moy);
        const p = G.perfOf(m);
        lignes.push(m.name.slice(0, 14).padEnd(15) + moy.toFixed(2).padStart(6) + '  ' + parC.map(x => x.toFixed(1).padStart(6)).join('')
          + '   ' + p.vmax.toFixed(0).padStart(4) + '  ' + p.a100.toFixed(2).padStart(5) + '  ' + p.b100.toFixed(1).padStart(5) + '  ' + p.gripG.toFixed(2).padStart(5));
      }
      lignes.push(`étalement ${(Math.max(...ecarts) - Math.min(...ecarts)).toFixed(2)} %`);
    }
    if (moyCat.gt) {
      lignes.push('\n== ENTRE CATÉGORIES ==  temps moyen rapporté aux GT, en % (négatif : plus rapide)');
      lignes.push('catégorie'.padEnd(15) + 'moy.'.padStart(6) + '  ' + circuits.map(t => t.slice(0, 6).padStart(6)).join(''));
      for (const id of Object.keys(moyCat)) {
        const parC = circuits.map(t => (moyCat[id][t] / moyCat.gt[t] - 1) * 100);
        lignes.push(id.padEnd(15) + (parC.reduce((a, b) => a + b, 0) / parC.length).toFixed(2).padStart(6) + '  ' + parC.map(x => x.toFixed(1).padStart(6)).join(''));
      }
    }
    console.log(`${titre}\n${lignes.join('\n')}`);
  };

  if (!sim) {
    const pistes = new Map(), temps = {};
    for (const m of modeles) { temps[m.id] = {}; for (const tid of circuits) temps[m.id][tid] = tourIdeal(G, m, tid, pistes); }
    affiche(temps, `TOUR IDÉAL — trajectoire de course, ${circuits.length} circuits`);
    const out = arg('out', null);
    if (out) fs.writeFileSync(out, JSON.stringify({ mesure: 'ideal', circuits, temps }, null, 1) + '\n');
  } else {
    const jobs = [];
    const tours = +arg('laps', 2), marge = +arg('marge', 0.95);
    for (const m of modeles) for (const track of circuits) jobs.push({ car: m.id, track, laps: tours, marge, patch });
    const rows = [];
    let next = 0;
    const n = Math.min(+arg('workers', 4), jobs.length);
    Promise.all(Array.from({ length: n }, () => new Promise((ok, ko) => {
      const w = new Worker(__filename);
      const envoie = () => w.postMessage(next < jobs.length ? jobs[next++] : null);
      w.on('message', (r) => { rows.push(r); if (rows.length % 20 === 0) process.stderr.write(`${rows.length}/${jobs.length}\n`); envoie(); });
      w.on('error', ko);
      w.on('exit', (code) => (code === 0 ? ok() : ko(new Error('worker ' + code))));
      envoie();
    }))).then(() => {
      const temps = {};
      for (const r of rows) (temps[r.car] = temps[r.car] || {})[r.track] = r.brut == null ? NaN : r.brut;
      affiche(temps, `AUTOPILOTE — meilleur tour brut sur ${tours} tours, marge ${marge}, ${circuits.length} circuits`);
      const sorties = {};
      for (const r of rows) sorties[r.car] = (sorties[r.car] || 0) + r.sorties;
      console.log('\nsorties par voiture : ' + modeles.map(m => `${m.id} ${sorties[m.id] || 0}`).join(', '));
      // La pointe ATTEINTE, circuit par circuit, face à la pointe de la voiture : les circuits du
      // jeu sont plus courts que les vrais, et une voiture du Mans n'y touche jamais sa vitesse de
      // pointe. C'est ce que le joueur voit au compteur.
      console.log('\npointe atteinte en piste (km/h), face à la pointe de la voiture :');
      console.log('  voiture        pointe  ' + circuits.map(t => t.slice(0, 6).padStart(7)).join(''));
      for (const m of modeles) {
        const parC = circuits.map(t => { const r = rows.find(x => x.car === m.id && x.track === t); return r ? r.kmh : NaN; });
        console.log('  ' + m.name.slice(0, 13).padEnd(14) + (m.vmax * 3.6).toFixed(0).padStart(6) + '  ' + parC.map(x => x.toFixed(0).padStart(7)).join(''));
      }
      /* CE QU'UNE VOITURE COÛTE À PILOTER, et les pneus qu'on en tire.

      Deux mesures, prises dans les mêmes tours. LA DÉRIVE : l'angle de travers que la voiture
      atteint en roulant proprement, au 95e centile — ce qu'il faut rattraper au pouce, tour après
      tour. LE PRIX DU CARACTÈRE : ce que l'autopilote rend au tour idéal de la même voiture — une
      voiture qui glisse est rapide sur le papier et rend du temps en roulant. Le second seul se
      trompe sur les voitures à gros appui, que le tour idéal sous-estime et qui paraissent alors
      « plus faciles que faciles » ; la dérive, elle, ne dépend pas du profil de référence.

      Chacune est ramenée à sa place dans le plateau, de 0 à 1, puis moyennée, et l'échelle va de
      zéro pneu (la plus docile) à cinq (la plus exigeante) sur les TROIS catégories à la fois : une
      F1 à trois pneus est aussi exigeante qu'une GT à trois, y compris dans le rail « Toutes ».
      C'était la mesure qui fixait `diff` dans `js/cars.js` ; la note (les pneus) n'est plus affichée
      depuis la 0.52.48, remplacée par le palmarès, et `diff` a été retiré des voitures.

      `tools/difficulte.js` faisait ce travail, et ne le fait plus : depuis le modèle de motricité,
      son coup de lacet n'est encaissé par presque aucune voiture (0,00 rad/s), et sa dérive sature
      à 34° pour la moitié du plateau. Il est gardé tel quel pour l'historique. */
      const pistes = new Map(), prix = {}, derive = {};
      for (const m of modeles) {
        const ecarts = circuits.map(t => temps[m.id][t] / tourIdeal(G, m, t, pistes) - 1).filter(Number.isFinite);
        prix[m.id] = ecarts.reduce((a, b) => a + b, 0) / Math.max(1, ecarts.length);
        const d = rows.filter(r => r.car === m.id).map(r => r.derive);
        derive[m.id] = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length);
      }
      const place = (tab, id) => { const v = Object.values(tab), lo = Math.min(...v), hi = Math.max(...v); return hi - lo < 1e-9 ? 0.5 : (tab[id] - lo) / (hi - lo); };
      const score = {};
      for (const m of modeles) score[m.id] = (place(prix, m.id) + place(derive, m.id)) / 2;
      const sv = Object.values(score), s0 = Math.min(...sv), s1 = Math.max(...sv);
      console.log('\nce que chaque voiture coûte à piloter, le plateau entier sur une échelle :');
      console.log('  voiture          dérive   prix   score   pneus');
      for (const m of modeles.slice().sort((a, b) => score[a.id] - score[b.id])) {
        const pneus = Math.round((score[m.id] - s0) / Math.max(1e-9, s1 - s0) * 5);
        console.log('  ' + m.name.padEnd(15) + (derive[m.id].toFixed(1) + '°').padStart(8) + ((prix[m.id] * 100).toFixed(1) + ' %').padStart(8)
          + score[m.id].toFixed(2).padStart(8) + '   ' + '●'.repeat(pneus) + '○'.repeat(5 - pneus) + `   ${m.id}: ${pneus}`);
      }
      const out = arg('out', null);
      if (out) fs.writeFileSync(out, JSON.stringify({ mesure: 'autopilote', tours, marge, circuits, rows }, null, 1) + '\n');
    }).catch((e) => { console.error(e); process.exitCode = 1; });
  }
}
