/* Le banc moteur : la page qui sert à ENTENDRE, parce que moi je ne peux pas.

Tout ce que je sais mesurer du volant d'inertie est dans `tools/moteur-banc.js`, et c'est juste.
Mais aucun chiffre ne dit si un moteur sonne bien. Cette page existe pour ça : elle met le modèle et
le mélangeur entre les mains de quelqu'un qui a des oreilles, avec les quatre réglages qui changent
réellement le caractère — et elle affiche ce que le mélangeur envoie, pour qu'un désaccord entre ce
qu'on entend et ce qui se passe se voie tout de suite. */
'use strict';

const CONF_URL = 'sounds/engine/voitures.json';
let cat = null, conf = null, jeu = null, vehicule = null, sampler = null, ctx = null;
let gaz = 0, vitesse = 0, t0 = 0, dernier = 0;

const $ = (id) => document.getElementById(id);

async function demarrer() {
  if (ctx) return;
  cat = await (await fetch(CONF_URL)).json();
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const sortie = ctx.createGain();
  sortie.gain.value = 0.7;
  sortie.connect(ctx.destination);
  sampler = new EASampler(ctx, sortie);
  $('etat').textContent = 'chargement des prises…';
  const picker = $('voiture');
  picker.innerHTML = Object.keys(cat.voitures).map((id) =>
    `<option value="${id}">${cat.voitures[id].nom}</option>`).join('');
  picker.addEventListener('change', () => choisir(picker.value));
  await choisir(picker.value);
  if (ctx.state === 'suspended') await ctx.resume();
  $('demarrer').disabled = true;
  t0 = performance.now(); dernier = t0;
  requestAnimationFrame(boucle);
}

/* Changer de voiture ne recharge que ce qui change. Les cinq voitures partagent le même jeu de
prises : les recharger à chaque fois rendrait le banc inutilisable pour comparer deux réglages,
puisqu'on attendrait huit mégaoctets entre chaque essai. */
async function choisir(id) {
  const c = cat.voitures[id], j = cat.jeux[c.jeu];
  if (jeu !== c.jeu) {
    $('etat').textContent = 'chargement du jeu « ' + j.nom + ' »…';
    await sampler.charge(j.sounds);
    jeu = c.jeu;
  }
  /* Le réglage du jeu de prises d'abord, celui de la voiture par-dessus. C'est l'ordre qui compte :
  l'inertie, le temps de passage et l'amortissement viennent de la configuration de l'auteur, et la
  voiture n'impose que ce qui la définit chez nous — son rupteur, son ralenti et sa boîte, parce que
  le HUD affiche ce régime et que la boîte doit correspondre à la vitesse réelle de la voiture. */
  conf = {
    engine: Object.assign({}, j.engine, c.engine),
    drivetrain: Object.assign({}, j.drivetrain, c.drivetrain),
    wheel_radius: c.wheel_radius,
  };
  if (c.engine.limiter && !c.engine.soft_limiter) conf.engine.soft_limiter = c.engine.limiter * 0.99;
  vehicule = new EAVehicle(conf);
  $('etat').textContent = `${c.nom} — prises « ${j.nom} », rupteur ${conf.engine.limiter}`;
}

function boucle(now) {
  requestAnimationFrame(boucle);
  // pas borné : un onglet revenu au premier plan livre parfois une seconde entière d'un coup
  const dt = Math.min(0.05, (now - dernier) / 1000);
  dernier = now;
  const v = vitesse / 3.6;
  vehicule.update(now - t0, dt, v, gaz);
  sampler.applique(vehicule.engine);

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
