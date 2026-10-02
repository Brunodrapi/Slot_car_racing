// Les sorties de piste : ce qui en est une, ce qu'elle annule, ce qu'elle coûte.
//
//   node tools/sortie.js
//
// Trois demandes de Bruno, dans une seule règle à trois étages :
//
//   « une sortie de piste doit invalider un temps »
//   « mais les vibreurs ne doivent pas être considérés comme des sorties »
//   « les sorties doivent donner des malus de temps pour le classement final, ça évite la triche
//     en coupant les chicanes »
//
// Ce qui se mesure ici, et qu'aucune partie ne montrerait de façon reproductible :
//
//   1. LE VIBREUR EST DE LA PISTE. Deux roues dessus : pas de gravier, pas de faute, pas de tour
//      annulé — seulement un peu moins d'adhérence. C'était le défaut : la piste s'arrêtait à la
//      ligne blanche, et un appui sur la peinture valait sortie de piste.
//   2. AU-DELÀ, C'EST UNE SORTIE. Faute comptée, tour en cours annulé.
//   3. DANS UNE LIGNE DROITE il n'y a pas de vibreur peint, donc pas de tolérance : la règle suit
//      le dessin, station par station.
//   4. UN TOUR SALI NE DEVIENT PAS LE MEILLEUR TOUR, même s'il est plus rapide.
//   5. UNE COUPE NE RAPPORTE RIEN. Le temps gagné hors piste est mesuré contre ce que les mêmes
//      mètres coûtent sur la ligne de course, et repris. C'est la seule façon de couvrir à la fois
//      la chicane coupée (trois secondes de gain) et la traversée d'infield (neuf) sans condamner
//      une course pour un appui malheureux — voir `tools/coupe.js`.
//   6. UNE SORTIE QUI COÛTE DU TEMPS n'est pas punie deux fois : seule la seconde fixe s'applique.
'use strict';
const fs = require('fs'), vm = require('vm');

let src = '';
for (const f of ['util', 'tracks', 'track', 'cars', 'car', 'race']) {
  src += fs.readFileSync(`${__dirname}/../js/${f}.js`, 'utf8')
    .replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
}

