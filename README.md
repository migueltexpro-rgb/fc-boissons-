# FC Boissons

Application web pour organiser les matchs du groupe :

- **Joueurs** : ajouter les joueurs, leur donner une note de 1 à 10, cocher les présents.
- **Match** : tirage d'équipes équilibrées (2 à 4 équipes), puis sélection du vainqueur à la fin du match.
- **Classement** : classement MVP (victoire 3 points, nul 1 point) et historique des matchs.

Aucune installation ni compilation : ce sont des fichiers statiques. Les données sont gardées dans le navigateur de l'appareil (`localStorage`).

## Lancer en local

```
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Mettre en ligne

Sur GitHub : Settings → Pages → « Deploy from a branch », choisir la branche et le dossier `/ (root)`. Une fois en ligne (HTTPS), l'appli peut être ajoutée à l'écran d'accueil du téléphone et fonctionne hors connexion.
