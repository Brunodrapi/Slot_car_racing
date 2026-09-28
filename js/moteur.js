/* Le banc moteur : la page qui sert à ENTENDRE, parce que moi je ne peux pas.

Tout ce que je sais mesurer du volant d'inertie est dans `tools/moteur-banc.js`, et c'est juste.
Mais aucun chiffre ne dit si un moteur sonne bien. Cette page existe pour ça : elle met le modèle et
le mélangeur entre les mains de quelqu'un qui a des oreilles, avec les quatre réglages qui changent
réellement le caractère — et elle affiche ce que le mélangeur envoie, pour qu'un désaccord entre ce
qu'on entend et ce qui se passe se voie tout de suite. */
'use strict';

const CONF_URL = 'sounds/engine/m1-procar.json';
let conf = null, vehicule = null, sampler = null, ctx = null;
let gaz = 0, vitesse = 0, t0 = 0, dernier = 0;

const $ = (id) => document.getElementById(id);

async function demarrer() {
  if (ctx) return;
  conf = await (await fetch(CONF_URL)).json();
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const sortie = ctx.createGain();
  sortie.gain.value = 0.7;
  sortie.connect(ctx.destination);
  sampler = new EASampler(ctx, sortie);
  $('etat').textContent = 'chargement des prises…';
  await sampler.charge(conf.sounds);
  vehicule = new EAVehicle(conf);
  if (ctx.state === 'suspended') await ctx.resume();
  $('etat').textContent = conf.nom + ' — ' + Object.keys(conf.sounds).length + ' boucles';
  $('demarrer').disabled = true;
  t0 = performance.now(); dernier = t0;
  requestAnimationFrame(boucle);
}

function boucle(now) {
  requestAnimationFrame(boucle);
  // pas borné : un onglet revenu au premier plan livre parfois une seconde entière d'un coup
  const dt = Math.min(0.05, (now - dernier) / 1000);
  dernier = now;
  const v = vitesse / 3.6;
  vehicule.update(now - t0, dt, v, gaz);
  sampler.applique(vehicule.engine, conf.bande);

  const e = vehicule.engine;
  $('v-rpm').textContent = Math.round(e.rpm);
  $('v-gear').textContent = vehicule.drivetrain.gear || 'N';
  $('v-kmh').textContent = Math.round(vitesse);
  $('v-clutch').textContent = vehicule.clutch.toFixed(2);
  $('jauge').style.width = Math.min(100, 100 * e.rpm / e.limiter) + '%';
  $('jauge').style.background = e.auRupteur ? '#ff4d4d' : '#ffd400';

  const et = sampler.etat();
  $('voies').innerHTML = Object.keys(et).map((k) =>
    `<tr><td>${k}</td><td>gain ${et[k].gain.toFixed(3)}</td><td>${et[k].detune > 0 ? '+' : ''}${et[k].detune} cents</td>
     <td><div class="barre" style="width:${Math.round(100 * et[k].gain)}%"></div></td></tr>`).join('');
}

$('demarrer').addEventListener('click', demarrer);
$('vitesse').addEventListener('input', (e) => { vitesse = +e.target.value; $('l-v').textContent = vitesse + ' km/h'; });
const bouton = $('gaz');
const on = () => { gaz = 1; bouton.classList.add('on'); };
const off = () => { gaz = 0; bouton.classList.remove('on'); };
bouton.addEventListener('pointerdown', (e) => { e.preventDefault(); demarrer(); on(); });
window.addEventListener('pointerup', off);
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); demarrer(); on(); } });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') off(); });
