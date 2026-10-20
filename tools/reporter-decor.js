#!/usr/bin/env node
/* REPORTER DANS LE DÉPÔT UN `tracks.js` FABRIQUÉ PAR L'ÉDITEUR DE DÉCOR.

    node tools/reporter-decor.js ~/Téléchargements/tracks.js            # reporte
    node tools/reporter-decor.js ~/Téléchargements/tracks.js --essai    # dit seulement ce qui changerait

« Fabriquer tracks.js » part du fichier tel que le site le sert. Le remettre tel quel dans `js/`
écraserait tout ce qui a changé dans le dépôt depuis — un circuit retouché par quelqu'un d'autre,
une correction du tracé — et réécrirait au passage les listes à sa façon. Ce script ne prend du
fichier reçu que les clés de décor (`CLES_DECOR`) qui diffèrent, circuit par circuit, et les pose
dans `js/tracks.js` avec `poserValeurs` : les éléments inchangés gardent leur texte et leurs
commentaires. Ce qui diffère hors décor est signalé, jamais reporté.

Il nettoie aussi ce qu'une version de l'éditeur a pu laisser : les positions retirées en double. */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const { poserValeurs } = require('../js/fichier-tracks.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const essai = args.includes('--essai');
const recu = args.find((a) => !a.startsWith('--'));
if (!recu) { console.error('usage : node tools/reporter-decor.js <tracks.js reçu> [--essai]'); process.exit(2); }

function charger(texteTracks) {
  const ctx = { console, Math, Map, Set, Array, Object, JSON, Number, String, Infinity, NaN, isFinite };
  vm.createContext(ctx);
  for (const f of ['js/util.js', 'js/traces.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  vm.runInContext(texteTracks, ctx, { filename: 'tracks.js' });
  return { tracks: vm.runInContext('TRACKS', ctx), cles: vm.runInContext('typeof CLES_DECOR !== "undefined" ? CLES_DECOR : null', ctx) };
}
const norme = (x) => JSON.stringify(x === undefined ? null : x, (k, y) => (typeof y === 'number' ? Math.round(y * 1e4) / 1e4 : y));
const clone = (x) => JSON.parse(JSON.stringify(x));

const fichier = path.join(ROOT, 'js/tracks.js');
const texte = fs.readFileSync(fichier, 'utf8');
const ici = charger(texte), la = charger(fs.readFileSync(recu, 'utf8'));
const CLES = ici.cles;

let txt = texte;
const reportes = {}, alertes = [];
for (const b of la.tracks) {
  const a = ici.tracks.find((t) => t.id === b.id);
  if (!a) { alertes.push(`${b.id} : circuit absent du dépôt, ignoré`); continue; }
  const ecart = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (norme(a[k]) === norme(b[k])) continue;
    if (!CLES.includes(k)) { alertes.push(`${b.id}.${k} : diffère hors décor, laissé tel quel`); continue; }
    let v = b[k] == null ? null : clone(b[k]);
    // une liste de traits vide vaut une clé absente
    if (['barrierPaths', 'barrierCuts', 'asphaltPads'].includes(k) && Array.isArray(v) && !v.length && a[k] == null) continue;
    if (k === 'objets' && v && v.retires) {
      const avant = v.retires.length;
      v.retires = v.retires.filter((p, i) => v.retires.findIndex((q) => Math.abs(q[0] - p[0]) < 0.05 && Math.abs(q[1] - p[1]) < 0.05) === i);
      if (v.retires.length < avant) alertes.push(`${b.id}.objets : ${avant - v.retires.length} position(s) retirée(s) en double, nettoyées`);
      if (!v.retires.length && !(v.ajouts || []).length) v = null;
      if (norme(a[k]) === norme(v)) continue;
    }
    ecart[k] = v;
  }
  if (!Object.keys(ecart).length) continue;
  txt = poserValeurs(txt, b.id, ecart);
  reportes[b.id] = ecart;
}
for (const a of ici.tracks) if (!la.tracks.some((t) => t.id === a.id)) alertes.push(`${a.id} : absent du fichier reçu, laissé tel quel`);

// Vérification : le décor est celui du fichier reçu, tout le reste celui du dépôt.
const apres = charger(txt);
for (const t of apres.tracks) {
  const a = ici.tracks.find((x) => x.id === t.id);
  for (const k of new Set([...Object.keys(a), ...Object.keys(t)])) {
    const attendu = reportes[t.id] && k in reportes[t.id] ? reportes[t.id][k] : a[k];
    if (norme(attendu) !== norme(t[k])) { console.error(`ÉCHEC : ${t.id}.${k} ne porte pas la valeur attendue`); process.exit(1); }
  }
}

for (const [id, e] of Object.entries(reportes)) console.log(`${id} : ${Object.keys(e).join(', ')}`);
for (const m of alertes) console.log('  ! ' + m);
if (!Object.keys(reportes).length) { console.log('Aucun décor à reporter.'); process.exit(0); }
if (essai) { console.log('(essai : js/tracks.js non modifié)'); process.exit(0); }
fs.writeFileSync(fichier, txt);
console.log('js/tracks.js mis à jour.');
