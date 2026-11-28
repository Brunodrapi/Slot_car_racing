# GRIP Devlog #5 — The Fender Bender MEGA Update

**Le nom** : « The Fender Bender MEGA Update » (un *fender bender*, c'est l'accrochage où la tôle se froisse).
« Wreck Fest » aurait renvoyé à *Wreckfest*, un jeu de course connu (Bugbear, THQ Nordic) : on garde un nom à
nous. Autres possibilités, au choix : « The Damage MEGA Update », « The Bent Metal MEGA Update ».

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

- `0-couverture.png` (696 × 512, image de couverture du billet) : une course cabossée, et le nom de la mise à jour
- `1-degats.png` : la tôle et les débris après un choc, puis l'écran DNF
- `2-stand.png` : un arrêt au stand, l'équipe autour de la voiture
- `3-championnat.png` : un championnat au téléphone (départ et calendrier, classement, arrivée finale, podium)
- `4-pc.png` : les écrans du PC (la préparation de course sur un seul écran, le programme du championnat)
- `5-telephone.png` : les menus du téléphone (menu, course rapide, garage)
- `6-hors-ligne.png` : le téléchargement pour jouer hors ligne, et l'écran « Install game »

---

**GRIP Devlog #5 — The Fender Bender MEGA Update**

Welcome to **THE FENDER BENDER MEGA UPDATE**, the biggest GRIP update yet!

Cars now crumple, smoke and limp to the pits. You can race full championships. The screens have been redesigned, on computers and on phones. And under the hood, GRIP has changed technology: it now runs on a real game engine.

💥 **Bent Metal and Pit Stops**
Contact now leaves its mark. Bumpers are tough, flanks are soft, and a damaged car loses up to **35% of its top speed and acceleration**, never its grip. Sparks fly, debris stays on the track, smoke pours out, and if you hit a wall head-on at full speed, it's a **DNF**.

*[image : 1-degats.png — Damaged cars and debris on the track, then the DNF screen]*

Every circuit now has a pit lane. Tick **PIT** under the lever, stop in your box, and your crew rushes out: tape on the nose, new wheels, and you're back out after 1.5 to 8 seconds, depending on the damage. The AI pits too when it's badly hurt. Damage is an option in the race setup, on by default.

*[image : 2-stand.png — A pit stop: the crew around the car in its box]*

🏆 **Championships**
Build your own season: **up to ten races** on the circuits of your choice, with practice and qualifying sessions. Your car's class sets the scoring (F1, GT Sprint or Le Mans points). After every race, the standings show who gained and who lost places, and the last race ends on the podium. On equal points, the driver with the most wins goes first.

*[image : 3-championnat.png — A championship on a phone: the calendar, the standings, the final race and the podium]*

Online, the host can run a championship for the whole table, in race or in time-trial format. In time trial, every round is a qualifying session: your best lap scores the points.

⚙️ **A New Technology Under the Hood**
GRIP started as a web page: JavaScript code drawing every frame itself in the browser. It has now moved to **Godot**, an open-source game engine. What you play in your browser is that engine, built for the web.

What it changes:

- The scenery is drawn by your graphics card, and the car physics runs as compiled C++.
- The game installs like an app and plays offline (more below).
- The same game can now become a real app for computers and phones.
What doesn't change: the cars, the physics and the circuits. I rebuilt them line by line and checked it: the same race, replayed in the old version and in the new one, ends lap for lap identical. Online lobbies work as before.

🖥️ **New Screens on Computer**
The race setup now fits on **one screen**: the circuit, big, with its facts (length, corners, longest straight, top speed) and the lap times of every class, your record next to the world record; below, the tracks, the cars of each class with their five stat bars, and the race options: difficulty, opponents, damage and braking.

**Championship** opens the season planner: the calendar, the laps of each race, the practice and qualifying sessions, the starting grid. Settings are laid out in two columns, with the keyboard controls at the top, and the title screen now shows the latest devlog.

*[image : 4-pc.png — The new race setup on a computer, and the championship planner]*

📱 **New Screens on Phone**
Hold your phone upright and everything is new, made for one thumb: five modes in the menu, Championship included; one screen per mode, with your circuit and your car at a glance; the circuits, the garage (all 35 cars compared on the same scale), the difficulty and the settings in sheets you swipe away; and a big **ON TRACK!** button at the bottom. In time trial, signing in for the world board is one tap away. Turn your phone sideways and you get the computer screens.

*[image : 5-telephone.png — The new phone menus: main menu, quick race and garage]*

📲 **Install It, Play Offline**
On grip-game.github.io, GRIP installs like an app: **Install game** in the menu shows how, step by step, on iPhone and on Android. It then opens full screen, without the browser bar.

You can also **download the whole game**, all 14 circuits included (about 150 MB), and race without a connection. The title screen offers it, and Settings let you delete it.

*[image : 6-hors-ligne.png — Downloading the game for offline play, and the install guide]*

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
<p>Welcome to <strong>THE FENDER BENDER MEGA UPDATE</strong>, the biggest GRIP update yet!</p>
<p>Cars now crumple, smoke and limp to the pits. You can race full championships. The screens have been redesigned, on computers and on phones. And under the hood, GRIP has changed technology: it now runs on a real game engine.</p>

