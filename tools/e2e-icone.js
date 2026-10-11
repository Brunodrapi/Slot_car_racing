/* L'icone et le manifeste sont-ils VRAIMENT joignables aux adresses que les pages declarent ?

   Premiere version de ce banc : elle se contentait d'ecouter les reponses du navigateur et
   annoncait « 0 chargé » tout en disant ok. Chromium sans barre d'onglets ne va jamais chercher un
   favicon : le banc ne pouvait pas voir ce qu'il pretendait mesurer. On va donc chercher chaque
   href soi-meme, depuis la page, et on lit le code et le type. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const R = '/home/user/Slot_car_racing';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  const f = path.join(R, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('non'); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const b = await chromium.launch();
  let fautes = 0;
  const dire = (ok, txt) => { if (!ok) fautes++; console.log('  ' + (ok ? 'ok  ' : 'FAUX') + ' ' + txt); };
  for (const page of ['index.html', 'editor.html', 'lignes.html', 'moteur.html']) {
    const p = await b.newPage();
    await p.goto(`http://127.0.0.1:${port}/${page}`);
    const r = await p.evaluate(async () => {
      const liens = [...document.querySelectorAll('link[rel*="icon"],link[rel="manifest"]')];
      const out = [];
      for (const l of liens) {
        try {
          const rep = await fetch(l.href);
          const buf = await rep.arrayBuffer();
          out.push({ rel: l.rel, href: l.getAttribute('href'), code: rep.status,
                     type: rep.headers.get('content-type'), octets: buf.byteLength });
        } catch (e) { out.push({ rel: l.rel, href: l.getAttribute('href'), code: 0, err: String(e) }); }
      }
      return out;
    });
    dire(r.length >= 2, page + ' déclare ses icônes   ' + r.length + ' lien(s)');
    for (const l of r) {
      dire(l.code === 200 && l.octets > 500,
        '  ' + l.rel.padEnd(17) + (l.href || '').padEnd(34) + l.code + '  ' + (l.octets || 0) + ' o  ' + (l.type || l.err || ''));
    }
    // le manifeste doit etre du JSON valide, avec des icones joignables elles aussi
    const m = r.find((x) => x.rel === 'manifest');
    if (m) {
      const ic = await p.evaluate(async (h) => {
        const j = await (await fetch(h)).json();
        const out = [];
        for (const i of j.icons) { const rep = await fetch(new URL(i.src, location.href)); out.push([i.src, i.sizes, i.purpose || '-', rep.status]); }
        return { nom: j.name, depart: j.start_url, icones: out };
      }, m.href);
      dire(!!ic.nom, '  manifeste lisible   « ' + ic.nom + ' », départ « ' + ic.depart + ' »');
      for (const [src, tailles, but, code] of ic.icones)
        dire(code === 200, '    icône ' + src.padEnd(22) + tailles.padEnd(10) + but.padEnd(10) + code);
    }
    await p.close();
  }
  await b.close(); srv.close();
  console.log('\n' + fautes + ' faute(s)');
})();