src += `
const cat = playableCategories()[0];
const mid = modelsOf(cat.id)[0].id;
const faire = () => {
  const r = new Race({ trackDef: TRACKS[0], classId: cat.id, modelId: mid, difficulty: 'medium',
                       playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial', laps: 99 });
  r.state = 'racing'; r.countdown = 0;
  return r;
};
const roule = (r, pas, thr) => {
  for (let k = 0; k < pas; k++) {
    const p = r.player;
    r._simulate(r.dt, thr == null ? aiThrottle(p, r.cars, r.dt, r.difficulty) : thr);
  }
};

const res = {};

/* --- 1 à 3 : ce qui est de la piste, station par station ---

On place la voiture et on fait UN pas : c'est « update » qui classe la surface, donc il faut qu'il
tourne, mais plus d'un pas et la voiture aurait bougé toute seule. */
const zones = (sStation, ecart) => {
  const r = faire();
  const T = r.track, p = r.player;
  const s = sStation * T.ds;
  p.place(s, T.hwLeftAt(s) + ecart, 30);
  p.started = true; p.lapSale = false; p.fautes = 0;
  r._simulate(r.dt, true);
  return { etat: p.state, kerb: p.surKerb, fautes: p.fautes, sale: p.lapSale,
           kerbIci: +T.kerbAt(s).toFixed(2) };
};
// le milieu du premier virage : loin du biseau des extrémités
const c0 = faire().track.corners[0];
const milieu = Math.floor((c0.from + c0.to) / 2);
res.vibreur = zones(milieu, 1.2);          // deux roues sur la bande
res.auDela = zones(milieu, 4.0);           // franchement dans l'herbe
// une ligne droite : la station la plus loin de tout virage
const T0 = faire().track;
let droite = 0, best = -1;
for (let i = 0; i < T0.n; i++) { if (T0.kerb[i] === 0) { let d = 1e9; for (const c of T0.corners) d = Math.min(d, Math.abs(i - c.from), Math.abs(i - c.to)); if (d > best) { best = d; droite = i; } } }
res.droite = zones(droite, 1.2);           // le même écart, mais sans vibreur peint

/* --- 3 bis. LE BOUT DU VIBREUR, là où il s'affine ---

Le vibreur s'amincit en pente douce à chaque extrémité du virage, et c'est exactement là que la
peinture et la règle doivent tomber d'accord : rouler sur ce qui est peint ne doit jamais valoir une
sortie. Le dessin était à largeur constante et coupé net là où la règle, elle, suivait déjà
l'affinement — la peinture promettait donc du vibreur là où rouler comptait une faute. */
{
  const T0b = faire().track;
  let bout = -1;
  for (let i = 0; i < T0b.n; i++) {
    const w = T0b.kerb[i];
    if (w > 0.2 * KERB_LARGE && w < 0.8 * KERB_LARGE) { bout = i; break; }
  }
  const w = bout >= 0 ? T0b.kerb[bout] : 0;
  // juste en DEDANS du bord extérieur peint, et juste en DEHORS
  res.bout = { station: bout, largeur: +w.toFixed(2),
               dedans: bout >= 0 ? zones(bout, KERB_IN + w - 0.15) : null,
               dehors: bout >= 0 ? zones(bout, KERB_IN + w + 1.5) : null };
}

/* --- 4. un tour sali ne devient pas le meilleur tour --- */
{
  const r = faire(), p = r.player;
  p.started = true; p.lapStart = r.time;
  p.lapTimes = []; p.lapOk = []; p.bestLap = null;
  p.checkpoint = true;                               // le demi-tour, sans quoi le tour ne compte pas
  p._advance(r.track.length + 1, r.time + 80);       // un tour propre de 80 s
  const apresPropre = p.bestLap;
  p.lapSale = true;
  p.lapStart = r.time;
  p.checkpoint = true;
  p._advance(r.track.length + 1, r.time + 60);       // un tour SALI de 60 s, donc plus rapide
  res.sali = { apresPropre, bestLap: p.bestLap, tours: p.lapTimes.map((x) => Math.round(x)),
               ok: p.lapOk.slice() };
}

/* --- 5. une coupe ne rapporte rien ---

On fabrique la coupe au lieu d'espérer qu'une IA la tente, et on la fabrique PROPREMENT : la voiture
est tenue à l'arrêt pour que la physique n'ajoute pas de mètres à son insu, et on l'avance le long du
circuit à la main. Une première version laissait tourner la physique par-dessus le déplacement forcé,
si bien que la voiture avalait deux cent vingt mètres là où le banc en comptait cent cinquante : la
mesure était juste, l'attente du banc ne l'était pas. Un essai qui ne contrôle pas son entrée ne
mesure pas la règle, il mesure son propre bruit. */
{
  const r = faire(), p = r.player, T = r.track;
  roule(r, Math.round(6 / r.dt));                    // on prend de la vitesse
  /* On REMET LE COMPTEUR À ZÉRO, et ce n'est pas une commodité.

  Les six secondes de mise en vitesse partent de l'arrêt et l'IA passe large : la voiture était déjà
  hors piste quand la coupe commençait, donc la sortie en cours comptait depuis plus longtemps que la
  coupe elle-même. Le banc mesurait 2,97 s hors piste pour 1,48 s de coupe et concluait qu'elle
  n'avait rien gagné. La règle était juste ; l'entrée du banc ne l'était pas. */
  p.place(T.wrap(p.s), 0, p.v);
  r._simulate(r.dt, false);
  p.repris = 0; p.fautes = 0; p.lapSale = false; p.sortieS0 = null;
  const i0 = T.idx(p.s);
  const D = 150;                                     // les mètres de circuit avalés hors piste
  const ref = r._tempsSurPiste(i0, D);               // ce que ces mètres coûtent sur la ligne
  const SECONDES = ref / 2;                          // on les avale deux fois plus vite : voilà la coupe
  const pas = Math.round(SECONDES / r.dt);
  const s0 = p.s;
  for (let k = 0; k < pas; k++) {
    p.grassT = 0;
    p.place(T.wrap(s0 + D * (k + 1) / pas), T.hwLeftAt(p.s) + 12, 0);
    r._simulate(r.dt, false);
  }
  p.place(T.wrap(p.s), 0, 0);                        // retour sur la piste
  r._simulate(r.dt, false);
  res.coupe = { ref: +ref.toFixed(2), horsPiste: +SECONDES.toFixed(2), repris: +p.repris.toFixed(2),
                fautes: p.fautes, sale: p.lapSale, attendu: +Math.max(0, ref - SECONDES).toFixed(2) };
}

/* --- 6. une sortie qui ne fait pas avancer ne rapporte rien --- */
{
  const r = faire(), p = r.player, T = r.track;
  roule(r, Math.round(6 / r.dt));
  const s0 = p.s;
  const pas = Math.round(3 / r.dt);
  for (let k = 0; k < pas; k++) {
    p.grassT = 0;                                    // pas de remise en piste par les commissaires
    p.place(T.wrap(s0), T.hwLeftAt(s0) + 12, 0);     // immobile dans l'herbe : trois secondes perdues
    r._simulate(r.dt, false);
  }
  p.place(T.wrap(p.s), 0, 0);
  r._simulate(r.dt, false);
  res.perdu = { repris: +p.repris.toFixed(2), fautes: p.fautes,
                penalite: +Race.penalite(p).toFixed(2) };
}

/* --- 7. et sur une vraie course d'IA, l'ordre de grandeur ---

Les six premiers essais contrôlent leur entrée, donc ils ne diraient rien d'une référence
systématiquement fausse : si le profil de vitesse était trop lent partout, chaque sortie rapporterait
une pénalité imméritée et les six passeraient quand même. On regarde donc une course entière, pilotée
par la machine, où les sorties sont de vraies sorties. */
{
  const r = new Race({ trackDef: TRACKS[0], classId: cat.id, modelId: mid, difficulty: 'cauchemar',
                       playerAI: true, playerLivery: 0, mode: 'race', laps: 3 });
  r.state = 'racing'; r.countdown = 0;
  let pas = 0;
  // la voiture du joueur ne reçoit ses gaz que de l'entrée : sans ça elle ne part pas, personne ne
  // franchit l'arrivée, et la course tourne jusqu'à la limite de pas sans rien mesurer
  while (r.state !== 'finished' && pas++ < Math.round(900 / r.dt)) {
    r.update(r.dt, aiThrottle(r.player, r.cars, r.dt, r.difficulty));
  }
  const f = r.cars.reduce((a, c) => a + c.fautes, 0);
  const rep = r.cars.reduce((a, c) => a + c.repris, 0);
  res.course = { voitures: r.cars.length, fautes: f, repris: +rep.toFixed(2),
                 parSortie: f ? +(rep / f).toFixed(2) : 0, etat: r.state };
}

/* --- 8. la référence est-elle À L'ÉCHELLE ? ---

Les essais 5 et 6 comparent la pénalité à « _tempsSurPiste », c'est-à-dire à la fonction qu'ils sont
censés éprouver : ils vérifient la soustraction, pas la référence. Si le profil de vitesse était
deux fois trop lent partout, ils passeraient quand même, et chaque sortie rendrait une pénalité
imméritée. On confronte donc la référence à une mesure indépendante : le tour que l'IA en cauchemar
boucle réellement. Elle triche de 30 % d'adhérence, donc elle doit s'approcher du tour théorique sans
le battre largement. */
{
  const r = new Race({ trackDef: TRACKS[0], classId: cat.id, modelId: mid, difficulty: 'cauchemar',
                       playerAI: true, playerLivery: 0, nCars: 1, mode: 'timetrial', laps: 99 });
  r.state = 'racing'; r.countdown = 0;
  const theorique = r._tempsSurPiste(0, r.track.length);
  let pas = 0;
  while (r.player.lap < 4 && pas++ < Math.round(600 / r.dt)) {
    r.update(r.dt, aiThrottle(r.player, r.cars, r.dt, r.difficulty));
  }
  // le tour BRUT : l'IA en cauchemar sort au moins une fois par tour, donc son meilleur tour propre
  // peut ne pas exister — et la question posée ici est celle de l'échelle, pas de la propreté
  const b = r.player.bestLapBrut;
  res.echelle = { theorique: +theorique.toFixed(1), reel: b == null ? null : +b.toFixed(1),
                  tours: r.player.lap, propre: r.player.bestLap };
}

OUT.res = res;
`;

