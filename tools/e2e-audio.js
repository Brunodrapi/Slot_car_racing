// Le son des voitures, mesuré plutôt qu'écouté.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-audio.js
//
// Deux choses à vérifier, et aucune ne s'entend sur une capture d'écran.
//
// 1. La boîte. Le régime doit monter puis retomber à chaque rapport. Sans boîte il monterait tout
//    droit du ralenti au rupteur sur toute la plage de vitesse, ce qui est le défaut le plus
//    audible qu'un moteur de jeu puisse avoir.
// 2. La différenciation. Un quatre-temps allume cyl/2 fois par tour, donc à régime égal un V12
//    doit sonner une octave au-dessus d'un six en ligne. On rend une demi-seconde de son hors
//    ligne, on en prend le spectre, et on regarde où tombe le pic.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let errs = 0;
  page.on('pageerror', (e) => { if (errs++ < 4) console.log('[pageerror]', e.message); });
  await page.goto('file:///home/user/Slot_car_racing/index.html');
  await page.waitForTimeout(500);

  // --- 1. la boîte de vitesses ---
  const boite = await page.evaluate(() => {
    const a = new GameAudio();
    const e = modelById('gt40').engine;
    const out = [];
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const g = a._gearbox(f * 70, 70, e);
      out.push([+(f * 100).toFixed(0), g.gear + 1, Math.round(g.rpm)]);
    }
    return out;
  });
  console.log('régime selon la vitesse (GT40, rupteur 6200) :');
  console.log('  vitesse %  ' + boite.map(b => String(b[0]).padStart(5)).join(''));
  console.log('  rapport    ' + boite.map(b => String(b[1]).padStart(5)).join(''));
  console.log('  tr/min     ' + boite.map(b => String(b[2]).padStart(5)).join(''));
  const descentes = boite.filter((b, i) => i > 0 && b[2] < boite[i - 1][2]).length;
  console.log('  chutes de régime (passages de rapport) :', descentes, '— attendu 4');

  // --- 2. le spectre de chaque moteur ---
  const spectres = await page.evaluate(async () => {
    const SR = 44100, DUR = 0.4;
    const res = [];
    for (const m of modelsOf('gt')) {
      const off = new OfflineAudioContext(1, SR * DUR, SR);
      const a = new GameAudio();
      a.start(off);
      a.setEnabled(true);
      // une voiture à mi-régime, pied dedans, sur la piste
      const faux = { cls: m, v: m.vmax * 0.55, throttle: true, state: 'ok', slide: 0 };
      a.update(faux, true);
      a.update(faux, true);           // le régime est lissé : deux pas pour qu'il s'établisse
      const buf = await off.startRendering();
      const d = buf.getChannelData(0);
      // spectre par transformée directe sur une fenêtre au milieu du rendu, là où tout est établi
      const N = 8192, o = Math.floor(d.length * 0.5);
      let best = 0, bestF = 0;
      const pics = [];
      for (let f = 30; f <= 1500; f += 2) {
        let re = 0, im = 0;
        const w = 2 * Math.PI * f / SR;
        for (let i = 0; i < N; i++) { re += d[o + i] * Math.cos(w * i); im += d[o + i] * Math.sin(w * i); }
        const mag = Math.hypot(re, im) / N;
        pics.push([f, mag]);
        if (mag > best) { best = mag; bestF = f; }
      }
      const rms = Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length);
      res.push({ nom: m.name, cyl: m.engine.cyl, rpm: Math.round(a.rpm), pic: bestF, rms: +rms.toFixed(4) });
    }
    return res;
  });
  console.log('\nspectre à mi-régime, pied dedans :');
  console.log('  voiture          cyl   tr/min   allumage attendu   pic mesuré   écart');
  let bad = 0;
  for (const s of spectres) {
    const attendu = s.rpm / 60 * s.cyl / 2;
    const ecart = Math.abs(s.pic - attendu) / attendu * 100;
    if (ecart > 8) bad++;
    console.log('  ' + s.nom.padEnd(16) + String(s.cyl).padStart(3) + String(s.rpm).padStart(9)
      + attendu.toFixed(0).padStart(17) + ' Hz' + String(s.pic).padStart(11) + ' Hz'
      + (ecart.toFixed(1) + ' %').padStart(9) + (s.rms < 0.005 ? '   SILENCE' : ''));
  }
  const six = spectres.find(s => s.cyl === 6), douze = spectres.find(s => s.cyl === 12);
  if (six && douze) {
    console.log('\n  six en ligne ' + six.pic + ' Hz à ' + six.rpm + ' tr, douze ' + douze.pic + ' Hz à ' + douze.rpm + ' tr');
    console.log('  rapport ramené au même régime : ' + ((douze.pic / douze.rpm) / (six.pic / six.rpm)).toFixed(2) + ' — attendu 2,00 (une octave)');
  }
  console.log('\npics hors tolérance :', bad, '| erreurs', errs);
  await browser.close();
  process.exit(bad || errs ? 1 : 0);
})();
