// Les octets de référence de BinaryPack, écrits par la bibliothèque de PeerJS elle-même, pour que
// tests/binarypack.gd vérifie que Godot écrit et lit exactement la même chose.
//
//   node godot/outils/binarypack-vecteurs.js <peerjs-js-binarypack/dist/binarypack.cjs>
//
// Sortie : godot/tests/binarypack-vecteurs.json, une liste de { valeur, octets } où les octets
// bruts d'une valeur sont notés { "$octets": "hex" } (le JSON ne connaît pas Uint8Array).
'use strict';
const fs = require('fs'), path = require('path');
const lib = process.argv[2];
if (!lib) { console.error('chemin de binarypack.cjs ?'); process.exit(1); }
const { pack, unpack } = require(path.resolve(lib));

const octets = (n, a = 7) => Uint8Array.from({ length: n }, (_, i) => (i * a + 3) & 255);
const vers = (v) => v instanceof Uint8Array || v instanceof ArrayBuffer
  ? { $octets: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v).toString('hex') }
  // au-delà de 2³¹, un entier passe en texte : le JSON de Godot lit tous les nombres en double
  : typeof v === 'number' && Number.isInteger(v) && Math.abs(v) > 2 ** 31 ? { $entier: String(v) }
  : Array.isArray(v) ? v.map(vers)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, vers(x)])) : v;

const valeurs = [
  null, true, false, 0, 1, 127, 128, 255, 256, 65535, 65536, 4294967295, 4294967296, 9007199254740991,
  -1, -32, -33, -128, -129, -32768, -32769, -2147483648, -2147483649, -9007199254740991,
  0.5, -0.5, 0.1, 3.141592653589793, -2.5e-7, 1.23e-300, 123.456, -98765.4321,
  '', 'a', 'Pilote', 'é', 'Gîte du Pré · №', '🏁 drapeau', 'x'.repeat(15), 'y'.repeat(16), 'z'.repeat(300),
  [], [1, 2, 3], Array.from({ length: 16 }, (_, i) => i - 8), Array.from({ length: 300 }, (_, i) => i % 3),
  {}, { a: 1 }, Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['k' + i, i * 1.5])),
  octets(0), octets(15), octets(16), octets(40), octets(1000, 13),
  // ce que le jeu fait vraiment passer
  { from: '0-ABCD-x1y2z3', p: { pid: 'k3j4h5g6', protocol: 4, name: 'Bruno', car: { modelId: 'porsche991gt3r', livree: 2 }, ready: true, spectator: false,
    t: { timeOfDay: 'night', mode: 'race', trackId: 'spa', laps: 3, difficulty: 'medium', cat: 'all', go: 1795171675123 } } },
  { from: '1-ABCD-q9w8e7', message: { kind: 'owned', seq: 42, state: octets(41), ack: 3, meta: null, urgent: false, radius: 131, race: 1795171675123 } },
  { from: '0-ABCD-x1y2z3', message: { kind: 'clock', offset: -12345.678901, rtt: 34.5, peers: { k3j4h5g6: 35 }, race: 1795171675123 } },
  { __peerData: 7, n: 1, total: 3, data: octets(300) },
  { __peerData: { type: 'close' } },
];

const sortie = valeurs.map((v) => ({ valeur: vers(v), octets: Buffer.from(new Uint8Array(pack(v))).toString('hex') }));
// et la relecture : ce que la bibliothèque rend de ses propres octets (un double reste un double)
for (const s of sortie) {
  const relu = unpack(new Uint8Array(Buffer.from(s.octets, 'hex')).buffer);
  s.relu = vers(relu);
}
const dest = path.join(__dirname, '..', 'tests', 'binarypack-vecteurs.json');
fs.writeFileSync(dest, JSON.stringify(sortie));
console.log(sortie.length, 'vecteurs →', dest, (fs.statSync(dest).size / 1024).toFixed(0) + ' ko');
