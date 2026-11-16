# Bip de passage de tour — 0.54.3

Chaque tour bouclé par le joueur déclenche un bip bref et tenu, plus audible que l’ancien signal
très court. Un meilleur tour a une note plus aiguë. Le signal respecte le réglage Son du jeu.

- [Écouter le bip](bip-tour.wav) : rendu isolé du signal, sans le moteur.
- [Contrôles automatisés](verification.json).

`tools/e2e-lap-beep.js` vérifie de vrais franchissements de ligne avec la physique du jeu en course,
contre-la-montre et entraînement : un signal par tour terminé, y compris le dernier et les tours
invalides, aucun signal au passage initial de la grille, ni en revenant sur la ligne sans checkpoint,
ni pour les adversaires. Le traitement d’un événement déjà consommé ne rejoue pas le bip.

Le signal est également rendu dans OfflineAudioContext : note normale et note de meilleur tour,
durée, plateau audible, silence après le bip, silence si Son est désactivé ou si l’audio n’a pas
encore été démarré. L’extrait WAV contient le bip seul avant le mixage et le volume principal du jeu.
