# Snoo Sequencer

Séquenceur façon Roland TR et sampler inspiré du Boss Dr. Sample, pour Windows.

## Feuille de route

1. **Base de l'application** : fenêtre Windows, tempo, play/stop, moteur audio, installateur `.exe` ✅
2. **Séquenceur TR** : grille 16 pas × 8 pistes, kit de batterie synthétisé façon 808, 8 patterns sauvegardés ✅
3. **Sampler** : banque de sons perso, un sample sur n'importe quelle piste, réglages début/fin et hauteur ✅
4. **Banques gratuites** : recherche, écoute et ajout de sons Freesound.org dans l'appli ✅

## Installer l'application (sans rien programmer)

1. Ouvre l'onglet **Actions** du dépôt sur GitHub.
2. Clique sur la dernière exécution réussie de **Build Windows**.
3. En bas de la page, télécharge **snoo-sequencer-windows**, dézippe-le et lance le `.exe`.

Windows peut afficher « Windows a protégé votre ordinateur » car l'application n'est pas signée :
clique sur **Informations complémentaires** puis **Exécuter quand même**.

## Lancer depuis le code

Il faut [Node.js](https://nodejs.org) (version 22 ou plus) :

```
npm install
npm start
```

## Raccourcis

- **Barre d'espace** : lecture / stop
- **Touches 1 à 8** : changer de pattern

## Utiliser tes propres sons

- **Importer** : bouton « + Importer » de « Ma banque », ou glisse tes fichiers (WAV, MP3, OGG, FLAC, AIFF, M4A) sur la banque.
- **Mettre un son sur une piste** : sélectionne la piste (clic sur son nom) puis clique sur un son de la banque. Tu peux aussi glisser un son de la banque, ou directement un fichier, sur la piste.
- **Régler** : le panneau Sampler montre la forme d'onde ; règle le début, la fin et la hauteur (±12 demi-tons). « Remettre le son 808 » rend à la piste son son d'origine.

## Chercher des sons gratuits sur Freesound

1. Crée un compte gratuit sur [freesound.org](https://freesound.org/home/register/).
2. Demande ta clé sur [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply), puis copie la valeur « Client secret/Api key ».
3. Dans l'appli, clique sur **FREESOUND** (panneau « Ma banque ») et colle ta clé. Elle reste sur ton PC, chiffrée par Windows.
4. Cherche un son (en anglais, c'est mieux : *kick*, *snare*, *vinyl*…), écoute-le avec ▶, puis **+ BANQUE** ou **+ PISTE** (sur la piste sélectionnée).

Licences : **CC0** = libre pour tout usage. **CC BY** = cite l'auteur si tu publies ta musique. **CC BY-NC** = cite l'auteur et pas d'usage commercial.
L'auteur et la licence de chaque son téléchargé sont notés dans `samples\CREDITS.txt`.
L'appli télécharge l'aperçu MP3 haute qualité de Freesound (le fichier original demande une connexion plus complexe).

## Où sont rangées tes données

Dans `%APPDATA%\Snoo Sequencer` :
- `patterns.json` : patterns, tempo et réglages des pistes
- `samples\` : copie des sons importés (l'original peut être déplacé ou supprimé sans souci)
