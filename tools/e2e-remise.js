// La remise à zéro des meilleurs tours : qu'elle efface, et qu'elle n'efface QU'UNE FOIS.
//
// Une migration jouée à chaque lecture au lieu d'une seule effacerait les temps que le joueur vient
// de poser, et rien ne le dirait : il reverrait simplement une liste vide à chaque ouverture. C'est
// le genre de défaut qu'on ne voit pas en le relisant — ce fichier le met en évidence.
const { chromium } = require('playwright');
const PAGE = 'file:///home/user/Slot_car_racing/index.html';
const CLE = 'slotracer.save.v2';
let fautes = 0;
const dit = (ok, quoi) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUTE'}  ${quoi}`); };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => { fautes++; console.log('[pageerror]', e.message); });

  // une sauvegarde d'avant : des temps, et pas de drapeau de migration
  await page.goto(PAGE);
  await page.evaluate((cle) => localStorage.setItem(cle, JSON.stringify({
    name: 'Testeur', lang: 'fr', laps: 5, lapsMigrated: true, guideMigrated: true,
    bestLaps: { 'monza|gt': 61.2, 'monza|gt|f40': 61.2, 'spa|gt': 88.4 },
  })), CLE);

  console.log('\nune sauvegarde posee avant le releve');
  await page.goto(PAGE);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  let s = await page.evaluate(() => app.save);
  dit(Object.keys(s.bestLaps).length === 0, `les meilleurs tours sont effaces (${Object.keys(s.bestLaps).length} restant)`);
  dit(s.tracesMigrated === true, 'le drapeau est pose');
  dit(s.name === 'Testeur', 'le reste de la sauvegarde est intact (nom garde)');
  const brut = await page.evaluate((cle) => JSON.parse(localStorage.getItem(cle)), CLE);
  dit(brut && Object.keys(brut.bestLaps).length === 0 && brut.tracesMigrated === true,
    'et c\'est ecrit dans le navigateur, pas seulement en memoire');

  console.log('\nun temps pose apres la remise a zero');
  await page.evaluate(() => { app.save.bestLaps['monza|gt'] = 77.7; storeSave(app.save); });
  await page.goto(PAGE);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  s = await page.evaluate(() => app.save);
  dit(s.bestLaps['monza|gt'] === 77.7, 'il survit au rechargement (la migration ne rejoue pas)');

  /* Une sauvegarde NEUVE ne passe pas par les migrations : `loadSave` rend les valeurs par defaut
     sans les lire. Le drapeau lui manque donc jusqu'a la premiere relecture, et c'est sans
     consequence — la migration qui s'y jouera portera sur un `bestLaps` deja vide. Ce qu'on verifie
     ici est donc ce qui compte vraiment : qu'elle parte sans temps, et qu'elle n'en perde aucun. */
  console.log('\nune sauvegarde neuve');
  await page.evaluate((cle) => localStorage.removeItem(cle), CLE);
  await page.goto(PAGE);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  s = await page.evaluate(() => app.save);
  dit(Object.keys(s.bestLaps).length === 0, 'part sans aucun temps');
  await page.evaluate(() => { app.save.bestLaps['laguna|gt'] = 55.5; storeSave(app.save); });
  await page.goto(PAGE);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  s = await page.evaluate(() => app.save);
  dit(s.bestLaps['laguna|gt'] === 55.5, 'et son premier temps survit a la migration qui s\'y joue');

  /* La seconde remise a zero, celle du 22 octobre 2026 : le tableau mondial a ete vide des temps
     d'avant, et l'appareil, qui ne date pas ses tours, efface tous les siens — les deux registres,
     et la liste de ce qui est deja parti au tableau. Une fois, et pas le reste de la sauvegarde. */
  console.log('\nune sauvegarde d\'avant le 22 octobre');
  await page.evaluate((cle) => {
    localStorage.setItem(cle, JSON.stringify({
      name: 'Testeur', lang: 'fr', guideMigrated: true, tracesMigrated: true, catsMigrated: true,
      models: { gt: 'f40' }, cups: { coupe: { race: 2, points: { Testeur: 18 } } },
      bestLaps: { 'monza|gt|f40': 61.2, 'monza|gt': 61.2 }, bestLapsNets: { 'monza|gt|f40': 61.2 },
    }));
    localStorage.setItem('eol.envoyes', JSON.stringify(['monza|f40']));
  }, CLE);
  await page.goto(PAGE);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  s = await page.evaluate(() => app.save);
  dit(!Object.keys(s.bestLaps).length && !Object.keys(s.bestLapsNets).length, 'les deux registres de temps sont vides');
  dit(s.tempsRemisMigrated === true, 'le drapeau est pose');
  dit(s.name === 'Testeur' && s.models.gt === 'f40' && s.cups.coupe && s.cups.coupe.race === 2, 'le reste est intact (nom, voiture, coupe en cours)');
  const envoyes = await page.evaluate(() => JSON.parse(localStorage.getItem('eol.envoyes') || '[]'));
  dit(envoyes.length === 0, 'la liste des temps deja envoyes au tableau est vide');

  console.log('\nun temps pose apres');
  await page.evaluate(() => { app.save.bestLaps['monza|gt|f40'] = 70.1; app.save.bestLapsNets['monza|gt|f40'] = 70.1; storeSave(app.save); });
  await page.goto(PAGE);
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  s = await page.evaluate(() => app.save);
  dit(s.bestLaps['monza|gt|f40'] === 70.1 && s.bestLapsNets['monza|gt|f40'] === 70.1, 'il survit au rechargement (la remise ne rejoue pas)');

  console.log(`\nfautes ${fautes}`);
  await b.close();
  process.exit(fautes ? 1 : 0);
})();
