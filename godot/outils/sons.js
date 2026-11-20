/* Les sons du moteur, du jeu web vers la version Godot.

     node godot/outils/sons.js

Lit sounds/engine/voitures.json (les jeux de prises de markeasting/engine-audio, licence MIT, et
les réglages de chaque voiture), convertit chaque boucle WAV en Ogg Vorbis (ffmpeg, qualité 6 :
quinze mégaoctets deviennent deux), et écrit godot/donnees/sons.json. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'godot', 'sons');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'sounds', 'engine', 'voitures.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const jeux = {};
for (const [id, j] of Object.entries(cat.jeux)) {
  const sons = {};
  for (const [cle, s] of Object.entries(j.sounds)) {
    const fichier = `${id}-${cle}.ogg`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(ROOT, s.source), '-c:a', 'libvorbis', '-q:a', '6', path.join(OUT, fichier)]);
    sons[cle] = { fichier: `res://sons/${fichier}`, rpm: s.rpm || 1000, volume: s.volume == null ? 1 : s.volume };
  }
  jeux[id] = { nom: j.nom, niveau: j.niveau == null ? 1 : j.niveau, engine: j.engine || {}, drivetrain: j.drivetrain || {}, sons };
}
for (const f of ['LICENSE']) if (fs.existsSync(path.join(ROOT, 'sounds', 'engine-audio', f))) fs.copyFileSync(path.join(ROOT, 'sounds', 'engine-audio', f), path.join(OUT, 'LICENSE-engine-audio'));
fs.writeFileSync(path.join(ROOT, 'godot', 'donnees', 'sons.json'), JSON.stringify({ jeux, voitures: cat.voitures }, null, 1) + '\n');
const taille = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${Object.keys(jeux).length} jeux de prises, ${Object.keys(cat.voitures).length} voitures réglées ; ${(taille / 1e6).toFixed(1)} Mo d'Ogg`);
