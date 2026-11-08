/* LA RÈGLE DU TOUR NET, et le trou du rattrapage. On vérifie les deux : la fonction elle-même, et
   le fait qu'un temps aidé ne puisse pas revenir par la porte de derrière au démarrage suivant. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
let src = '';
for (const f of ['util', 'career'])
  src += fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')
    .replace(/'use strict';/g, '').replace(/if \(typeof module[^\n]*\n/g, '') + '\n';
src += `
const base = { showLines: false, aimant: 0, ff: 0.3, wear: false };
const CAS = [
  ['configuration de référence',   {},                     null,            true],
  ['guide de freinage',            { showLines: true },    null,            false],
  ['aimant doux',                  { aimant: 0.6 },        null,            false],
  ['aimant ×2 fort',               { aimant: 3.2 },        null,            false],
  ['anticipation à 0',             { ff: 0 },              null,            false],
  ['anticipation à 1',             { ff: 1 },              null,            false],
  ['anticipation au défaut',       { ff: 0.3 },            null,            true],
  ['sauvegarde sans champ ff',     { ff: undefined },      null,            true],
  ['usure (course)',               {},                     { usure: {} },   false],
  ['télémétrie seule',             { debug: true },        null,            true],
  ['aimant ET guide',              { showLines: true, aimant: 1 }, null,    false],
];
const O = [];
for (const [nom, delta, race, attendu] of CAS) {
  const save = Object.assign({}, base, delta);
  const got = tourNet(save, race || {});
  O.push({ nom, got, attendu, ok: got === attendu });
}
RESULTAT.v = O;
`;
const RESULTAT = { v: null };
vm.runInNewContext(src, { Math, console, RESULTAT, navigator: { language: 'fr' },
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { createElement: () => ({ getContext: () => null }) }, window: {} }, { filename: 'net' });
let faux = 0;
for (const r of RESULTAT.v) {
  if (!r.ok) faux++;
  console.log((r.ok ? '  ok   ' : '  FAUX ') + r.nom.padEnd(32)
    + (r.got ? 'compte pour le monde' : 'exclu') + (r.ok ? '' : '   (attendu : ' + (r.attendu ? 'compte' : 'exclu') + ')'));
}

// --- le trou du rattrapage : un temps aidé ne doit pas revenir au démarrage suivant ---
const main = fs.readFileSync(path.join(R, 'js', 'main.js'), 'utf8');
const verifs = [
  ['le rattrapage lit le registre NET', main.includes('rattrape(this.save.bestLapsNets)')],
  ['il ne lit plus le registre personnel', !main.includes('rattrape(this.save.bestLaps)')],
  ['un temps aidé n\'entre pas dans le registre net', main.includes('if (net && (save.bestLapsNets[keyCar] == null')],
  ['le motif de refus est posé quand ce n\'est pas net', main.includes("raison: race.usure ? 'usure' : 'aides'")],
];
const car = fs.readFileSync(path.join(R, 'js', 'career.js'), 'utf8');
verifs.push(['les anciennes sauvegardes sont reprises', car.includes('save.bestLapsNets = Object.assign({}, save.bestLaps)')]);
const ui = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');
verifs.push(['le refus a un message FR et EN', (ui.match(/refus_aides:/g) || []).length === 2]);
verifs.push(['l\'écran des réglages avertit', ui.includes("t('horsClassement')")]);
console.log();
for (const [quoi, ok] of verifs) { if (!ok) faux++; console.log((ok ? '  ok   ' : '  FAUX ') + quoi); }
console.log('\n' + faux + ' faute(s)');
process.exit(faux ? 1 : 0);
