# Snoo Sequencer

Séquenceur façon Roland TR et sampler inspiré du Boss Dr. Sample, pour Windows.

## Feuille de route

1. **Base de l'application** : fenêtre Windows, tempo, play/stop, moteur audio, installateur `.exe` ✅
2. **Séquenceur TR** : grille 16 pas × 8 pistes, kit de batterie synthétisé façon 808, 8 patterns sauvegardés ✅
3. **Sampler** : charger ses propres sons, réglages début/fin, hauteur, volume, banque perso
4. **Banques gratuites** : recherche et téléchargement depuis Freesound.org

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

Les patterns sont sauvegardés automatiquement dans `%APPDATA%\Snoo Sequencer\patterns.json`.
