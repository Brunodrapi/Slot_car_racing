// Rend le moteur d'une voiture en un fichier écoutable, sans passer par le jeu.
//
//   NODE_PATH=$(npm root -g) node tools/enginedemo.js <id> <sortie.wav> [secondes] [--synthese]
//
// `--synthese` ignore la prise et rend la synthèse, ce qui donne les deux moitiés d'une écoute
// comparée : même voiture, même accélération, même code, seule la source du timbre change.
//
// Le son se juge à l'oreille ; tout le reste de l'outillage le mesure. Celui-ci rend hors ligne
// une accélération du ralenti au rupteur, en passant les rapports, par exactement le même code
// que le jeu — `GameAudio.update` appelé au pas fixe — et écrit le résultat.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav',
  '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const id = process.argv[2] || 'm1procar';
  const dst = process.argv[3] || '/tmp/demo.wav';
  const DUR = +(process.argv[4] || 12);
  const synthese = process.argv.includes('--synthese');

  const serveur = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(400);

  const pcm = await page.evaluate(async ({ id: mid, DUR: dur, base: b, synthese: sy }) => {
    const SR = 44100;
    const m = modelById(mid);
    // La boucle est chargée à l'avance : un rendu hors ligne ne laisse pas le temps à un `fetch`
    // d'aboutir, et le moteur retomberait sur la synthèse sans qu'on sache pourquoi.
    let pre = null;
    if (m.engine.sample && !sy) {
      const tmp = new OfflineAudioContext(1, 128, SR);
      pre = [];
      for (const x of m.engine.sample.set) {
        pre.push({ rpm: x.rpm, buf: await tmp.decodeAudioData(await (await fetch(`${b}/${x.src}`)).arrayBuffer()) });
      }
    }
    const off = new OfflineAudioContext(1, SR * dur, SR);
    const a = new GameAudio();
    a.start(off);
    a.setEnabled(true);
    if (pre) {
      a.smpFetching = a._key(m.engine);
      a.smpKey = a.smpFetching;
      a.smpVoices = pre.sort((x, y) => x.rpm - y.rpm).map((l) => {
        const g = off.createGain(); g.gain.value = 0; g.connect(a.smpFilter);
        const n = off.createBufferSource();
        n.buffer = l.buf; n.loop = true; n.connect(g); n.start();
        return { rpm: l.rpm, src: n, gain: g };
      });
    }
    // Deux secondes à l'arrêt, puis on accélère jusqu'à la vitesse maximale, puis on lève le pied.
    const pas = 1 / 60;
    for (let i = 0; i * pas < dur; i++) {
      const t = i * pas;
      const ph = t < 2 ? 0 : t < dur - 2 ? (t - 2) / (dur - 4) : 1;
      const gaz = t >= 2 && t < dur - 2;
      const car = { cls: m, v: ph * m.vmax, throttle: gaz, usage: 0, state: 'track', slide: 0 };
      off.suspend(Math.min(t, dur - 1 / SR)).then(() => { a.update(car, t >= 2); off.resume(); });
    }
    const buf = await off.startRendering();
    return Array.from(buf.getChannelData(0));
  }, { id, DUR, base, synthese });

  // en-tête WAV mono 16 bits
  const n = pcm.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(44100 * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  let crete = 0;
  for (const x of pcm) crete = Math.max(crete, Math.abs(x));
  const g = crete > 0 ? 0.89 / crete : 1;
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * g * 32767))), 44 + i * 2);
  fs.writeFileSync(dst, b);
  console.log(`${id} : ${(n / 44100).toFixed(1)} s écrites dans ${dst} (crête d'origine ${crete.toFixed(3)}, remontée de ${(20 * Math.log10(g)).toFixed(1)} dB)`);

  await browser.close();
  serveur.close();
})();
