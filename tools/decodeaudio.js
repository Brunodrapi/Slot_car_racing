// Décode en WAV n'importe quel fichier audio que le navigateur sait lire.
//
//   NODE_PATH=$(npm root -g) node tools/decodeaudio.js <entrée> <sortie.wav>
//
// Il n'y a pas de décodeur en ligne de commande dans cet environnement, mais il y a Chromium, qui
// en embarque un pour tous les formats du Web — WebM, Opus, MP3, AAC, OGG. On lui fait donc faire
// le travail : `decodeAudioData` rend les échantillons bruts, qu'on écrit tels quels.
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) { console.log('usage: node tools/decodeaudio.js <entrée> <sortie.wav>'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('about:blank');
  const b64 = fs.readFileSync(src).toString('base64');

  // Le décodage a lieu une fois et le résultat reste dans la page ; on le rapatrie ensuite par
  // tranches. D'un bloc, une prise de quelques minutes fait des dizaines de millions
  // d'échantillons, que le pont vers le navigateur sérialise en une chaîne unique — au-delà d'un
  // quart d'heure de son, Node refuse la chaîne (`ERR_STRING_TOO_LONG`) et rien n'est écrit.
  const info = await page.evaluate(async (data) => {
    const bin = atob(data);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const ctx = new OfflineAudioContext(1, 128, 48000);
    const buf = await ctx.decodeAudioData(u8.buffer);
    // On somme les voies : la suite du traitement est monophonique, et un moteur enregistré en
    // stéréo porte le même signal des deux côtés à quelques millisecondes près.
    const n = buf.length;
    const out = new Int16Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) out[i] += Math.max(-32768, Math.min(32767, Math.round(d[i] / buf.numberOfChannels * 32767)));
    }
    window.__pcm = out;
    return { sr: buf.sampleRate, voies: buf.numberOfChannels, n };
  }, b64);
  console.log(`décodé : ${(info.n / info.sr).toFixed(1)} s, ${info.sr} Hz, ${info.voies} voie(s) — rapatriement…`);

  const PAS = 1 << 21;
  const morceaux = [];
  for (let i = 0; i < info.n; i += PAS) {
    const part = await page.evaluate(({ i: i0, k }) => {
      const v = new Uint8Array(window.__pcm.buffer, i0 * 2, Math.min(k, window.__pcm.length - i0) * 2);
      let s2 = '';
      for (let j = 0; j < v.length; j += 0x8000) s2 += String.fromCharCode.apply(null, v.subarray(j, j + 0x8000));
      return btoa(s2);
    }, { i, k: PAS });
    morceaux.push(Buffer.from(part, 'base64'));
  }
  const r = { sr: info.sr, voies: info.voies, pcm16: Buffer.concat(morceaux) };

  await browser.close();

  const n = r.pcm16.length / 2;
  const w = Buffer.alloc(44 + n * 2);
  w.write('RIFF', 0); w.writeUInt32LE(36 + n * 2, 4); w.write('WAVE', 8);
  w.write('fmt ', 12); w.writeUInt32LE(16, 16); w.writeUInt16LE(1, 20); w.writeUInt16LE(1, 22);
  w.writeUInt32LE(r.sr, 24); w.writeUInt32LE(r.sr * 2, 28); w.writeUInt16LE(2, 32); w.writeUInt16LE(16, 34);
  w.write('data', 36); w.writeUInt32LE(n * 2, 40);
  r.pcm16.copy(w, 44);
  fs.writeFileSync(dst, w);
  console.log(`${src} : ${(n / r.sr).toFixed(1)} s, ${r.sr} Hz, ${r.voies} voie(s) → ${dst}`);
})();