<h2>💥 Bent Metal and Pit Stops</h2>
<p>Contact now leaves its mark. Bumpers are tough, flanks are soft, and a damaged car loses up to <strong>35% of its top speed and acceleration</strong>, never its grip. Sparks fly, debris stays on the track, smoke pours out, and if you hit a wall head-on at full speed, it's a <strong>DNF</strong>.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/1-degats.png" alt="Damaged cars and debris on the track, then the DNF screen"></p>
<p>Every circuit now has a pit lane. Tick <strong>PIT</strong> under the lever, stop in your box, and your crew rushes out: tape on the nose, new wheels, and you're back out after 1.5 to 8 seconds, depending on the damage. The AI pits too when it's badly hurt. Damage is an option in the race setup, on by default.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/2-stand.png" alt="A pit stop: the crew around the car in its box"></p>

<h2>🏆 Championships</h2>
<p>Build your own season: <strong>up to ten races</strong> on the circuits of your choice, with practice and qualifying sessions. Your car's class sets the scoring (F1, GT Sprint or Le Mans points). After every race, the standings show who gained and who lost places, and the last race ends on the podium. On equal points, the driver with the most wins goes first.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/3-championnat.png" alt="A championship on a phone: the calendar, the standings, the final race and the podium"></p>
<p>Online, the host can run a championship for the whole table, in race or in time-trial format. In time trial, every round is a qualifying session: your best lap scores the points.</p>

<h2>⚙️ A New Technology Under the Hood</h2>
<p>GRIP started as a web page: JavaScript code drawing every frame itself in the browser. It has now moved to <strong>Godot</strong>, an open-source game engine. What you play in your browser is that engine, built for the web.</p>
<p>What it changes:</p>
<ul>
<li>The scenery is drawn by your graphics card, and the car physics runs as compiled C++.</li>
<li>The game installs like an app and plays offline (more below).</li>
<li>The same game can now become a real app for computers and phones.</li>
</ul>
<p>What doesn't change: the cars, the physics and the circuits. I rebuilt them line by line and checked it: the same race, replayed in the old version and in the new one, ends lap for lap identical. Online lobbies work as before.</p>

<h2>🖥️ New Screens on Computer</h2>
<p>The race setup now fits on <strong>one screen</strong>: the circuit, big, with its facts (length, corners, longest straight, top speed) and the lap times of every class, your record next to the world record; below, the tracks, the cars of each class with their five stat bars, and the race options: difficulty, opponents, damage and braking.</p>
<p><strong>Championship</strong> opens the season planner: the calendar, the laps of each race, the practice and qualifying sessions, the starting grid. Settings are laid out in two columns, with the keyboard controls at the top, and the title screen now shows the latest devlog.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/4-pc.png" alt="The new race setup on a computer, and the championship planner"></p>

<h2>📱 New Screens on Phone</h2>
<p>Hold your phone upright and everything is new, made for one thumb: five modes in the menu, Championship included; one screen per mode, with your circuit and your car at a glance; the circuits, the garage (all 35 cars compared on the same scale), the difficulty and the settings in sheets you swipe away; and a big <strong>ON TRACK!</strong> button at the bottom. In time trial, signing in for the world board is one tap away. Turn your phone sideways and you get the computer screens.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/5-telephone.png" alt="The new phone menus: main menu, quick race and garage"></p>

<h2>📲 Install It, Play Offline</h2>
<p>On <a href="https://grip-game.github.io/">grip-game.github.io</a>, GRIP installs like an app: <strong>Install game</strong> in the menu shows how, step by step, on iPhone and on Android. It then opens full screen, without the browser bar.</p>
<p>You can also <strong>download the whole game</strong>, all 14 circuits included (about 150 MB), and race without a connection. The title screen offers it, and Settings let you delete it.</p>
<p><img src="https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/6-hors-ligne.png" alt="Downloading the game for offline play, and the install guide"></p>

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
# 💥 GRIP Devlog #5 — The Fender Bender MEGA Update

Welcome to THE FENDER BENDER MEGA UPDATE, the biggest GRIP update yet!

## 💥 Bent Metal and Pit Stops
Bumpers are tough, flanks are soft: a damaged car loses up to 35% of its top speed and acceleration. Hit a wall head-on at full speed and it's a **DNF**. Every circuit has a pit lane: tick **PIT**, stop in your box, and the crew patches you up in 1.5 to 8 seconds.

## 🏆 Championships
Up to **ten races** on the circuits of your choice, with practice and qualifying. Your car's class sets the scoring (F1, GT Sprint or Le Mans). Standings after every race, a podium at the end. Online, the host can run a championship for the whole table.

## ⚙️ A New Technology
GRIP has moved from a JavaScript web page to **Godot**, a real game engine: scenery drawn by your graphics card, physics in compiled C++. Same cars, same physics, same circuits — checked lap for lap.

## 🖥️ Computer & 📱 Phone
On computer, the race setup fits on one screen, with a season planner for championships. On phone, all-new menus made for one thumb, with sheets you swipe away and a big **ON TRACK!** button.