const OUT = {};
vm.runInNewContext(src, { OUT, console, performance: { now: () => Date.now() }, Math, JSON, Date });
const r = OUT.res;

let fautes = 0;
const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

console.log('\nce qui est de la piste');
dit(r.vibreur.etat === 'ok' && r.vibreur.kerb === true && r.vibreur.fautes === 0 && !r.vibreur.sale,
  `vibreur (1,2 m au large, bande de ${r.vibreur.kerbIci} m) : ${r.vibreur.etat},`
  + ` sur vibreur ${r.vibreur.kerb}, ${r.vibreur.fautes} faute, tour ${r.vibreur.sale ? 'sali' : 'propre'}`);
dit(r.auDela.etat === 'grass' && r.auDela.fautes === 1 && r.auDela.sale === true,
  `au-dela (4 m au large) : ${r.auDela.etat}, ${r.auDela.fautes} faute, tour ${r.auDela.sale ? 'sali' : 'propre'}`);
dit(r.droite.kerbIci === 0 && r.droite.etat === 'grass',
  `ligne droite, meme ecart : bande de ${r.droite.kerbIci} m, donc ${r.droite.etat}`);
dit(r.bout.station >= 0 && r.bout.largeur > 0 && r.bout.largeur < 1.7,
  `le vibreur s'affine bien quelque part (station ${r.bout.station}, ${r.bout.largeur} m de large)`);
