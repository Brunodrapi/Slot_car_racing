# Statistiques du jeu

Page : [`analytics.html`](../../analytics.html), sur le même site que le jeu.
Accès **public sans connexion**, également proposé dans les réglages du jeu.
Seuls des agrégats sont publiés : aucune identité, aucun identifiant technique de visiteur/session/
course, aucun journal de parties ni temps individuel. Les événements bruts restent protégés en base.

## Ce qui est prêt, ce qui doit être activé

La page, les graphiques, la collecte dans le jeu et la migration SQL sont intégrés à la branche
hybrid. **L’accès de gestion Supabase n’était pas disponible dans l’environnement de développement :
la migration n’y a pas été exécutée sur le projet en ligne.** Tant qu’elle n’est pas installée,
aucune nouvelle statistique ne peut être enregistrée sur le serveur. Le jeu continue normalement.

Activation par le propriétaire, sans nouveau service payant :

1. Ouvrir le [SQL Editor du projet](https://supabase.com/dashboard/project/fyaifqvghkvrydcldiup/sql/new),
   puis exécuter [`supabase/analytics.sql`](../../supabase/analytics.sql). Il ne supprime pas les records.
   Si l’ancienne version privée a été installée, rejouer ce même fichier pour ouvrir le rapport public
   et supprimer le détail individuel de sa réponse. Les anciennes mesures sont conservées.
2. Ouvrir `analytics.html` sur le site du jeu : aucun compte Google ni ajout d’adresse e-mail nécessaire.
3. Recharger le jeu après l’installation pour lancer la collecte et envoyer les éventuels
   événements encore conservés dans ce navigateur.

Alternative automatisée : définir uniquement `SUPABASE_ACCESS_TOKEN` dans les variables de
l’environnement cloud, puis lancer `node tools/deploie-analytics.js`. Le script installe la migration
publique dans une transaction. Ce jeton sert à **installer la base**, jamais à consulter les statistiques.
Aucune clé privée ne va dans les fichiers du jeu. `SUPABASE_PROJECT_REF` permet de viser un autre projet.

## Choix libre et hébergement

Dépôts et licences vérifiés le 17 octobre 2026 :

| Projet | Licence | Usage et contrainte |
| --- | --- | --- |
| [Umami](https://github.com/umami-software/umami) | [MIT](https://github.com/umami-software/umami/blob/master/LICENSE) | Plateforme complète, application Next.js et base à exploiter en plus du jeu. Événements personnalisés possibles. |
| [Ackee](https://github.com/electerious/Ackee) | [MIT](https://github.com/electerious/Ackee/blob/master/LICENSE) | Serveur Node et base MongoDB à héberger. Événements personnalisés possibles. |
| [Apache ECharts](https://github.com/apache/echarts) | [Apache 2.0](../../vendor/echarts/LICENSE) | Bibliothèque de graphiques copiée localement ; fonctionne dans une page statique. |

Choix retenu : **ECharts 6.0.0 + Supabase existant**, avec une page et des mesures adaptées au jeu.
Seule la bibliothèque ECharts a été copiée ; aucun code d’Umami ou d’Ackee n’est repris. Cela garde
l’hébergement statique actuel et évite un deuxième serveur. Le dépôt, la licence, le NOTICE et la
somme du fichier copié sont conservés dans [`vendor/echarts`](../../vendor/echarts/README.md).

## Indicateurs et définitions

- **Visiteurs uniques estimés** : identifiant UUID aléatoire conservé dans le navigateur.
  Ce ne sont pas des comptes Google. Deux appareils ou un stockage effacé peuvent compter deux
  fois la même personne ; aucune empreinte du navigateur ne tente de les rapprocher.
- **Visites** : sessions de navigation contenant une activité dans la période. L’identifiant est
  renouvelé après 30 minutes d’inactivité, à la reprise du jeu ou au prochain départ.
- **Départs** : passage réel au feu vert. Quitter pendant le chargement/décompte ne compte pas.
  Chaque humain compte son propre départ en multijoueur. Les IA sont exclues.
- **Tours** : tous les tours du pilote humain, propres ou avec une sortie, records ou non.
  Un même tour est dédupliqué par course + numéro, y compris lors d’une reprise réseau.
- **Temps de jeu** : temps actif en piste, émis par tranches de 30 s et à la fin ; exclut pause,
  chargement, onglet masqué et écrans de menu/résultats. La dernière tranche peut être perdue
  si le navigateur est arrêté brutalement.
- **Courses terminées / abandons** : arrivée du joueur / départ explicite avant l’arrivée.
  La fin volontaire d’un contre-la-montre est une fin de session, pas un abandon. Une session dont
  la fermeture n’a jamais été reçue ne doit pas être classée artificiellement en abandon.
- **Sorties de piste** : compteur des fautes du pilote. Les touches latérales qui n’ajoutent pas
  de faute ne sont pas assimilées à une sortie.
- **Tours propres** : absence de sortie de piste. Les invités multijoueurs transmettent le compte
  des tours par les instantanés ; le détail exact des temps et de la propreté n’y est pas toujours
  disponible. Ces tours sont comptés, avec temps/propreté inconnus, exclus du taux de propreté. Les temps individuels ne sont pas renvoyés par le rapport public.
- **Classements** : circuits, voitures et livrées, triés par départs puis tours ; temps et visiteurs
  associés. Répartition des départs par support, commande choisie au départ, mode et catégorie.
- **Nouveaux / déjà venus** : première activité connue du navigateur avant ou pendant la période.
  Ce n’est pas une mesure de rétention J+1/J+7. Après purge d’historique, la définition porte sur les
  événements encore conservés.

Dates, activité quotidienne et grille horaire sont en **UTC**. La comparaison porte sur la période
précédente de même durée. Un filtre voiture/circuit restreint tous les indicateurs, y compris
l’audience, aux événements de cette sélection ; les visites sans partie correspondante sont exclues.
Les statistiques commencent après installation : les anciens records ne permettent pas de
reconstituer le nombre historique de tours ou de joueurs.

## Collecte et fonctionnement hors ligne

`js/analytics.js` est indépendant de la sauvegarde et des records. Aucun pseudo, compte, e-mail,
URL de page, contenu de saisie ou adresse IP n’est envoyé dans ses événements. Les journaux
techniques ordinaires de l’hébergeur restent soumis à la configuration de Supabase.

La file conserve au maximum 200 événements dans le navigateur. Envoi par lots de 25, toutes les
15 s et à la sortie. Reprise après panne avec les mêmes identifiants pour éviter les doublons.
Le serveur ignore les événements de plus de sept jours et de plus de cinq minutes dans le futur.
Horloge mal réglée, blocage réseau ou stockage refusé peuvent donc réduire les chiffres.
Les essais sur `localhost` et l’ouverture en `file:` sont exclus automatiquement.

Le serveur borne les tailles, types, durées et numéros ; limite chaque visiteur à 120 événements
par minute ; utilise des index uniques pour les visites, départs, fins et tours. Ce sont des mesures
d’usage déclarées par le navigateur, pas une preuve de performance ou un système anti-triche.
Il reste possible de falsifier des événements anonymes. Aucun score mondial ne dépend de cette collecte.

Conservation conseillée : **13 mois**. À programmer mensuellement dans Supabase Cron si souhaité :

```sql
delete from public.analytics_events where at < now() - interval '13 months';
```

La page ne lit aucune session Google et utilise uniquement la clé publiable du jeu. La fonction
`analytics_report` est ouverte aux rôles `anon` et `authenticated` et renvoie les mêmes statistiques
globales. Elle ne renvoie ni UUID, ni pseudo, ni e-mail, ni adresse IP, ni événement individuel,
ni temps de tour individuel. Les dates de début/fin de collecte sont publiées au jour près.
Les droits directs de lecture/écriture des événements sont retirés aux deux rôles ; RLS est actif.
L’ancienne table `analytics_admins`, si elle existe, n’est plus utilisée : aucune liste de comptes
n’intervient dans l’accès à la page.

## Vérifications et aperçus

```bash
npm install --prefix /tmp/slot-analytics-test --cache /tmp/slot-npm-cache @electric-sql/pglite
NODE_PATH=/tmp/slot-analytics-test/node_modules node tools/analytics-test.js
node tools/e2e-analytics.js docs/analytics
```

Le premier test exécute la vraie migration sur PostgreSQL embarqué : rejouabilité, agrégations,
périodes, filtres, tours invités inconnus, déduplication, quota, données invalides, lecture anonyme des agrégats et accès refusé aux événements bruts.
Le second vérifie la page dans Chromium et le vrai collecteur chargé par le jeu : accès sans compte,
absence de données individuelles, graphiques, CSV, panne et mobile ; comptage des tours, pauses et reprise réseau.

Les captures ci-dessous utilisent **uniquement les données du test PostgreSQL**, sans rapport avec
la fréquentation réelle. Une mention visible le rappelle dans l’image.

- [Aperçu bureau](analytics-bureau-test.png)
- [Aperçu téléphone](analytics-mobile-test.png)
