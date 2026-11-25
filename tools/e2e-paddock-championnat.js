/* Recette du paddock, des menus à la simulation, avec souris et écran tactile.
   GRIP_TEST_URL=http://127.0.0.1:8765/ node tools/e2e-paddock-championnat.js */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.env.GRIP_TEST_URL || 'http://127.0.0.1:8765/';
const dispositions = [
  { width: 1964, height: 1143 },
  { width: 1366, height: 768 },
  { width: 1024, height: 600 },
  { width: 390, height: 844, tactile: true },
  { width: 320, height: 720, tactile: true }
];
const ancienneSauvegarde = {
  name: 'PiloteTest', lang: 'fr', sound: false, laps: 2, cat: 'f1', filtreCat: 'f1',
  models: { f1: 'renaultrs10', gt3: 'porsche991gt3r' },
  programme: { circuits: ['redbullring'], positions: {} }
};

async function verifieVue(page, presse, cadre) {
  const boutons = page.locator('.quick-options [data-action="pickDiff"], #solo-ai, [data-action="pickDegats"], #sel-reglage, [data-action="startTune"]');
  for (const bouton of await boutons.all()) {
    assert(await bouton.isVisible());
    assert(await bouton.evaluate(el => {
      const r = el.getBoundingClientRect(), carte = el.closest('.quick-options').getBoundingClientRect();
      return r.left >= carte.left && r.right <= carte.right + 1 && r.width > 30 && r.height > 20;
    }), 'commande hors de son panneau');
  }
  if (!cadre.tactile && cadre.width >= 1024) {
    assert(await page.locator('.quick-footer [data-action="startQuick"]').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1), 'En piste hors écran sur PC');
    for (const bouton of await boutons.all()) {
      assert(await bouton.evaluate(el => {
        const r = el.getBoundingClientRect(), pied = document.querySelector('.quick-footer').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= Math.min(innerHeight, pied.top);
      }), 'commande du PC recouverte par le pied');
    }
    const rail = page.locator('[data-rail="models"]');
    const original = await rail.evaluate(el => el.scrollLeft);
    const fleche = page.locator('[data-id="models"].railarrow.gauche');
    if (!(await fleche.evaluate(el => el.classList.contains('bout')))) {
      await presse(fleche);
      await page.waitForFunction(x => document.querySelector('[data-rail="models"]').scrollLeft < x, original);
    }
  }
  assert(await page.locator('.quick-light').isDisabled());
  await presse('[data-action="pickCat"][data-id="gt3"]');
  await presse('.quick-light');
  assert(await page.locator('.quick-preview .circuit-nuit').isVisible());
  await presse('.quick-light');
  assert.equal(await page.locator('.quick-preview .circuit-nuit').count(), 0);
  const livree = await page.locator('.quick-liveries span').innerText();
  await presse('.quick-liveries button:last-child');
  assert.notEqual(await page.locator('.quick-liveries span').innerText(), livree);
  await presse('[data-action="chronoCat"][data-id="gt3"]');
  const lignes = page.locator('.quick-times tbody tr');
  assert.deepEqual(await lignes.locator('td:last-child').allTextContents(), ['0:40.000', '0:43.000']);
  await presse('[data-action="chronoCat"][data-id="all"]');
  assert.deepEqual(await lignes.locator('td:last-child').allTextContents(), ['0:38.000', '0:40.000', '0:43.000']);
}