dit(r.bout.dedans && r.bout.dedans.etat === 'ok' && r.bout.dedans.fautes === 0,
  `au bord exterieur de la peinture, dans l'affinement : ${r.bout.dedans && r.bout.dedans.etat},`
  + ` ${r.bout.dedans && r.bout.dedans.fautes} faute`);
dit(r.bout.dehors && r.bout.dehors.etat === 'grass',
  `un metre et demi plus loin : ${r.bout.dehors && r.bout.dehors.etat}`);

console.log('\nun tour sali');
dit(r.sali.bestLap === r.sali.apresPropre,
  `tours ${r.sali.tours.join(' / ')} s, propres ${r.sali.ok.join(' / ')}`
  + ` → meilleur tour ${Math.round(r.sali.bestLap)} s (le sali, plus rapide, ne compte pas)`);

console.log('\nune coupe');
const ecart = Math.abs(r.coupe.repris - r.coupe.attendu);
dit(ecart < 0.35, `150 m hors piste en ${r.coupe.horsPiste} s, qui en valent ${r.coupe.ref} s sur la piste`
  + ` → repris ${r.coupe.repris} s (attendu ${r.coupe.attendu}, ecart ${ecart.toFixed(2)})`);
dit(r.coupe.fautes >= 1 && r.coupe.sale === true, `et le tour est annule (${r.coupe.fautes} faute)`);

console.log('\nune sortie qui ne fait pas avancer');
dit(r.perdu.repris < 0.05, `rien n'est repris (${r.perdu.repris} s) : elle n'a rien gagne`);
dit(Math.abs(r.perdu.penalite - r.perdu.fautes * 1.0) < 0.05,
  `la penalite est la part fixe seule : ${r.perdu.penalite} s pour ${r.perdu.fautes} sortie(s)`);

console.log('\nsur une vraie course');
dit(r.course.etat === 'finished', `la course va au bout (${r.course.etat}, ${r.course.voitures} voitures)`);
dit(r.course.fautes === 0 || r.course.parSortie < 2,
  `${r.course.fautes} sorties, ${r.course.repris} s reprises en tout`
  + ` → ${r.course.parSortie} s par sortie (une reference faussee ferait exploser ce chiffre)`);

console.log('\nla reference, confrontee a une mesure independante');
const e = r.echelle;
const ecartE = e.reel == null ? null : Math.abs(e.reel - e.theorique) / e.theorique;
dit(e.reel != null && ecartE < 0.25,
  `tour theorique sur la ligne ${e.theorique} s, meilleur tour reel de l'IA cauchemar ${e.reel} s`
  + ` (${e.tours} tours, ecart ${ecartE == null ? '—' : (100 * ecartE).toFixed(0) + ' %'})`);

console.log(`\nfautes ${fautes}`);
process.exit(fautes ? 1 : 0);
