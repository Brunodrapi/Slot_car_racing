// Redessiner une épingle en tirant ses bords : la chaussée suit le dessin, l'axe passe entre les bords.
//
//   python3 -m http.server 8770 --bind 127.0.0.1 &   (à la racine du dépôt)
//   NODE_PATH=$(npm root -g) node tools/e2e-epingle-redessinee.js [http://127.0.0.1:8770]
//
// Dans l'outil « Largeur de piste », les bords dessinés se posaient sur l'axe d'origine : un contour
// qui passait de l'autre côté de l'axe était refusé, et l'on ne pouvait qu'élargir. Depuis 0.52.29,
// les deux bords font la chaussée et `Track._recentreBords` refait l'axe entre eux. On prend l'épingle
// la plus serrée de Monaco, on ramène son bord intérieur quatre mètres AU-DELÀ de l'axe et l'on
// écarte l'extérieur de six, puis on vérifie :
// - le moteur : retouche acceptée, axe déplacé, bords à moins de 50 cm du dessin, trajectoires dans
//   la chaussée, et un circuit sans contour rigoureusement inchangé ;
// - l'éditeur : un point tiré de deux mètres de plus, au-delà de l'axe, reste sous la souris — la
//   poignée ne fuit pas quand l'axe bouge ;
// - la course : les neuf voitures de l'ordinateur bouclent leur tour, sans une sortie de piste.
'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8770';
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

// les deux contours de l'épingle, posés sur l'axe d'origine (fraction de tour, écart au bord / 0,9)
const ZONES = `(base) => {
  let apex = 0; for (let i = 0; i < base.n; i++) if (Math.abs(base.k[i]) > Math.abs(base.k[apex])) apex = i;
  const f = apex / base.n, d = 25 / base.length, inner = base.k[apex] > 0 ? -1 : 1, hwIn = inner > 0 ? base.hwL[apex] : base.hwR[apex];
  return { apex, inner, z: [
    { side: inner, followContour: true, points: [[f - d, 0], [f - d / 2, -(hwIn + 1) / 0.9], [f, -(hwIn + 4) / 0.9], [f + d / 2, -(hwIn + 1) / 0.9], [f + d, 0]] },
    { side: -inner, followContour: true, points: [[f - d, 0], [f - d / 2, 3 / 0.9], [f, 6 / 0.9], [f + d / 2, 3 / 0.9], [f + d, 0]] }] };
}`;
// la plus grande distance du dessin au bord construit
const ECART = `(T, z) => {
  const curve = Track.roadCurve(T.roadEdgeControls.get(z), z.points.map((q) => q[0]), z.smoothContour !== false), edge = [];
  for (let i = 0; i < T.n; i++) edge.push(T.pos(i * T.ds, z.side * (z.side > 0 ? T.hwL[i] : T.hwR[i])));
  let max = 0;
  for (const q of curve) {
    let d = Infinity;
    for (let j = 1; j < edge.length; j++) { const a = edge[j - 1], c = edge[j], dx = c.x - a.x, dy = c.y - a.y, u = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1e-9))); d = Math.min(d, Math.hypot(q.x - a.x - u * dx, q.y - a.y - u * dy)); }
    max = Math.max(max, d);
  }
  return max;
}`;

