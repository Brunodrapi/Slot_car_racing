// Checks the drawn arrow itself rather than the intent behind it: captures where the arrowhead
// lands in world coordinates, works out which way the drawn arc turns, and compares that with the
// way the road actually bends through the corner the board announces.
const { chromium } = require('playwright');
const track = process.argv[2] || 'monza';
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 900, height: 600 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  // L'écran-titre s'interpose désormais entre le chargement et le menu : n'importe quelle touche
  // le passe, comme pour un joueur.
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.click('[data-action="setup"][data-mode="timetrial"]');
  await page.waitForTimeout(200);
  await page.click(`[data-action="pickTrack"][data-id="${track}"]`).catch(() => {});
  await page.click('[data-action="startQuick"]');
  await page.waitForTimeout(3000);
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
    R.updateCamera = () => {};
    R.draw(app.race, app.ui);
    Renderer.paceArrow = orig;

    // nothing is culled at this zoom, so the captured arrows line up with T.boards one for one
    const rows = [];
    for (let i = 0; i < Math.min(caught.length, T.boards.length); i++) {
      const c = caught[i], bd = T.boards[i];
      // the drawn arc turns by (endTan - startTan); positive = clockwise on a y-down canvas,
      // and the panel is rotated with the track, so that is a turn to the driver's right
      // in the panel's frame the driver's right is +x, so a growing tangent angle is a right turn
      const drawnSign = Math.sign(c.endTan - c.startTan);
      // how the road really bends through that corner
      let dth = 0;
      for (let d = bd.from; d < bd.to; d++) {
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
  console.log(`${res.caught} flèches dessinées sur ${res.boards} panneaux, ${bad.length} à l'envers`);
  console.log(JSON.stringify(res.rows.slice(0, 6)));
  await b.close();
})();
