# Karmageddon

Le jeu se joue de bout en bout, avec une présentation minimale. On commence sur l’écran d’accueil et le bouton **Naître**, qui affiche la fiche de naissance. **Vivre cette vie** lance la partie : une carte par année, avec un choix et son issue, jusqu’à 85 ans. Les tirages démographiques restent dans [Stochia](https://github.com/stochia). Ce dépôt les demande et les présente ; les cartes se tirent dans le filtre. Voir [Cartes](#cartes) et [Partie](#partie).

Ce fichier dit comment lancer, configurer et vérifier le projet, et ce que le filtre envoie au jeu. Le jeu lui-même (ses règles, les paramètres d’une vie, le format des cartes, le langage de script, les types, le réglage) est décrit dans [docs/game-design.md](docs/game-design.md), et nulle part ailleurs. Ce document décrit le jeu visé et dit ce qui est déjà construit. Les étapes pour construire le reste sont dans [docs/plan.md](docs/plan.md).

```text
apps/game            SvelteKit, Vite, Tauri 2
apps/bff             Filtre HTTP : une vie Stochia devient une fiche de naissance, puis une partie
apps/bff/cards       Les cartes : types.json et un fichier par carte dans cartes/
packages/contract    Forme partagée de la fiche et de la partie
packages/engine      Moteur du jeu : état de vie, scripts des cartes, tirages
docs/game-design.md  Le game design : le jeu visé, et ce qui en est construit
docs/plan.md         Le plan d’action, par phases
```

Le navigateur n’appelle pas Stochia. Il appelle le filtre, qui retire la mort, la carrière, l’héritage, le patrimoine personnel des années suivantes, les cadets et les événements futurs. La fiche montre le foyer tel qu’il est à la naissance : père, mère, l’enfant et les aînés déjà nés, avec leur QI, le patrimoine de ce foyer et le salaire mensuel de chaque parent. Le QI de l’enfant reste dans l’en-tête pendant la partie. Le logement du foyer à la naissance vient de Stochia (maison, appartement, concession, habitat mobile, entre autres) et s’affiche avec son pictogramme dans l’encart des membres de la famille. Un Stochia qui n’envoie pas encore ce champ laisse l’emplacement vide : rien n’est inventé. Le patrimoine du foyer donne le montant et une comparaison en clair (par exemple « 40 % des foyers du pays ont moins »). Le métier d’un parent est au singulier. Ces montants sont en monnaie du pays de naissance : le filtre convertit les dollars internationaux de 2021 avec le facteur de pouvoir d’achat (le même que Stochia, Banque mondiale, CC BY 4.0), jamais avec un taux de change. Le jeu envoie le pays de la langue du navigateur, et le même montant est répété entre parenthèses dans cette monnaie quand elle diffère. Sans facteur publié, le rang reste et le montant ne sort pas. Le patrimoine affiché pendant la partie est une unité de jeu, distincte de celui du foyer. Le pays est précédé du même drapeau que dans Stochia (dessins [flag-icons](https://github.com/lipis/flag-icons), licence MIT, copiés dans `apps/game/static/flags`). Pendant la partie, il est sur la carte du foyer. Sous les badges de lieu, une petite carte du monde (mêmes continents et couleurs que Stochia, tracé Natural Earth du domaine public) marque le point de naissance.

### Richesse du pays

À chaque naissance, le filtre demande aussi à Stochia le PIB par habitant du pays de naissance (`GET /api/economy`, en dollars internationaux constants de 2021). Il ne garde qu’un niveau : faible sous 6 000, élevé à partir de 35 000, intermédiaire entre les deux (`INCOME_LOW_BELOW` et `INCOME_HIGH_FROM` dans `apps/bff/src/economy.ts`). La fiche le donne dans `context.countryIncome` (`low`, `middle`, `high`) ; le montant en dollars ne sort pas du filtre.

L’année de naissance n’est souvent pas encore projetée : Stochia répond alors `503`, et le filtre prend la dernière année observée du pays (une requête sur 1990 pour la connaître, puis une sur cette année-là). C’est au plus trois requêtes par pays, retenues en mémoire pour les naissances suivantes. Ce sont des chiffres nationaux, pas une naissance tirée au hasard. Toute erreur (pays absent, délai dépassé après 5 secondes, `429`, réponse invalide) laisse la naissance valide avec un niveau inconnu, `null` ; rien n’est deviné. Après un `429`, le filtre ne redemande rien à `/api/economy` avant la fin de `Retry-After`.

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

## Cartes

Une carte est un fichier JSON, versionné avec le code : `apps/bff/cards/cartes/<slug>.json`. Le nom du fichier est le slug de la carte. Les types sont dans `apps/bff/cards/types.json`. Il n’y a pas de base de données.

Le filtre lit ces fichiers et les charge dans un magasin en mémoire (`MemoryCardStore`), où les cartes se listent, s’ajoutent et se remplacent. Modifier ce magasin n’écrit pas les fichiers. Le moteur (`packages/engine`) valide chaque carte, compile ses scripts, puis la tire et la résout. Tout cela ne tourne que dans le filtre : ni les fichiers, ni les scripts, ni les issues non tirées ne vont au jeu.

Une carte invalide n’est jamais tirée ni réparée : elle est écartée et journalisée, avec le nom de son fichier, le champ et la raison.

Le format d’une carte, le langage de script, les types et la façon d’écrire une carte sont décrits dans [docs/game-design.md](docs/game-design.md), section 9. Les paramètres d’une vie sont en section 3, le karma en section 5, et le jeu de cartes du dépôt en annexe.

### Ajouter ou modifier une carte

Créer ou modifier un fichier dans `apps/bff/cards/cartes/`, puis :

```bash
npm run cards:validate
npm run cards:simulate
```

`cards:validate` compile toutes les cartes, inactives comprises, et liste chaque fichier à corriger. `npm test` fait la même vérification.

`cards:simulate` déroule une vie avec le jeu du dépôt : une carte par an de 1 à 85 ans, une option prise au hasard, depuis la naissance de `apps/bff/fixtures/life.json`. Il affiche chaque année, l’état final et la commande pour rejouer la même graine : `npm run cards:simulate -- <graine>`, `--sensibles` pour inclure les cartes sensibles, `--saint` ou `--egoiste` pour prendre toujours l’option qui fait le plus ou le moins pour le karma, `--revenu faible|intermediaire|eleve|inconnu` pour la richesse du pays (intermédiaire par défaut, puisque l’outil ne demande rien à Stochia). C’est un outil de réglage, pas une règle du jeu : 85 ans est une borne de l’outil, pas une mort, et il n’appelle pas Stochia.

`npm test` simule aussi plusieurs centaines de vies sur le jeu du dépôt. Ce qu’il vérifie sur l’équilibre des cartes est listé dans [docs/game-design.md](docs/game-design.md), section 11.

## Partie

La naissance crée aussi une partie dans le filtre. Elle part de la fiche filtrée et reçoit sa propre graine, qui ne sort pas du filtre. Le jeu la fait avancer par ces appels :

| Route | Réponse |
| --- | --- |
| `POST /api/births` | `{ lifeId, birth }` : la fiche de naissance et l’identifiant de la partie |
| `POST /api/lives/:id/next` | La carte de l’année suivante, ou la fin de la partie |
| `POST /api/lives/:id/choice` avec `{ "choice": "<id>" }` | Le texte de l’issue tirée et l’état d’après. Un dé, s’il y en a un |
| `POST /api/lives/:id/reroll` | Le même choix, relancé une fois. Le premier résultat est oublié |

Les années sans carte tirable passent sans s’afficher. Redemander `next` avant d’avoir répondu renvoie la même carte, et un second `choice` sur la même carte est refusé : un double clic ou une réponse perdue ne fait pas jouer deux fois. Une carte qui échoue à la résolution est mise de côté et journalisée, puis la partie continue. Les cartes sensibles ne sont pas tirées.

Le jeu reçoit seulement une liste fixe de champs :
- l’âge, les jauges (karma et éducation compris), le patrimoine, la scolarité, l’emploi, le couple, les enfants et les petits-enfants ;
- le titre et le type de la carte, avec l’identifiant et le libellé de chaque option ;
- après un choix, le texte de l’issue tirée ;
- si l’option a un dé : sa face, les modificateurs (libellé et entier), le total, le seuil, et le prix d’une relance tant qu’elle est possible.

Rien ne sort sur les conditions, les poids, les impacts, les formules, les issues non tirées, les marques, l’historique ou la graine.

La partie s’arrête à 85 ans. C’est une borne du jeu, pas une mort : la date de décès simulée reste dans Stochia, et le filtre ne la garde pas.

Les parties vivent en mémoire, sans base de données ni sauvegarde. Le filtre oublie une partie après deux heures sans action, et garde au plus 5 000 parties : au-delà, la plus ancienne part. Un redémarrage les oublie toutes, et le jeu propose alors de renaître.

## Vérifier

```bash
npm test
npm run check
npm run build
npm run cards:validate
npm run cards:simulate
```

## Limites

Ce qui manque encore au jeu (la mort, le revenu, le logement, le climat, un deck réglé) se lit dans [docs/game-design.md](docs/game-design.md), colonne « Construit », et se construit selon [docs/plan.md](docs/plan.md). Les limites ci-dessous sont techniques :

- La présentation de la partie est minimale : un état, une carte, ses choix et son issue. Il n’y a pas d’éditeur de cartes.
- Les parties sont dans la mémoire d’un seul filtre : plusieurs instances hébergées derrière un répartiteur ne les partageraient pas.
- Les cartes changent avec le code : en modifier une demande de redémarrer le filtre, et de le redéployer une fois qu’il sera hébergé.
- Le filtre appelle Stochia depuis une seule adresse. Le service public limite `/api` à 60 requêtes par minute pour cette adresse, tous joueurs confondus. La richesse du pays ajoute jusqu’à trois requêtes la première fois qu’un pays apparaît, puis aucune tant que le filtre tourne.
- Ni le jeu ni le filtre ne sont déployés.
- Android, iOS et les installeurs signés ne sont pas faits. Une application Tauri de production a besoin d’un filtre hébergé et de `VITE_BFF_URL` au moment de la compilation.
- Pas de compte, de sauvegarde, d’inventaire ni de progression. La date de décès simulée n’est jamais envoyée au jeu.