## 📲 Install It, Play Offline
Install GRIP like an app, and download the whole game (about 150 MB) to race without a connection.

🎮 Play the latest version: <https://grip-game.github.io/>
Tell me how your first championship went!

https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/0-couverture.png
https://brunodrapi.github.io/Slot_car_racing/itch/devlog-5/1-degats.png
```

---

## Version française (pour relecture, ou pour un billet en français)

**GRIP Devlog #5 — The Fender Bender MEGA Update (la MEGA mise à jour tôle froissée)**

Bienvenue dans **LA FENDER BENDER MEGA UPDATE**, la plus grosse mise à jour de GRIP à ce jour !

Les voitures se froissent, fument et se traînent jusqu'au stand. On peut courir de vrais championnats.
Les écrans ont été refaits, sur ordinateur comme sur téléphone. Et sous le capot, GRIP a changé de
technologie : il tourne maintenant sur un vrai moteur de jeu.

💥 **Tôle froissée et arrêts au stand**

Les contacts laissent maintenant des traces. Les pare-chocs sont durs, les flancs mous, et une voiture
abîmée perd jusqu'à **35 % de sa vitesse de pointe et de son accélération**, jamais son adhérence. Les
étincelles volent, les débris restent sur la piste, la fumée s'échappe, et si tu tapes un mur de face à
pleine vitesse, c'est l'**abandon**.

Chaque circuit a maintenant sa voie des stands. Coche **STAND** sous le levier, arrête-toi dans ton box
et ton équipe accourt : du scotch sur le nez, des roues neuves, et tu repars au bout de 1,5 à 8 secondes,
selon les dégâts. L'IA s'arrête aussi quand elle est bien touchée. Les dégâts sont une option de la
préparation de course, activée par défaut.

🏆 **Les championnats**

Compose ta saison : **jusqu'à dix courses** sur les circuits de ton choix, avec essais et qualifications.
La catégorie de ta voiture fait le barème (F1, GT Sprint ou Le Mans). Après chaque course, le classement
montre qui a gagné ou perdu des places, et la dernière course se termine sur le podium. À égalité de
points, le pilote qui a le plus de victoires passe devant.

En ligne, l'hôte peut lancer un championnat pour toute la table, en course ou en contre-la-montre. En
contre-la-montre, chaque manche est une séance de qualifications : ton meilleur tour fait les points.

⚙️ **Une nouvelle technologie sous le capot**

GRIP est né comme une page web : du code JavaScript qui dessinait lui-même chaque image dans le
navigateur. Il est maintenant passé à **Godot**, un moteur de jeu libre. Ce que tu joues dans ton
navigateur, c'est ce moteur, construit pour le web.

Ce que ça change :
- le décor est dessiné par ta carte graphique, et la physique des voitures tourne en C++ compilé ;
- le jeu s'installe comme une application et se joue hors ligne (voir plus bas) ;
- le même jeu peut maintenant devenir une vraie application pour ordinateur et téléphone.

Ce qui ne change pas : les voitures, la physique et les circuits. Je les ai reconstruits ligne à ligne,
et je l'ai vérifié : la même course, rejouée dans l'ancienne version et dans la nouvelle, finit identique,
tour pour tour. Les salons en ligne marchent comme avant.

🖥️ **De nouveaux écrans sur ordinateur**

La préparation de course tient maintenant sur **un seul écran** : le circuit, en grand, avec ses
caractéristiques (longueur, virages, plus longue ligne droite, vitesse de pointe) et les chronos de
chaque catégorie, ton record à côté du record du monde ; en dessous, les circuits, les voitures de chaque
catégorie avec leurs cinq barres de caractéristiques, et les options de course : difficulté, adversaires,
dégâts et freinage.

**Championnat** ouvre le programme de la saison : le calendrier, les tours de chaque course, les séances
d'essais et de qualifications, la grille de départ. Les réglages passent sur deux colonnes, avec les
commandes du clavier en haut, et l'écran-titre montre le dernier devlog.

📱 **De nouveaux écrans sur téléphone**

Tiens ton téléphone debout : tout est neuf, fait pour un seul pouce. Cinq modes au menu, Championnat
compris ; un écran par mode, avec ton circuit et ta voiture d'un coup d'œil ; les circuits, le garage
(les 35 voitures comparées sur la même échelle), la difficulté et les réglages dans des feuilles qu'on
écarte d'un geste ; et un gros bouton **EN PISTE !** en bas. En contre-la-montre, la connexion au tableau
mondial est à portée de doigt. Tourne ton téléphone et tu retrouves les écrans de l'ordinateur.

📲 **L'installer, jouer hors ligne**

Sur grip-game.github.io, GRIP s'installe comme une application : « Installer le jeu », dans le menu,
montre comment, pas à pas, sur iPhone et sur Android. Il s'ouvre alors en plein écran, sans la barre du
navigateur.

Tu peux aussi **télécharger tout le jeu**, avec ses 14 circuits (environ 150 Mo), et courir sans réseau.
L'écran-titre le propose, et les réglages permettent de le supprimer.

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
