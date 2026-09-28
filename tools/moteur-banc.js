// Le banc d'essai du volant d'inertie, sans une seule note de son.
//
//   node tools/moteur-banc.js
//
// Le modèle porté de markeasting/engine-audio remplace une règle de trois par un volant qu'on
// intègre. Tout ce qui s'entendra ensuite — la montée qui a une masse, le trou au passage, le
// rebond au rupteur — sort d'ici. Ça se mesure, et il vaut mieux que ce soit mesuré avant qu'on y
// branche le moindre échantillon : une fois le son dessus, un défaut de régime s'entend sans qu'on
// sache dire s'il vient du modèle ou du montage.
const { EAVehicle } = require('../js/engine-audio.js');

const CONF = {
  engine: { idle: 1100, limiter: 9000, torque: 400, engine_braking: 200, inertia: 0.55, limiter_ms: 60, limiter_delay: 90 },
  drivetrain: { shiftTime: 90 },
  wheel_radius: 0.32,
};

const pas = (v, secondes, vitesse, gaz, chaque) => {
  const dt = 1 / 120;
  for (let t = 0; t < secondes; t += dt) {
    const vit = typeof vitesse === 'function' ? vitesse(t) : vitesse;
    v.update(t * 1000, dt, vit, gaz);
    if (chaque) chaque(t, vit);
  }
};

let fautes = 0;
const dire = (nom, ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? ' ' : '✗'} ${nom.padEnd(34)} ${txt}`); };

// --- 1. le ralenti se tient-il tout seul ? ---
{
  const v = new EAVehicle(CONF);
  const vus = [];
  pas(v, 4, 0, 0, (t) => { if (t > 2) vus.push(v.engine.rpm); });
  const min = Math.min(...vus), max = Math.max(...vus);
  dire('ralenti', Math.abs(min - CONF.engine.idle) < CONF.engine.idle * 0.1 && max < CONF.engine.idle * 1.25,
    `${Math.round(min)}–${Math.round(max)} tr/min, visé ${CONF.engine.idle}`);
}

// --- 2. la montée à vide : combien de temps, et le rupteur tient-il ? ---
{
  const v = new EAVehicle(CONF);
  let atteint = null, plafond = 0;
  pas(v, 4, 0, 1, (t) => {
    if (atteint == null && v.engine.rpm >= CONF.engine.limiter * 0.99) atteint = t;
    if (t > 1) plafond = Math.max(plafond, v.engine.rpm);
  });
  const depasse = plafond / CONF.engine.limiter - 1;
  dire('montée au point mort', atteint != null && atteint > 0.4 && atteint < 3.5,
    atteint == null ? 'N\'ATTEINT JAMAIS LE RUPTEUR' : `${atteint.toFixed(2)} s du ralenti au rupteur`);
  dire('le rupteur tient', depasse < 0.03, `dépassement ${(100 * depasse).toFixed(1)} %`);
}

// --- 3. en prise : le régime suit-il la boîte, et les passages se voient-ils ? ---
{
  const v = new EAVehicle(CONF);
  const hist = [];
  pas(v, 14, (t) => Math.min(80, t * 6), 1, (t, vit) => hist.push({ t, v: vit, g: v.drivetrain.gear, r: v.engine.rpm }));
  const roule = hist.filter((h) => h.t > 1.2);
  const hors = roule.filter((h) => h.r > CONF.engine.limiter * 1.03 || (h.g > 0 && h.r < 500));
  dire('régime dans sa plage', hors.length === 0, `${hors.length} relevés hors plage sur ${roule.length}`);

  const rapports = [];
  for (const h of hist) if (!rapports.length || rapports[rapports.length - 1] !== h.g) rapports.push(h.g);
  const monte = rapports.every((g, i) => i === 0 || g === 0 || rapports[i - 1] === 0 || g >= rapports[i - 1]);
  dire('la boîte ne redescend pas', monte, rapports.join(' → '));

  // à chaque passage, le régime doit tomber : c'est ça, une boîte
  /* Un passage se lit sur le dernier rapport NON NUL, pas sur l'image d'avant : la boîte tombe au
  point mort pendant le passage, donc la suite des rapports est 1 → 0 → 2, et comparer à l'image
  précédente ne voyait jamais 1 → 2. Première version de ce contrôle : zéro chute sur cinq
  passages, alors que les cinq avaient bien eu lieu. */
  let chutes = 0, dernier = 0, hautAvant = 0;
  for (const h of hist) {
    if (h.g === 0) continue;
    if (dernier > 0 && h.g > dernier) {
      const apres = hist[Math.min(hist.indexOf(h) + 30, hist.length - 1)].r;
      if (apres < hautAvant * 0.92) chutes++;
    }
    if (h.g !== dernier) hautAvant = h.r;
    else hautAvant = Math.max(hautAvant, h.r);
    dernier = h.g;
  }
  const passages = rapports.filter((g) => g > 0).length - 1;
  dire('chaque passage fait chuter', chutes >= Math.max(1, passages - 1), `${chutes} chutes pour ${passages} passages`);

  // le régime doit correspondre à ce que la boîte impose, hors passage
  const ecarts = roule.filter((h) => h.g > 0).map((h) => Math.abs(h.r - v.rpmFor(h.v, h.g)) / Math.max(1, v.rpmFor(h.v, h.g)));
  ecarts.sort((a, b) => a - b);
  const median = ecarts[Math.floor(ecarts.length / 2)];
  dire('régime = vitesse × rapport', median < 0.06, `écart médian ${(100 * median).toFixed(1)} % avec la boîte`);
}

// --- 4. rien ne part en NaN, jamais ---
{
  const v = new EAVehicle(CONF);
  let sale = 0;
  let tt = 0;
  pas(v, 10, (t) => 40 + 35 * Math.sin(t * 3), 1, (t) => {
    v.engine.throttle = Math.sin(t * 7) > 0 ? 1 : 0;
    if (!isFinite(v.engine.rpm) || !isFinite(v.engine.omega) || !isFinite(v.drivetrain.omega)) sale++;
  });
  dire('aucun NaN sous secousses', sale === 0, `${sale} relevés non finis`);
}

// --- 5. pied levé, le régime redescend ---
{
  const v = new EAVehicle(CONF);
  pas(v, 3, 30, 1, null);
  const haut = v.engine.rpm;
  pas(v, 2, (t) => Math.max(2, 30 - t * 12), 0, null);
  dire('frein moteur', v.engine.rpm < haut * 0.8, `${Math.round(haut)} → ${Math.round(v.engine.rpm)} tr/min pied levé`);
}

console.log('\nfautes', fautes);
process.exit(fautes ? 1 : 0);
