# F40 LM, 24 vues — en attente d'un ordre de rotation

Ces vues ne sont pas encore utilisées par le jeu. Le modèle `f40` pointe toujours sur
`sprites/f40lm`, qui contient huit vues à 45° dont l'ordre est vérifié.

Le moteur attend une planche **régulière** : N vues réparties uniformément sur 360°, dans un sens
constant, `sheetRear` désignant celle où la voiture s'éloigne exactement de la caméra. Ces 24 vues ne
suivent pas cette règle. Mesuré sur les pixels de feux :

- 14 vues montrent les phares (`v0`–`v5`, `v16`–`v23`), 10 montrent les feux arrière (`v6`–`v15`).
  Un balayage régulier donnerait 12 et 12.
- Aucune vue n'est exactement de dos : le rapport largeur/hauteur des vues arrière reste entre 1,26
  et 1,42, alors qu'une vue de dos serait la plus étroite, comme `v23` à 0,78 de face.
- Les passages `v5`→`v6` et `v15`→`v16` sautent de l'avant à l'arrière sans profil entre les deux.

Il manque donc l'angle de chaque vue. Deux façons de débloquer : donner l'angle de lacet de chaque
tuile, ou réexporter un balayage uniforme de 24 vues tous les 15° dans un sens constant.
