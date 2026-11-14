# Karmageddon

Première version jouable : un écran d’accueil, le bouton **Naître**, puis une fiche de naissance. Les tirages restent dans [Stochia](https://github.com/stochia). Ce dépôt ne fait que les demander et les présenter.

```text
apps/game            SvelteKit, Vite, Tauri 2
apps/bff             Filtre HTTP : une vie Stochia devient une fiche de naissance
packages/contract    Forme partagée de cette fiche
```

Le navigateur n’appelle pas Stochia. Il appelle le filtre, qui retire la mort, la carrière, l’héritage, les cadets et les événements futurs.

## Prérequis

- Node.js 20.19 ou plus récent
- Pour l’application bureau : Rust stable, les outils MSVC, et WebView2 (déjà présent sur Windows 11)

## Lancer depuis l’éditeur

Choisir **Karmageddon (local)** dans le panneau d’exécution. La tâche compare le binaire `stochia-api` au code : elle le recompile et le relance seulement s’il est en retard ou absent. Un serveur déjà à jour est laissé en place. Le filtre parle alors à `http://127.0.0.1:5917`, et le navigateur s’ouvre sur le jeu. Arrêter la session ferme Vite et le filtre ; Stochia local continue.

## Lancer le jeu dans le navigateur

```bash
npm install
npm run dev
```

Le filtre écoute sur `http://127.0.0.1:8787`. Vite écoute sur `http://127.0.0.1:1420` et transmet `/api` au filtre. Ouvrir <http://127.0.0.1:1420>.

## Configuration

Aucune des deux n’est obligatoire pour le développement. Aucun secret n’est embarqué.

Filtre, `apps/bff/.env` :

```text
STOCHIA_API_URL=https://stochia-447164093306.europe-west1.run.app
PORT=8787
ALLOWED_ORIGINS=http://localhost:1420,http://127.0.0.1:1420
```

Sans `STOCHIA_API_URL`, le filtre utilise le service public. Un Stochia local se branche avec `http://127.0.0.1:5917`.

Jeu, `apps/game/.env` :

```text
VITE_BFF_URL=
```

Vide, le jeu appelle `/api` sur la même origine. Une adresse absolue ne sert que pour une application Tauri compilée, qui n’a pas le proxy de Vite.

## Bureau

Dans un terminal, le filtre. Dans un autre :

```bash
npm run tauri dev -w @karmageddon/game
```

Tauri relance Vite. Il ne faut donc pas laisser un `npm run dev` du jeu occuper le port 1420.

## Vérifier

```bash
npm test
npm run check
npm run build
```

## Limites

- Le filtre appelle Stochia depuis une seule adresse. Le service public limite `/api` à 60 requêtes par minute pour cette adresse, tous joueurs confondus.
- Ni le jeu ni le filtre ne sont déployés.
- Android, iOS et les installeurs signés ne sont pas faits. Une application Tauri de production a besoin d’un filtre hébergé et de `VITE_BFF_URL` au moment de la compilation.
- Les salaires ne sont pas affichés : Stochia les donne en dollars internationaux de 2021, et les convertir demande les tables de pouvoir d’achat.
- Pas de compte, de sauvegarde, d’inventaire ni de progression. La date de décès simulée n’est jamais envoyée au jeu.
