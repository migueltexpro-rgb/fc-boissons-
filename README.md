# FC Boissons

Application web pour organiser les matchs du groupe :

- **Joueurs** : ajouter les joueurs, leur donner une note de 1 à 10, cocher les présents.
- **Match** : tirage d'équipes équilibrées (2 à 4 équipes), puis sélection du vainqueur à la fin du match. À 2 équipes, vote pour les 3 MVP ; à 3 ou 4 équipes, toute l'équipe gagnante est MVP.
- **Classement** : classement MVP (nombre de fois MVP, puis victoires) et historique des matchs.

Aucune compilation : ce sont des fichiers statiques.

## Données partagées (Firebase)

Les joueurs, matchs et points sont stockés dans Firestore (projet `fcboissons`, voir `firebase-config.js`) et partagés en direct entre les personnes connectées avec un compte Google autorisé.

Réglages à faire une fois dans la console Firebase :

1. **Authentication → Sign-in method** : activer Google.
2. **Authentication → Settings → Authorized domains** : ajouter le domaine du site (par exemple `<compte>.github.io`).
3. **Firestore Database → Rules** : coller le contenu de `firestore.rules` en y mettant les adresses e-mail autorisées, puis publier.

Sans `firebase-config.js`, l'appli fonctionne en local : les données restent dans le navigateur de l'appareil.

## Lancer en local

```
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000 (`localhost` est déjà un domaine autorisé par Firebase).

## Mettre en ligne

Sur GitHub : Settings → Pages → « Deploy from a branch », choisir la branche et le dossier `/ (root)`. Une fois en ligne (HTTPS), l'appli peut être ajoutée à l'écran d'accueil du téléphone.
