# GRIP Devlog #5 — Championships, Damage & Pit Stops, Play Offline

Ce que couvre ce billet : ce qui change pour le joueur entre la prod actuelle (0.56.4, celle du devlog #4)
et la version Godot qu'on publie sur grip-game.github.io et sur itch.io. À poster APRÈS la mise en prod et
le chargement du ZIP sur itch.io : le billet décrit cette version-là.

Une fois le billet posté :
- `curl -s https://drapiiii.itch.io/grip-racing-the-line/devlog.rss | node tools/dernier-devlog.js` met son
  titre et son lien sur l'écran-titre du jeu web (`DERNIER_DEVLOG`, `js/ui.js`) ;
- dans la version Godot, recopier les mêmes numéro, titre et adresse dans `Titre.DEVLOG`
  (`godot/scripts/ui/titre.gd`), puis réexporter (`bash godot/outils/publie-web.sh`).

**Pour coller dans itch.io** (son éditeur refuse le BBCode et le HTML collés comme du texte) : la page
https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/ montre le billet mis en forme, avec un bouton
« Copier le billet » qui met dans le presse-papiers sa version enrichie (titres, gras, liste, images par
leur adresse). On colle ensuite dans le corps du billet sur itch.io.

Images, dans `itch/devlog-5/` (le billet les affiche par leur adresse en recette : ne pas déplacer ce
dossier), toutes tirées de la version Godot, en anglais :

- `0-couverture.png` (696 × 512, image de couverture du billet) : le menu, l'arrivée d'un championnat, le podium
- `1-championnat.png` : le départ d'un championnat (calendrier, barème), le classement, l'arrivée finale, le podium
- `2-degats.png` : la tôle et les débris après un choc, puis l'écran DNF
- `3-stand.png` : un arrêt au stand, l'équipe autour de la voiture
- `4-telephone.png` : les menus du téléphone (menu, paddock de la course rapide, garage)
- `5-hors-ligne.png` : le téléchargement pour jouer hors ligne, et l'écran « Install game »

---

**GRIP Devlog #5 — Championships, Damage & Pit Stops, Play Offline**

A big GRIP update is live!

This one changes a lot: you can now race full championships, cars take damage and pit for repairs, the menus have been rebuilt for phones, and the game installs on your phone and plays offline. And under the hood, GRIP now runs on a new engine.

🏆 **Championships**
Build your own season: **up to ten races** on the circuits of your choice, with practice and qualifying sessions. Your car's class sets the scoring (F1, GT Sprint or Le Mans points). After every race, the standings show who gained and who lost places, and the last race ends on the podium. On equal points, the driver with the most wins goes first.

*[image : 1-championnat.png — A championship: the calendar, the standings, the final race and the podium]*
Online, the host can run a championship for the whole table, in race or in time-trial format. In time trial, every round is a qualifying session: your best lap scores the points.

💥 **Damage & Pit Stops**
Contact now leaves its mark. Bumpers are tough, flanks are soft, and a damaged car loses up to **35% of its top speed and acceleration**, never its grip. Sparks, debris and smoke follow, and if you hit a wall head-on at full speed, your race is over.

*[image : 2-degats.png — Damaged cars with debris on the track, and the DNF screen]*
Every circuit has a pit lane. Tick **PIT** under the lever, stop in your box and your crew rushes out: tape on the nose, new wheels, and you're back out after 1.5 to 8 seconds, depending on the damage. The AI pits too when it's badly hurt. Damage is an option in the paddock, on by default.

*[image : 3-stand.png — A pit stop: the crew around the car in its box]*

📱 **Made for Phones**
Hold your phone upright and the menus are all new: one screen per mode, your circuit and your car at a glance, a garage that compares all 35 cars on the same scale, settings in sheets you swipe away, and a big **ON TRACK!** button under your thumb.

*[image : 4-telephone.png — The new phone menus: main menu, quick race paddock and garage]*

📲 **Install It, Play Offline**
On grip-game.github.io, GRIP installs like an app: **Install game** in the menu shows how, step by step, on iPhone and on Android. It then opens full screen, without the browser bar.

You can also **download the whole game**, all 14 circuits included (about 150 MB), and race without a connection. The title screen offers it, and Settings let you delete it.

*[image : 5-hors-ligne.png — Downloading the game for offline play, and the install guide]*

🛠️ **A New Engine**
GRIP now runs on the Godot engine. The cars, the physics and the circuits are the same: the same race, replayed in both versions, ends lap for lap identical.

🔧 **And Also**
- A radar at the edge of the screen points to your nearest rivals when they're out of view.
- Tune your braking for each circuit and car, with practice laps to find your braking point.
- In Monaco's tunnel, it gets dark even by day: headlights come on, and daylight returns at the exit.
- Night is a little less dark: the scenery shows through, tinted blue.
- Music in the menus, very quiet: “Too Cool” by Kevin MacLeod.
- The engine fires up when you hit ON TRACK!, and the menus click under your finger.
- On a keyboard, the SPACE key lights up at the start.

🚦 **What's Next?**
I'm still refining the cars, the circuits and the driving. Tell me how your first championship went, and how many pit stops Monaco cost you!

Play the latest version here: https://grip-game.github.io/

Feedback, suggestions and bug reports are always welcome!

**SEE YOU ON THE TRACK!**

---

## Le billet en HTML, prêt à coller dans itch.io

```html
<p>A big GRIP update is live!</p>
<p>This one changes a lot: you can now race full championships, cars take damage and pit for repairs, the menus have been rebuilt for phones, and the game installs on your phone and plays offline. And under the hood, GRIP now runs on a new engine.</p>

<h2>🏆 Championships</h2>
<p>Build your own season: <strong>up to ten races</strong> on the circuits of your choice, with practice and qualifying sessions. Your car's class sets the scoring (F1, GT Sprint or Le Mans points). After every race, the standings show who gained and who lost places, and the last race ends on the podium. On equal points, the driver with the most wins goes first.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/1-championnat.png" alt="A championship: the calendar, the standings, the final race and the podium"></p>
<p>Online, the host can run a championship for the whole table, in race or in time-trial format. In time trial, every round is a qualifying session: your best lap scores the points.</p>

<h2>💥 Damage &amp; Pit Stops</h2>
<p>Contact now leaves its mark. Bumpers are tough, flanks are soft, and a damaged car loses up to <strong>35% of its top speed and acceleration</strong>, never its grip. Sparks, debris and smoke follow, and if you hit a wall head-on at full speed, your race is over.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/2-degats.png" alt="Damaged cars with debris on the track, and the DNF screen"></p>
<p>Every circuit has a pit lane. Tick <strong>PIT</strong> under the lever, stop in your box and your crew rushes out: tape on the nose, new wheels, and you're back out after 1.5 to 8 seconds, depending on the damage. The AI pits too when it's badly hurt. Damage is an option in the paddock, on by default.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/3-stand.png" alt="A pit stop: the crew around the car in its box"></p>

<h2>📱 Made for Phones</h2>
<p>Hold your phone upright and the menus are all new: one screen per mode, your circuit and your car at a glance, a garage that compares all 35 cars on the same scale, settings in sheets you swipe away, and a big <strong>ON TRACK!</strong> button under your thumb.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/4-telephone.png" alt="The new phone menus: main menu, quick race paddock and garage"></p>

<h2>📲 Install It, Play Offline</h2>
<p>On <a href="https://grip-game.github.io/">grip-game.github.io</a>, GRIP installs like an app: <strong>Install game</strong> in the menu shows how, step by step, on iPhone and on Android. It then opens full screen, without the browser bar.</p>
<p>You can also <strong>download the whole game</strong>, all 14 circuits included (about 150 MB), and race without a connection. The title screen offers it, and Settings let you delete it.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/5-hors-ligne.png" alt="Downloading the game for offline play, and the install guide"></p>

<h2>🛠️ A New Engine</h2>
<p>GRIP now runs on the Godot engine. The cars, the physics and the circuits are the same: the same race, replayed in both versions, ends lap for lap identical.</p>

<h2>🔧 And Also</h2>
<ul>
<li>A radar at the edge of the screen points to your nearest rivals when they're out of view.</li>
<li>Tune your braking for each circuit and car, with practice laps to find your braking point.</li>
<li>In Monaco's tunnel, it gets dark even by day: headlights come on, and daylight returns at the exit.</li>
<li>Night is a little less dark: the scenery shows through, tinted blue.</li>
<li>Music in the menus, very quiet: “Too Cool” by Kevin MacLeod.</li>
<li>The engine fires up when you hit ON TRACK!, and the menus click under your finger.</li>
<li>On a keyboard, the SPACE key lights up at the start.</li>
</ul>

<h2>🚦 What's Next?</h2>
<p>I'm still refining the cars, the circuits and the driving. Tell me how your first championship went, and how many pit stops Monaco cost you!</p>
<p>Play the latest version here: <a href="https://grip-game.github.io/">https://grip-game.github.io/</a></p>
<p>Feedback, suggestions and bug reports are always welcome!</p>
<p><strong>SEE YOU ON THE TRACK!</strong></p>
```

---

## Pour Discord

```
# 🏁 GRIP Devlog #5 — Championships, Damage & Pit Stops, Play Offline

A big GRIP update is live! Championships, damage and pit stops, new phone menus, and the game now installs and plays offline.

## 🏆 Championships
Up to **ten races** on the circuits of your choice, with practice and qualifying sessions. Your car's class sets the scoring (F1, GT Sprint or Le Mans). Standings after every race, a podium at the end. Online, the host can run a championship for the whole table, in race or time-trial format.

## 💥 Damage & Pit Stops
Bumpers are tough, flanks are soft: a damaged car loses up to 35% of its top speed and acceleration. Hit a wall head-on at full speed and you're out. Every circuit has a pit lane: tick **PIT**, stop in your box, and the crew patches you up in 1.5 to 8 seconds.

## 📱 Made for Phones
New menus for phones held upright: one screen per mode, a garage comparing all 35 cars, settings in sheets, a big **ON TRACK!** button.

## 📲 Install It, Play Offline
Install GRIP like an app, and download the whole game (about 150 MB) to race without a connection.

## 🔧 And Also
- A radar points to your nearest rivals when they're out of view
- Tune your braking for each circuit and car
- Monaco's tunnel gets dark even by day
- Quiet menu music: “Too Cool” by Kevin MacLeod
- GRIP now runs on the Godot engine: same cars, same physics, same circuits

🎮 Play the latest version: <https://grip-game.github.io/>
Tell me how your first championship went!

https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/1-championnat.png
https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/2-degats.png
```

---

## Version française (pour relecture, ou pour un billet en français)

**GRIP Devlog #5 — Championnats, dégâts et arrêts au stand, jeu hors ligne**

Une grosse mise à jour de GRIP est en ligne !

Celle-ci change beaucoup de choses : on peut maintenant courir de vrais championnats, les voitures
s'abîment et s'arrêtent au stand pour réparer, les menus ont été refaits pour le téléphone, et le jeu
s'installe sur le téléphone et se joue hors ligne. Et sous le capot, GRIP tourne maintenant sur un nouveau
moteur.

🏆 **Les championnats**

Compose ta saison : **jusqu'à dix courses** sur les circuits de ton choix, avec essais et qualifications.
La catégorie de ta voiture fait le barème (F1, GT Sprint ou Le Mans). Après chaque course, le classement
montre qui a gagné ou perdu des places, et la dernière course se termine sur le podium. À égalité de
points, le pilote qui a le plus de victoires passe devant.

En ligne, l'hôte peut lancer un championnat pour toute la table, en course ou en contre-la-montre. En
contre-la-montre, chaque manche est une séance de qualifications : ton meilleur tour fait les points.

💥 **Dégâts et arrêts au stand**

Les contacts laissent maintenant des traces. Les pare-chocs sont durs, les flancs mous, et une voiture
abîmée perd jusqu'à **35 % de sa vitesse de pointe et de son accélération**, jamais son adhérence.
Étincelles, débris et fumée suivent, et si tu tapes un mur de face à pleine vitesse, ta course est
finie.

Chaque circuit a sa voie des stands. Coche **STAND** sous le levier, arrête-toi dans ton box et ton
équipe accourt : du scotch sur le nez, des roues neuves, et tu repars au bout de 1,5 à 8 secondes, selon
les dégâts. L'IA s'arrête aussi quand elle est bien touchée. Les dégâts sont une option du paddock,
activée par défaut.

📱 **Fait pour le téléphone**

Tiens ton téléphone debout : les menus sont tout neufs. Un écran par mode, ton circuit et ta voiture
d'un coup d'œil, un garage qui compare les 35 voitures sur la même échelle, des réglages dans des
feuilles qu'on écarte d'un geste, et un gros bouton **EN PISTE !** sous le pouce.

📲 **L'installer, jouer hors ligne**

Sur grip-game.github.io, GRIP s'installe comme une application : « Installer le jeu », dans le menu,
montre comment, pas à pas, sur iPhone et sur Android. Il s'ouvre alors en plein écran, sans la barre du
navigateur.

Tu peux aussi **télécharger tout le jeu**, avec ses 14 circuits (environ 150 Mo), et courir sans réseau.
L'écran-titre le propose, et les réglages permettent de le supprimer.

🛠️ **Un nouveau moteur**

GRIP tourne maintenant sur le moteur Godot. Les voitures, la physique et les circuits sont les mêmes :
la même course, rejouée dans les deux versions, finit identique, tour pour tour.

🔧 **Et aussi**

- Un radar au bord de l'écran montre tes plus proches rivales quand elles sont hors de vue.
- Règle ton freinage pour chaque circuit et chaque voiture, avec des tours d'essai pour trouver ton point de freinage.
- Dans le tunnel de Monaco, il fait sombre même de jour : les phares s'allument, et le jour revient à la sortie.
- La nuit est un peu moins noire : le décor se devine, teinté de bleu.
- Une musique dans les menus, très bas : « Too Cool » de Kevin MacLeod.
- Le moteur démarre quand tu appuies sur EN PISTE !, et les menus cliquent sous le doigt.
- Au clavier, la touche ESPACE s'allume au départ.

🚦 **Et ensuite ?**

Je continue d'affiner les voitures, les circuits et la conduite. Racontez-moi votre premier championnat,
et combien d'arrêts au stand Monaco vous a coûté !

Joue à la dernière version ici : https://grip-game.github.io/

Retours, idées et signalements de bugs sont toujours les bienvenus !

**RENDEZ-VOUS SUR LA PISTE !**
