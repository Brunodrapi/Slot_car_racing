// Checks the drawn arrow itself rather than the intent behind it: captures where the arrowhead
// lands in world coordinates, works out which way the drawn arc turns, and compares that with the
// way the road actually bends through the corner the board announces.
const { chromium } = require('playwright');
/* SANS ARGUMENT, TOUS LES CIRCUITS. Le défaut était « monza » — le seul des douze dont la liste de
panneaux est calculée. Le banc tournait donc sur le cas qui ne pouvait pas échouer, et laissait les
cinq listes reprises à la main hors de portée. Un banc qui ne regarde que l'endroit sûr est un banc
qui dit toujours oui. */
const seul = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null;
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 900, height: 600 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  const ids = seul ? [seul]
    : await page.evaluate(() => (typeof TRACKS !== 'undefined' ? TRACKS.map((t) => t.id) : ['monza']));
  let total = 0;
  for (const track of ids) {
  // On passe par l'API du jeu plutôt que par les boutons du menu : la version qui cliquait
  // `data-mode="timetrial"` s'est mise à expirer le jour où le menu a été redessiné, et un banc
  // qui tombe pour une raison étrangère à ce qu'il vérifie ne vérifie plus rien.
  await page.waitForFunction(() => typeof app !== 'undefined' && app.save);
  await page.evaluate(() => { app.save.name = 'Banc'; storeSave(app.save); app.mondial = null; });
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.evaluate((id) => app.startQuick('timetrial', 'gt', id), track);
  await page.waitForFunction(() => window.app && app.race && app.race.track, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const res = await page.evaluate(() => {
    const R = app.renderer, T = app.race.track;
    const caught = [];
    const orig = Renderer.paceArrow;
    Renderer.paceArrow = function (g, box, spec, dir) {
      // the glyph starts pointing up the panel and ends along the tangent at the end of its bend
      const bend = spec.bend * Math.PI / 180;
      const startTan = -Math.PI / 2;
      caught.push({ bend, dir, startTan, endTan: startTan + dir * bend });
      return orig.call(this, g, box, spec, dir);
    };
    // draw every board by putting the whole circuit in view
    R.cam.x = (T.bounds.minX + T.bounds.maxX) / 2;
    R.cam.y = (T.bounds.minY + T.bounds.maxY) / 2;
    R.cam.zoom = 0.2;
    R.rotate = false;
    R.updateCamera = () => {};
    R.draw(app.race, app.ui);
    Renderer.paceArrow = orig;

    // nothing is culled at this zoom, so the captured arrows line up with T.boards one for one
    const zones = T.zonesVirages(60);
    const rows = [];
    for (let i = 0; i < Math.min(caught.length, T.boards.length); i++) {
      const c = caught[i], bd = T.boards[i];
      // the drawn arc turns by (endTan - startTan); positive = clockwise on a y-down canvas,
      // and the panel is rotated with the track, so that is a turn to the driver's right
      // in the panel's frame the driver's right is +x, so a growing tangent angle is a right turn
      const drawnSign = Math.sign(c.endTan - c.startTan);
      /* QUEL VIRAGE CE PANNEAU ANNONCE-T-IL ?

      `from`/`to` ne sont posés que sur les panneaux CALCULÉS : `_panneauxPoses` ne les met pas,
      puisqu'une liste reprise à la main ne dit pas de quelle zone elle parle. Sans eux, la boucle
      ci-dessous ne tournait pas du tout, `dth` restait à zéro, et `Math.sign(0)` ne valant aucun des
      deux sens, TOUS les panneaux étaient comptés « à l'envers ». Le banc annonçait donc 100 % de
      fautes sur les cinq circuits dont la liste est reprise, et 0 % sur le seul qui ne l'est pas —
      c'est-à-dire qu'il ne vérifiait rien là où il y avait justement quelque chose à vérifier.

      Pour une liste reprise, on retrouve la zone comme l'éditeur : l'entrée de virage la plus proche,
      devant ou derrière. */
      let a0 = bd.from, a1 = bd.to;
      if (a0 == null) {
        /* LE VIRAGE VISÉ EST CELUI QUE LE PANNEAU ANNONCE, donc celui dont l'entrée tombe le plus
        près de `station + distance annoncée` — et non le plus proche du panneau. Pour une annonce à
        200 m, le virage le plus proche est souvent le précédent, et le banc aurait jugé la flèche
        contre un virage dont elle ne parle pas. Sans chiffre annoncé, il ne reste que le plus
        proche. */
        const j = Math.round(bd.at * T.n) + Math.round((bd.dist || 0) / T.ds);
        let best = Infinity;
        for (const z of zones) {
          const e = (((z.from % T.n) + T.n) % T.n);
          let d = (((e - j) % T.n) + T.n) % T.n;
          if (d > T.n / 2) d -= T.n;
          if (Math.abs(d) < Math.abs(best)) { best = d; a0 = z.from; a1 = z.firstTo; }
        }
      }
      // how the road really bends through that corner
      let dth = 0;
      for (let d = a0; d < a1; d++) {
        const p = ((d % T.n) + T.n) % T.n, q = (((d + 1) % T.n) + T.n) % T.n;
        let e = T.th[q] - T.th[p];
        while (e > Math.PI) e -= 2 * Math.PI;
        while (e < -Math.PI) e += 2 * Math.PI;
        dth += e;
      }
      rows.push({ dist: bd.dist, note: bd.kind === 'normal' ? bd.grade : bd.kind, drawnSign, roadSign: Math.sign(dth),
        ok: drawnSign === Math.sign(dth) });
    }
    return { caught: caught.length, boards: T.boards.length, rows };
  });
  const bad = res.rows.filter(r => !r.ok);
  total += bad.length;
  console.log(track.padEnd(13) + String(res.caught).padStart(3) + ' flèches sur '
    + String(res.boards).padStart(3) + ' panneaux · ' + String(bad.length).padStart(2) + ' à l\'envers'
    + (bad.length ? '   ' + JSON.stringify(bad.slice(0, 3)) : ''));
  }
  console.log('\ntotal ' + total + ' flèche(s) à l\'envers');
  await b.close();
})();
