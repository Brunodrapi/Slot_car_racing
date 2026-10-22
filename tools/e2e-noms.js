// Les noms affichés des voitures et des circuits : ceux de la table, et rien d'autre ne bouge.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-noms.js [--reference=<commit>] [dossier des captures]
//
// La table `tools/noms-affichage.json` donne, pour chaque identifiant, le nom à afficher — en français
// comme en anglais, à l'identique. Le test le vérifie en trois temps :
//
//   les données   les 25 voitures et les 13 circuits existent sous leurs identifiants d'origine et
//                 portent le nom de la table. Avec --reference, on compare aussi à un état antérieur
//                 du dépôt : tout le reste (physique, tracés, sprites, sons, livrées) est identique,
//                 et une livrée ne change de nom que si elle portait le nom de la voiture, ou si la
//                 table la renomme (plus aucune marque, constructeur ou sponsor, dans les livrées) ;
//   le multijoueur la grille d'une course en ligne voyage par identifiants (`modelId`, `trackId`), et
//                 chaque écran retrouve le nom dans son propre registre ;
//   l'écran       au format d'un iPhone : les menus en français et en anglais montrent les mêmes
//                 noms ; la Purosangue Furia 40, la Breithüft Langheck et la McHaggis Arrow 23
//                 roulent avec leur dessin sur Stand de frites, Le Rocher, Autoroute 11 et Royal Air
//                 Base ; un record enregistré sous `monza|gt|f40` par une ancienne sauvegarde se
//                 retrouve, au bon temps, en face du nouveau nom.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const TABLE = require('./noms-affichage.json');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const REF = arg('reference');
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--')) || null;
let fautes = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAUX  ') + m); if (!c) fautes++; };