(async () => {
  const b = await chromium.launch();
  try {
    // --- le moteur ---
    console.log('le moteur');
    const p = await b.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save);
    const m = await p.evaluate(([zonesSrc, ecartSrc]) => {
      const zones = eval(zonesSrc), ecart = eval(ecartSrc);
      const def = TRACKS.find((t) => t.id === 'monaco'), base = new Track(def, 0.9), r = zones(base);
      const T = new Track({ ...def, roadWidenings: [...(def.roadWidenings || []), ...r.z] }, 0.9);
      const q = base.pos(r.apex * base.ds, 0);
      let ap = 0, bd = Infinity;
      for (let i = 0; i < T.n; i++) { const d = (T.xs[i] - q.x) ** 2 + (T.ys[i] - q.y) ** 2; if (d < bd) { bd = d; ap = i; } }
      let hors = 0;
      for (const nom of ['racing', 'jaune', 'bleu']) for (let i = 0; i < T.n; i++) { const a = T.lines[nom][i]; if (a > T.hwL[i] + 0.01 || a < -T.hwR[i] - 0.01) hors++; }
      // sans contour : l'axe ne bouge pas d'un millimètre
      const simple = new Track({ ...def, roadWidenings: [{ side: 1, points: [[0.2, 0], [0.21, 2], [0.22, 0]] }] }, 0.9);
      let bouge = simple.n !== simple.axeBase.n;
      for (let i = 0; i < simple.n && !bouge; i++) if (simple.xs[i] !== simple.axeBase.xs[i] || simple.ys[i] !== simple.axeBase.ys[i]) bouge = true;
      return { invalides: [...T.roadEdgeInvalid.values()], axe: Math.sqrt(bd), stations: `${base.n} → ${T.n}`,
        ecartInt: ecart(T, r.z[0]), ecartExt: ecart(T, r.z[1]), hors, largeur: T.hwL[ap] + T.hwR[ap], bouge };
    }, [ZONES, ECART]);
    ok(!m.invalides.length, `la retouche est acceptée${m.invalides.length ? ' — ' + m.invalides.join(' / ') : ''}`);
    ok(m.axe > 3, `l'axe s'est déplacé de ${m.axe.toFixed(1)} m au plus serré (${m.stations} stations)`);
    ok(m.ecartInt < 0.5 && m.ecartExt < 0.5, `les bords suivent le dessin : ${(m.ecartInt * 100).toFixed(0)} cm à l'intérieur, ${(m.ecartExt * 100).toFixed(0)} cm à l'extérieur au pire`);
    ok(m.hors === 0, `les trajectoires restent dans la chaussée (${m.hors} station hors) ; ${m.largeur.toFixed(1)} m de large au plus serré`);
    ok(!m.bouge, 'sans contour dessiné, l\'axe ne bouge pas');
    ok(!erreurs.length, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));

    // --- l'éditeur : tirer un point au-delà de l'axe ---
    console.log('l\'éditeur');
    const e = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const err2 = [];
    e.on('pageerror', (x) => err2.push(x.message));
    await e.goto(BASE + '/editor.html?decor=monaco');
    await e.waitForFunction(() => typeof DEC !== 'undefined' && DEC.track && DEC.id === 'monaco');
    await e.click('[data-onglet="piste"]');
    const prise = await e.evaluate((zonesSrc) => {
      const zones = eval(zonesSrc), base = new Track(DEC.def0, ECHELLE_ROUTE), r = zones(base);
      const n0 = largeursPiste().length;
      largeursPiste().push(...r.z);
      DEC.track = new Track(definition(), ECHELLE_ROUTE); DEC.rendu.setTrack(DEC.track);
      DEC.sel = { outil: 'piste', zone: n0 }; DEC.mode = 'choisir'; majFiche();
      const z = largeursPiste()[n0], q = pointLargeur(z, 2), ax = axeDe(DEC.track), at = ax.wrap(z.points[2][0] * ax.length);
      // la cible : deux mètres de plus vers l'extérieur du virage, au-delà de l'axe d'origine
      const hw = z.side > 0 ? ax.hwLeftAt(at) : ax.hwRightAt(at), cible = ax.pos(at, z.side * (hw + z.points[2][1] * ECHELLE_ROUTE - 2));
      const rd = DEC.rendu; rd.cam.zoom = 8; rd.cam.x = q.x; rd.cam.y = q.y; peindre();
      return { zone: n0, a: versEcran(q.x, q.y), b: versEcran(cible.x, cible.y), cible, valeur: z.points[2][1] };
    }, ZONES);
    await e.waitForTimeout(200);
    await e.mouse.move(prise.a.x, prise.a.y); await e.mouse.down();
    await e.mouse.move(prise.b.x, prise.b.y, { steps: 10 }); await e.mouse.up();
    await e.waitForTimeout(400);
    const lache = await e.evaluate((zi) => {
      const z = largeursPiste()[zi], q = pointLargeur(z, 2);
      return { q, valeur: z.points[2][1], valide: !DEC.track.roadEdgeInvalid.has(z), raison: DEC.track.roadEdgeInvalid.get(z) || '' };
    }, prise.zone);
    const derive = Math.hypot(lache.q.x - prise.cible.x, lache.q.y - prise.cible.y);
    ok(derive < 0.3, `le point tiré reste sous la souris (${(derive * 100).toFixed(0)} cm), au-delà de l'axe`);
    ok(Math.abs((prise.valeur - lache.valeur) * 0.9 - 2) < 0.3, `il s'est déplacé de ${((prise.valeur - lache.valeur) * 0.9).toFixed(2)} m`);
    ok(lache.valide, 'la retouche reste acceptée' + (lache.raison ? ' — ' + lache.raison : ''));
    ok(!err2.length, 'aucune erreur dans l\'éditeur' + (err2.length ? ' : ' + err2.join(' | ') : ''));

    // --- la course ---
    console.log('la course');
    const c = await p.evaluate(async (zonesSrc) => {
      const zones = eval(zonesSrc), def = TRACKS.find((t) => t.id === 'monaco'), r = zones(new Track(def, 0.9));
      def.roadWidenings = [...(def.roadWidenings || []), ...r.z]; app.tracks.delete('monaco');
      app.mondial = null; app.save.name = 'Essai'; app.leaveSplash(); app.startQuick('race', 'f1', 'monaco');
      await new Promise((res) => { const w = () => (app.race && app.race.state === 'racing' ? res() : setTimeout(w, 50)); w(); });
      const ia = app.race.cars.filter((x) => !x.isPlayer);
      for (let i = 0; i < 60 * 150; i++) app.race.update(1 / 60);
      return { recentre: !!app.race.track.axeBase && app.race.track.n !== app.race.track.axeBase.n,
        tours: ia.filter((x) => x.lap >= 1).length, n: ia.length, sorties: ia.reduce((a, x) => a + (x.fautes || 0), 0) };
    }, ZONES);
    ok(c.recentre, 'la course roule sur la piste redessinée');
    ok(c.tours === c.n && c.sorties === 0, `${c.tours}/${c.n} voitures de l'ordinateur bouclent le tour, ${c.sorties} sortie de piste`);
    ok(!erreurs.length, 'aucune erreur en course' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
