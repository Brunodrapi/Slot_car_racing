// Les quatre vues, et la seule chose qu'une caméra n'a pas le droit de faire.
//
//   node tools/camera.js [circuit|all]
//
// Une caméra qui regarde devant met la voiture en bas de l'écran. Trop devant, elle la met DEHORS —
// et on ne pilote plus rien. Ce n'est pas une question de goût et ça ne se juge pas sur une capture
// à l'arrêt : ça dépend de la vitesse, du rayon du virage et du cadrage, donc ça se mesure sur un
// tour entier, à chaque image.
//
// L'essai appelle `Renderer.prototype.updateCamera` — la vraie, pas une copie — sur un objet qui
// porte juste ce dont elle a besoin, puis refait la transformation de `draw()` pour savoir où la
// voiture tombe sur l'écran, en fraction de largeur et de hauteur. 0 et 1 sont les bords.
const fs = require('fs'), vm = require('vm'), path = require('path');

const R = path.join(__dirname, '..');
let src = '';
for (const f of ['util', 'traces', 'tracks', 'track', 'cars', 'car', 'race', 'props', 'render'])
  src += fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
    .replace(/'use strict';/g, '').replace(/if \(typeof module[^\n]*\n/g, '') + '\n';

src += `
const VUES = [['track', 'dessus, orientée piste'], ['fixed', 'dessus, fixe'],
              ['avance', 'en avance, orientée piste'], ['avanceFixe', 'en avance, fixe']];
const W = 900, H = 1600;        // un téléphone en portrait : le cadrage le plus serré en largeur

function essai(trackId, vue) {
  const td = TRACKS.find((t) => t.id === trackId);
  const race = new Race({ trackDef: td, classId: 'gt', difficulty: 'medium',
    playerAI: true, playerLivery: 0, nCars: 3 });
  const faux = {
    w: W, h: H, pullBack: 1, cam: { x: 0, y: 0, zoom: 6 }, camAngle: 0,
    rotate: vue === 'track' || vue === 'avance',
    avance: vue === 'avance' || vue === 'avanceFixe',
  };
  const maj = Renderer.prototype.updateCamera;
  let pireX = 0, pireY = 0, basse = 0, n = 0, vmaxVue = 0;
  const p = race.player;
  while (race.state !== 'finished' && race.time < 400) {
    race.update(race.dt, aiThrottle(p, race.cars, race.dt, { marginBase: 0.06, marginSpread: 0 }));
    maj.call(faux, race, race.dt);
    // la transformation de draw(), à l'identique
    const u = (p.pos.x - faux.cam.x) * faux.cam.zoom, v = (p.pos.y - faux.cam.y) * faux.cam.zoom;
    let sx = u, sy = v;
    if (faux.rotate) {
      const a = -faux.camAngle - Math.PI / 2, c = Math.cos(a), s2 = Math.sin(a);
      sx = u * c - v * s2; sy = u * s2 + v * c;
    }
    const fx = (W / 2 + sx) / W, fy = (H / 2 + sy) / H;
    pireX = Math.max(pireX, Math.abs(fx - 0.5) * 2);      // 1 = pile sur le bord
    pireY = Math.max(pireY, Math.abs(fy - 0.5) * 2);
    basse = Math.max(basse, fy);
    vmaxVue = Math.max(vmaxVue, p.v);
    n++;
    if (p.lap >= 2) break;
  }
  return { pireX, pireY, basse, n, vmax: vmaxVue * 3.6 };
}

const seul = ARGS[0] && ARGS[0] !== 'all' ? [ARGS[0]] : TRACKS.map((t) => t.id);
let fautes = 0;
for (const id of seul) {
  console.log('\\n' + id);
  for (const [vue, nom] of VUES) {
    const r = essai(id, vue);
    const ok = r.pireX < 0.98 && r.pireY < 0.98;
    if (!ok) fautes++;
    console.log('  ' + (ok ? 'ok   ' : 'DEHORS') + ' ' + nom.padEnd(26)
      + 'bord atteint : ' + (r.pireX * 100).toFixed(0).padStart(3) + ' % en largeur, '
      + (r.pireY * 100).toFixed(0).padStart(3) + ' % en hauteur'
      + '   (voiture au plus bas : ' + (r.basse * 100).toFixed(0) + ' % de l écran)');
  }
}
console.log('\\nfautes ' + fautes);
`;
vm.runInNewContext(src, { Math, console, Date, Float32Array, Float64Array, ARGS: process.argv.slice(2),
  navigator: { language: 'fr' }, localStorage: { getItem: () => null, setItem: () => {} },
  document: { createElement: () => ({ getContext: () => null }) }, window: {} }, { filename: 'camera' });
