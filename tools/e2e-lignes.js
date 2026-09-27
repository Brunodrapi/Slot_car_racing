// L'éditeur de lignes, éprouvé de bout en bout.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-lignes.js [dossier]
//
// La question qui décide de tout : **ce qu'on exporte est-il ce que le jeu rejoue ?** Un éditeur de
// trajectoires qui affiche une ligne et en produit une autre est pire qu'inutile — on croit régler
// et on règle à côté. L'essai déplace donc un point, exporte le bloc, le remet dans la définition du
// circuit, reconstruit le circuit comme le jeu le fait, et compare la ligne obtenue à celle qui
// était à l'écran. Tant que l'écart tient dans quelques dizaines de centimètres, ce qu'on voit est
// ce qu'on aura.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

(async () => {
  const dossier = process.argv[2] || null;
  if (dossier) fs.mkdirSync(dossier, { recursive: true });
  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const port = serveur.address().port;

  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 860 } });
  let errs = 0;
  page.on('pageerror', (e) => { errs++; console.log('ERREUR JS :', e.message); });
  await page.goto(`http://127.0.0.1:${port}/lignes.html`);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.track);

  const depart = await page.evaluate(() => ({
    circuits: TRACKS.length, circuit: S.def.id,
    pts: { racing: S.pts.racing.length, inside: S.pts.inside.length, outside: S.pts.outside.length },
  }));
  console.log('au chargement :', JSON.stringify(depart));
  for (const nom of ['racing', 'inside', 'outside']) {
    if (depart.pts[nom] !== 48) { errs++; console.log(`  ÉCHEC : ${nom} a ${depart.pts[nom]} points, 48 attendus`); }
  }

  // --- les trois lignes sont-elles distinctes, et dans la piste ? ---
  const place = await page.evaluate(() => {
    const T = S.track, u = T.unitScale;
    const ecart = (a, b) => Math.max(...S.pts[a].map((p, i) => Math.hypot(p[0] - S.pts[b][i][0], p[1] - S.pts[b][i][1]))) * u;
    const hors = (nom) => S.pts[nom].filter((p) => {
      const { j, lat } = projeter(p);
      return lat > T.hwL[j] + 0.5 || lat < -T.hwR[j] - 0.5;
    }).length;
    return { corde_int: ecart('racing', 'inside'), corde_ext: ecart('racing', 'outside'),
             hors: { racing: hors('racing'), inside: hors('inside'), outside: hors('outside') } };
  });
  console.log(`les trois lignes : corde↔intérieure ${place.corde_int.toFixed(1)} m, `
    + `corde↔extérieure ${place.corde_ext.toFixed(1)} m, hors piste ${JSON.stringify(place.hors)}`);
  if (place.corde_int < 1 || place.corde_ext < 1) { errs++; console.log('  ÉCHEC : les lignes se confondent'); }
  else console.log('  ok : les trois lignes sont distinctes');
  for (const [nom, n] of Object.entries(place.hors)) {
    if (n) { errs++; console.log(`  ÉCHEC : ${n} point(s) de ${nom} hors de la piste`); }
  }
  if (!Object.values(place.hors).some((n) => n)) console.log('  ok : aucun point hors de la piste');

  /* --- ce qu'on exporte est-il ce que le jeu rejoue ? ---

  On déplace un point de deux mètres vers l'extérieur, on exporte, et on reconstruit le circuit avec
  le bloc obtenu, exactement comme le jeu le fera. La ligne du circuit reconstruit doit retomber sur
  celle qu'affiche l'éditeur. */
  const fidelite = await page.evaluate(() => {
    const T = S.track, u = T.unitScale;
    const k = 12;
    const { j } = projeter(S.pts.racing[k]);
    const avant = S.pts.racing[k].slice();
    S.pts.racing[k] = [avant[0] + T.nx[j] * 2 / u, avant[1] + T.ny[j] * 2 / u];
    dessiner();
    exporter();
    const bloc = document.getElementById('sortie').value;
    const obj = JSON.parse(bloc.match(/lines\s*:\s*(\{[\s\S]*\})\s*,\s*$/)[1]
      .replace(/(\w+)\s*:/g, '"$1":').replace(/,(\s*[}\]])/g, '$1'));
    // reconstruit comme le jeu : la définition du circuit, plus le bloc exporté
    const def2 = Object.assign({}, S.def, { lines: obj });
    const T2 = new Track(def2);
    // L'écart entre la ligne AFFICHÉE — celle de l'aperçu, qui passe déjà par le code du jeu — et
    // celle que le jeu obtient en relisant le bloc exporté. Il ne doit rester que l'arrondi.
    let pire = 0;
    for (let i = 0; i < T2.n; i++) pire = Math.max(pire, Math.abs(T2.lines.racing[i] - S.apercu.lines.racing[i]));
    // et le point déplacé doit se retrouver déplacé dans le circuit reconstruit
    const bouge = Math.abs(T2.lines.racing[j] - S.track.lines.racing[j]);
    return { pire, bouge, pts: obj.racing.length };
  });
  console.log(`\nfidélité de l'export : la ligne rejouée s'écarte au pire de ${fidelite.pire.toFixed(2)} m `
    + `de celle affichée, et le point déplacé de 2 m l'est de ${fidelite.bouge.toFixed(2)} m`);
  if (fidelite.pire > 0.15) { errs++; console.log('  ÉCHEC : le jeu ne rejoue pas la ligne montrée'); }
  else console.log('  ok : ce qu’on voit est ce que le jeu jouera');
  // Le déplacement ne se retrouve pas en entier, et c'est voulu : le jeu limite la vitesse à
  // laquelle une trajectoire traverse la piste. Il doit s'en retrouver la moitié, pas la totalité.
  if (fidelite.bouge < 0.6) { errs++; console.log('  ÉCHEC : le déplacement ne se retrouve pas dans le circuit reconstruit'); }
  else console.log('  ok : le déplacement se retrouve dans le circuit, limitage du jeu compris');

  // --- relire un bloc rend-il la même chose ? ---
  const aller = await page.evaluate(() => {
    exporter();
    const t1 = document.getElementById('sortie').value;
    const avant = S.pts.racing.map((p) => p.slice());
    S.pts.racing = autoPoints('racing', S.pts.racing.length);   // on abîme
    relire();                                                   // on relit
    // L'export arrondit, donc on compare à la tolérance de l'arrondi et non au caractère près.
    const u = S.track.unitScale;
    const ecart = Math.max(...avant.map((p, i) => Math.hypot(p[0] - S.pts.racing[i][0], p[1] - S.pts.racing[i][1]))) * u;
    return { pareil: ecart < 0.05, ecart, t1len: t1.length };
  });
  if (!aller.pareil) { errs++; console.log(`  ÉCHEC : relire le bloc exporté décale la ligne de ${aller.ecart.toFixed(3)} m`); }
  else console.log(`  ok : exporter puis relire redonne la même ligne (à ${aller.ecart.toFixed(3)} m près)`);

  // --- tous les circuits se chargent-ils ? ---
  const tous = await page.evaluate(() => {
    const out = [];
    for (const t of TRACKS) {
      try {
        charger(t.id, false);
        out.push({ id: t.id, pts: S.pts.racing.length, ok: S.pts.racing.length > 10 });
      } catch (e) { out.push({ id: t.id, ok: false, err: e.message }); }
    }
    return out;
  });
  const mauvais = tous.filter((t) => !t.ok);
  if (mauvais.length) { errs++; console.log('  ÉCHEC : circuits illisibles —', JSON.stringify(mauvais)); }
  else console.log(`  ok : les ${tous.length} circuits se chargent`);

  if (dossier) {
    await page.evaluate(() => charger('monaco', false));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(dossier, 'lignes-monaco.png') });
    console.log(`\ncapture dans ${dossier}`);
  }

  console.log('\nerrors', errs);
  await navigateur.close();
  serveur.close();
  if (errs) process.exitCode = 1;
})();