async function scenario(navigateur, cadre) {
  const { width, height, tactile } = cadre;
  const contexte = await navigateur.newContext({ viewport: { width, height }, isMobile: !!tactile, hasTouch: !!tactile, ignoreHTTPSErrors: true });
  try {
    await contexte.route('**/rest/v1/records?*', route => route.fulfill({ json: [
      { voiture: 'ferrari488gt3', temps: 43 }, { voiture: 'renaultrs10', temps: 38 }, { voiture: 'porsche991gt3r', temps: 40 }
    ] }));
    await contexte.route('**/functions/v1/**', route => route.fulfill({ json: {} }));
    // Rejoue une sauvegarde existante et le navigateur où structuredClone manquait.
    await contexte.addInitScript(save => {
      if (!localStorage.getItem('slotracer.save.v2')) localStorage.setItem('slotracer.save.v2', JSON.stringify(save));
      delete globalThis.structuredClone;
    }, ancienneSauvegarde);
    const page = await contexte.newPage();
    const erreurs = [];
    page.on('pageerror', erreur => erreurs.push(erreur.message));
    const presse = (cible) => {
      const controle = typeof cible === 'string' ? page.locator(cible) : cible;
      return tactile ? controle.tap() : controle.click();
    };
    const ouvrir = async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('.splash .poster').waitFor();
      if (tactile) await presse('.splash .poster');
      else await page.keyboard.press('Enter');
      await presse('[data-action="setup"][data-mode="race"]');
      await page.locator('.quick-paddock').waitFor();
    };

    await ouvrir();
    await page.locator('.quick-times tbody tr').first().waitFor();
    const boutonChampionnat = page.locator('[data-action="programme"]');
    assert.equal(await boutonChampionnat.getAttribute('aria-pressed'), 'false');
    assert(await page.locator('[data-action="pickLaps"]').isEnabled());
    assert.equal(await page.locator('.quick-facts dd').count(), 8);
    assert.equal(await page.locator('.quick-performance meter').count(), 5);
    assert(await page.locator('.quick-track-name .circuit-flag').evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.complete && el.naturalWidth > 0 && Math.abs(r.width / r.height - 4/3) < .1;
    }));
    await presse(boutonChampionnat);
    await presse('[data-action="programmeAjouter"]');
    await presse(page.locator('[data-action="programmeRetour"]').first());
    assert.equal(await boutonChampionnat.getAttribute('aria-pressed'), 'false');
    await verifieVue(page, presse, cadre);
    await presse('[data-action="pickDiff"]');
    await page.locator('#solo-ai').selectOption('3');
    const avantDegats = await page.locator('[data-action="pickDegats"]').getAttribute('aria-pressed');
    await presse('[data-action="pickDegats"]');
    assert.notEqual(await page.locator('[data-action="pickDegats"]').getAttribute('aria-pressed'), avantDegats);

    await presse('[data-action="programme"]');
    const manches = page.locator('.programme-manches li');
    assert.deepEqual(await manches.locator(':scope > b').allTextContents(), ['Apfelstrudel Ring']);
    if (!tactile && width >= 1366) {
      const dimensions = await manches.first().evaluate(el => [el.clientWidth, el.parentElement.clientWidth]);
      assert(dimensions[0] < dimensions[1] / 2, 'une manche s’étire sur tout le calendrier');
    }
    await presse('[data-action="programmeChoisir"][data-id="castellet"]');
    await presse('[data-action="programmeAjouter"]');
    assert.deepEqual(await manches.locator(':scope > b').allTextContents(), ['Apfelstrudel Ring', 'Pastaga 83']);

    const tours = page.locator('[data-programme-tours]');
    await tours.nth(0).fill('4');
    await tours.nth(1).fill('12');
    await presse('[data-action="programmeDeplacer"][data-id="1"][data-dir="-1"]');
    assert.deepEqual(await manches.locator(':scope > b').allTextContents(), ['Pastaga 83', 'Apfelstrudel Ring']);
    assert.deepEqual(await tours.evaluateAll(champs => champs.map(champ => champ.value)), ['12', '4']);
    const essais = page.locator('[data-programme-duree="essais"]');
    const qualifs = page.locator('[data-programme-duree="qualifications"]');
    await essais.fill('1');
    await qualifs.fill('2');
    await page.locator('[data-programme-pilote="joueur"]').selectOption('2');
    await presse('[data-action="programmeAppliquer"]');
    assert(await page.locator('[data-action="pickLaps"]').isDisabled());

    await ouvrir();
    await presse('[data-action="programme"]');
    assert.deepEqual(await tours.evaluateAll(champs => champs.map(champ => champ.value)), ['12', '4']);
    assert.equal(await essais.inputValue(), '1');
    assert.equal(await qualifs.inputValue(), '2');
    assert.equal(await page.locator('[data-programme-pilote="joueur"]').inputValue(), '2');
    if (width === 1366) {
      await presse('[data-action="programmeAppliquer"]');
      await presse('[data-action="startQuick"]');
      await page.waitForFunction(() => app.state === 'race' && app.race?.phase === 'essais');
      assert.equal(await page.evaluate(() => app.race.dureeSession), 60);
      await page.keyboard.press('Escape');
      await presse('[data-action="quitRace"]');
      await presse('[data-action="setup"][data-mode="race"]');
      await presse('[data-action="programme"]');
    }
    await essais.fill('0');
    await qualifs.fill('0');
    await presse('[data-action="programmeRetirer"][data-id="1"]');
    assert.equal(await manches.count(), 1);
    await presse('[data-action="programmeAppliquer"]');
    await presse('[data-action="startQuick"]');
    await page.waitForFunction(() => app.state === 'race' && app.race);
    const depart = await page.evaluate(() => ({
      circuit: app.race.track.id, tours: app.race.opts.laps, phase: app.race.phase, voitures: app.race.cars.length
    }));
    assert.deepEqual(depart, { circuit: 'castellet', tours: 12, phase: 'course', voitures: 4 });
    assert.deepEqual(erreurs, []);
    console.log(`OK ${width}×${height} ${tactile ? 'tactile' : 'souris'}`);
  } finally {
    await contexte.close();
  }
}

(async () => {
  const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium' });
  try {
    for (const cadre of dispositions) await scenario(navigateur, cadre);
  } finally {
    await navigateur.close();
  }
})().catch(erreur => { console.error(erreur); process.exitCode = 1; });