// Les registres, lus dans un bac à sable : depuis le dépôt, ou depuis un commit donné.
function registres(lire) {
  let src = '';
  for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race'])
    src += lire(`js/${f}.js`).replace(/if \(typeof module[^\n]*\n/g, '').replace(/'use strict';/g, '') + '\n';
  src += 'this.R = { CATEGORIES, MODELS, TRACKS, Race };';
  const ctx = { console, Math, Date };
  vm.runInNewContext(src, ctx);
  return ctx.R;
}
const ici = registres((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'));

console.log('Les données');
const voitures = new Map(ici.MODELS.map((m) => [m.id, m]));
const circuits = new Map(ici.TRACKS.map((t) => [t.id, t]));
const vRates = TABLE.voitures.filter((v) => !voitures.has(v.id) || voitures.get(v.id).name !== v.display_name || voitures.get(v.id).catId !== v.categorie);
ok(TABLE.voitures.length === 25 && vRates.length === 0, `25 voitures, chacune sous son identifiant d'origine et dans sa catégorie, avec le nom de la table`
  + (vRates.length ? ' — en défaut : ' + vRates.map((v) => v.id).join(', ') : ''));
const cRates = TABLE.circuits.filter((c) => !circuits.has(c.id) || circuits.get(c.id).name !== c.display_name);
ok(TABLE.circuits.length === 13 && cRates.length === 0, `13 circuits, chacun sous son identifiant d'origine, avec le nom de la table`
  + (cRates.length ? ' — en défaut : ' + cRates.map((c) => c.id).join(', ') : ''));
ok([...voitures.values(), ...circuits.values()].every((x) => typeof x.name === 'string'),
  'un seul nom par voiture et par circuit, sans variante de langue : le même en français et en anglais');
ok(circuits.get('castellet').name === 'Pastaga 83', 'castellet → « Pastaga 83 »');
// Les livrées : celles de la table ont leur nouveau nom, et aucune ne porte plus de marque.
const lRates = TABLE.livrees.filter((l) => { const m = voitures.get(l.voiture); const lv = m && m.livrees.find((x) => x.id === l.id); return !lv || lv.nom !== l.display_name; });
ok(lRates.length === 0, `${TABLE.livrees.length} livrées renommées selon la table` + (lRates.length ? ' — en défaut : ' + lRates.map((l) => l.voiture + '/' + l.id).join(', ') : ''));
const MARQUES = ['Ferrari', 'Lamborghini', 'BMW', 'Porsche', 'Mazda', 'Datsun', 'Nissan', 'Jaguar', 'Chevrolet', 'Corvette', 'Ford', 'Lotus',
  'Williams', 'McLaren', 'Tyrrell', 'Brabham', 'Ligier', 'Renault', 'Elf', 'JPS', 'Parmalat', 'Saudia', 'Gitanes', 'Motorsport', 'BASF',
  'Denim', 'Pilot', 'Rain-X', 'JLOC', 'Martini', 'Swiss', 'Vaillant', 'BFGoodrich', 'Castrol', 'Dunlop', 'Jägermeister', 'Efini',
  'Rothmans', 'Shell', 'Silk Cut', 'Gulf', 'IMSA'];
const marquees = ici.MODELS.flatMap((m) => m.livrees.filter((l) => MARQUES.some((b) => new RegExp(`(^|[^\\p{L}])${b}([^\\p{L}]|$)`, 'u').test(l.nom))).map((l) => `${m.id} « ${l.nom} »`));
ok(marquees.length === 0, 'aucune marque (constructeur ou sponsor) dans les noms de livrées' + (marquees.length ? ' — reste : ' + marquees.join(', ') : ''));

if (REF) {
  const avant = registres((f) => execFileSync('git', ['show', `${REF}:${f}`], { cwd: ROOT, encoding: 'utf8' }));
  // les livrées que la table renomme sont attendues sous leur nouveau nom
  for (const l of TABLE.livrees) {
    const lv = (avant.MODELS.find((m) => m.id === l.voiture) || { livrees: [] }).livrees.find((x) => x.id === l.id && x.nom === l.original);
    if (lv) lv.nom = l.display_name;
  }
  const sansNom = (o, ancien, neuf) => JSON.stringify(o, (k, v) => (k === 'name' ? undefined : k === 'nom' && v === ancien ? neuf : v));
  const vDiff = avant.MODELS.filter((a) => { const b = voitures.get(a.id); return !b || sansNom(a, a.name, '§') !== sansNom(b, b.name, '§'); });
  ok(avant.MODELS.length === ici.MODELS.length && vDiff.length === 0,
    `par rapport à ${REF} : rien d'autre ne change dans les ${ici.MODELS.length} voitures — physique, moteur, sprites, sons, livrées (hors nom de la voiture)`
    + (vDiff.length ? ' — diffèrent : ' + vDiff.map((m) => m.id).join(', ') : ''));
  const tDiff = avant.TRACKS.filter((a) => { const b = circuits.get(a.id); return !b || sansNom(a) !== sansNom(b); });
  ok(avant.TRACKS.length === ici.TRACKS.length && tDiff.length === 0,
    `par rapport à ${REF} : rien d'autre ne change dans les ${ici.TRACKS.length} circuits — tracé, surfaces, décor, stands`
    + (tDiff.length ? ' — diffèrent : ' + tDiff.map((t) => t.id).join(', ') : ''));
  ok(JSON.stringify(avant.CATEGORIES.map((c) => ({ ...c, models: c.models.length }))) === JSON.stringify(ici.CATEGORIES.map((c) => ({ ...c, models: c.models.length }))),
    'les catégories sont intactes');
  const livrees = ici.MODELS.flatMap((m) => m.livrees.map((l, i) => ({ m, l, a: avant.MODELS.find((x) => x.id === m.id).livrees[i] })))
    .filter(({ l, a }) => l.nom !== a.nom);
  console.log('        livrées qui portaient le nom de la voiture, et le suivent : '
    + (livrees.map(({ m, a, l }) => `${m.id} « ${a.nom} » → « ${l.nom} »`).join(', ') || 'aucune'));
}

console.log('Le multijoueur');
const net = fs.readFileSync(path.join(ROOT, 'js/net.js'), 'utf8');
ok(/m: \(x\.car && x\.car\.modelId\)/.test(net) && /trackId: t\.trackId/.test(net) && /modelId: g\.m/.test(net),
  'la grille et la table voyagent par identifiants (modelId, trackId), jamais par nom');
{
  const def = ici.TRACKS.find((t) => t.id === 'spa');
  const race = new ici.Race({ trackDef: def, classId: 'proto', difficulty: 'medium', mode: 'race', nCars: 2,
    humans: [{ name: 'Hôte', modelId: '935', livree: 1, local: true }, { name: 'Invité', modelId: '962', livree: 0 }] });
  const noms = race.cars.map((c) => c.cls.name).sort().join(' + ');
  ok(noms === 'Breithüft Aero 62 + Breithüft Langheck' && race.track.name === 'Stand de frites',
    `une grille reçue par identifiants s'affiche sous les nouveaux noms : ${noms} sur ${race.track.name}`);
}

(async () => {
  const { chromium, devices } = require('playwright');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(e.message));
    const url = 'file://' + path.join(ROOT, 'index.html');

    // Une ancienne sauvegarde : un record rangé sous `circuit|catégorie|voiture`, une voiture et une
    // livrée choisies par identifiant — exactement ce que le jeu écrivait avant le renommage (0.46.1),
    // marques de migration comprises : sans `tracesMigrated`, le jeu la prendrait pour une sauvegarde
    // d'avant la refonte des tracés et en effacerait les records, à raison.
    await p.goto(url);
    await p.evaluate(() => {
      localStorage.setItem('slotracer.save.v2', JSON.stringify({ name: 'Bruno', lang: 'fr', bestLaps: { 'monza|gt|f40': 81.234 },
        bestLapsNets: { 'monza|gt|f40': 81.234 }, models: { gt: 'f40', proto: '935', f1: 'mclarenm23' }, livrees: { f40: 2 },
        cat: 'gt', tutorialSeen: true, guideMigrated: true, tracesMigrated: true, catsMigrated: true }));
    });
    await p.reload();
    await p.waitForFunction(() => typeof app !== 'undefined' && app.save && app.save.name === 'Bruno');
    await p.evaluate(() => { app.mondial = null; app.leaveSplash(); });

    console.log('L\'écran');
    // Les menus, dans les deux langues.
    const menus = {};
    for (const lang of ['fr', 'en']) {
      menus[lang] = await p.evaluate((lang) => {
        app.save.lang = lang;
        const lu = {};
        for (const cat of ['gt', 'proto', 'f1']) {
          app.save.cat = cat; app.save.filtreCat = cat; app.ui.setup.trackId = 'monza';
          app.ui.setupScreen('timetrial');
          lu[cat] = [...document.querySelectorAll('[data-action="pickModel"] b, .models .card b')].map((b) => b.textContent.trim());
        }
        lu.circuits = [...document.querySelectorAll('[data-action="pickTrack"] b, .track-card b')].map((b) => b.textContent.trim());
        return lu;
      }, lang);
    }
    const attendusCircuits = TABLE.circuits.map((c) => c.display_name);
    ok(JSON.stringify(menus.fr) === JSON.stringify(menus.en), 'français et anglais montrent exactement les mêmes noms de voitures et de circuits');
    ok(attendusCircuits.every((n) => menus.fr.circuits.includes(n)) && menus.fr.circuits.length >= 13,
      `les 13 circuits du menu portent leur nouveau nom (${menus.fr.circuits.slice(0, 4).join(', ')}…)`);
    for (const cat of ['gt', 'proto', 'f1']) {
      const attendues = TABLE.voitures.filter((v) => v.categorie === cat).map((v) => v.display_name);
      ok(attendues.every((n) => menus.fr[cat].includes(n)), `${cat} : les ${attendues.length} voitures du menu portent leur nouveau nom`);
    }
    if (OUT) {
      await p.evaluate(() => { app.save.lang = 'fr'; app.save.cat = 'gt'; app.save.filtreCat = 'gt'; app.ui.setup.trackId = 'monza'; app.ui.setupScreen('timetrial'); });
      await p.screenshot({ path: path.join(OUT, 'noms-menu.png'), fullPage: true });
    }

    // L'ancien record retrouvé par ses identifiants.
    const record = await p.evaluate(() => {
      app.save.lang = 'fr'; app.save.cat = 'gt'; app.save.filtreCat = 'gt'; app.ui.setup.trackId = 'monza';
      app.ui.setupScreen('timetrial');
      const ligne = [...document.querySelectorAll('.records .rline')].find((l) => l.querySelector('b').textContent.trim() === 'Purosangue Furia 40');
      return { temps: ligne && ligne.querySelector('.rline-t').textContent.trim(), choisie: !!(ligne && ligne.classList.contains('sel')),
        circuit: app.trackDefById('monza').name, livree: app.playerLivreeFor('f40') };
    });
    ok(record.temps === '1:21.234' && record.choisie && record.livree === 2,
      `ancienne sauvegarde : le record monza|gt|f40 s'affiche en face de « Purosangue Furia 40 » sur ${record.circuit} (${record.temps}), voiture et livrée retrouvées`);

    // Trois voitures, quatre circuits : bon nom, bon dessin, bonnes caractéristiques, bonne mini-carte.
    const essais = [['f40', 'gt', 'spa'], ['935', 'proto', 'monaco'], ['mclarenm23', 'f1', 'lemans'], ['f40', 'gt', 'silverstone']];
    for (const [id, cat, piste] of essais) {
      const r = await p.evaluate(async ([id, cat, piste]) => {
        app.save.models[cat] = id;
        app.startQuick('timetrial', cat, piste);
        const t0 = performance.now();
        while (!(app.race && app.race.state === 'racing') && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 100));
        const c = app.race.player;
        while (!topReady(c.cls, c.livree) && performance.now() - t0 < 25000) await new Promise((r) => setTimeout(r, 100));
        const m = modelById(id);
        const vignette = app.ui.thumb(app.trackDefById(piste), 90);
        const res = { voiture: c.cls.name, id: c.cls.id, dessin: topReady(c.cls, c.livree), top: m.top, livrees: m.livrees.map((l) => l.nom),
          vmax: Math.round(m.vmax * 3.6), circuit: app.race.track.name, piste: app.race.track.def.id, longueur: Math.round(app.race.track.length),
          carte: typeof vignette === 'string' && vignette.length > 100 };
        app.toMenu();
        return res;
      }, [id, cat, piste]);
      const v = TABLE.voitures.find((x) => x.id === id), c = TABLE.circuits.find((x) => x.id === piste);
      ok(r.voiture === v.display_name && r.id === id && r.dessin && r.circuit === c.display_name && r.piste === piste && r.carte,
        `${r.voiture} sur ${r.circuit} : dessin ${r.top} chargé, ${r.vmax} km/h, ${r.longueur} m, mini-carte ; livrées ${r.livrees.join(' / ')}`);
    }
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  } finally {
    await browser.close();
  }
  console.log(fautes ? `${fautes} faute(s)` : 'OK');
  process.exitCode = fautes ? 1 : 0;
})();
