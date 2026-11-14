# Karmageddon

Le jeu se joue de bout en bout, avec une présentation minimale. On commence sur l’écran d’accueil et le bouton **Naître**, qui affiche la fiche de naissance. **Vivre cette vie** lance la partie : une carte par année, avec un choix et son issue, jusqu’à 85 ans. Les tirages démographiques restent dans [Stochia](https://github.com/stochia). Ce dépôt les demande et les présente ; les cartes se tirent dans le filtre. Voir [Cartes](#cartes) et [Partie](#partie).

```text
apps/game            SvelteKit, Vite, Tauri 2
apps/bff             Filtre HTTP : une vie Stochia devient une fiche de naissance, puis une partie
apps/bff/cards       Les cartes : types.json et un fichier par carte dans cartes/
packages/contract    Forme partagée de la fiche et de la partie
packages/engine      Moteur du jeu : état de vie, scripts des cartes, tirages
```

Le navigateur n’appelle pas Stochia. Il appelle le filtre, qui retire la mort, la carrière, l’héritage, les cadets et les événements futurs. La fiche montre le foyer tel qu’il est à la naissance : père, mère, l’enfant et les aînés déjà nés, avec leur QI, et le rang du patrimoine de ce foyer dans le pays. Le montant en dollars n’en sort pas. Sous les badges de lieu, une petite carte du monde (mêmes continents et couleurs que Stochia, tracé Natural Earth du domaine public) marque le point de naissance.

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

```json
{
  "slug": "colis-par-erreur",
  "type": "choix_mystere",
  "titre": "Un colis vous est livré par erreur. Vous l'ouvrez ?",
  "condition": "age >= 18",
  "poids": "0.5",
  "options": [
    { "id": "ouvrir", "libelle": "Vous l'ouvrez", "issues": [
      { "poids": "3", "texte": "Des chaussettes.", "impact": "moral += 1" },
      { "poids": "1", "texte": "Une liasse de billets.", "impact": "patrimoine += 500; social -= 5" }
    ] },
    { "id": "rendre", "libelle": "Vous le rapportez", "issues": [
      { "texte": "Le voisin vous remercie.", "impact": "social += 3" }
    ] }
  ]
}
```

| Champ | Rôle | Défaut |
| --- | --- | --- |
| `slug` | Identifiant, égal au nom du fichier | |
| `type` | Un type de `types.json` | |
| `condition` | La carte peut-elle être tirée pour cette vie ? | `vrai` |
| `poids` | Fréquence relative parmi les cartes tirables | `1` |
| `unique` | Jouée une seule fois par vie | `false` |
| `sensible` | Sujet dur : hors des tirages sauf demande explicite | `false` |
| `actif` | `false` garde le fichier sans jamais tirer la carte | `true` |
| `variables` | Tirages intermédiaires `{ "nom", "valeur" }`, faits dans l’ordre à la résolution | aucune |
| `options` | Les choix du joueur. Une carte subie n’en a qu’un | |
| `issues` | Les suites possibles d’une option : `condition`, `poids`, `texte`, `impact` | |
| `tirage` | Sur une option : un dé (`de`), des `modificateurs` (`libelle`, `valeur`), un `seuil`, et une `relance` facultative en karma. Le total s’appelle `jet` | aucun |

Un type est une donnée : en ajouter un, c’est ajouter `{ "slug", "libelle" }` dans `types.json`. Une carte dont le type n’existe pas est écartée.

Une carte invalide n’est jamais tirée ni réparée : elle est écartée avec le nom de son fichier, le champ et la raison. Cela vaut pour un fichier qui n’est pas du JSON, un slug différent du nom du fichier, un champ inconnu ou un script faux.

### Langage de script

`condition`, `poids`, `valeur` et `impact` sont écrits dans un petit langage propre au jeu. Ce n’est pas du JavaScript et rien n’est passé à `eval` : un nom ou une fonction hors des listes ci-dessous fait refuser la carte, avec le champ et la colonne de l’erreur.

- Valeurs : nombres, textes entre `'` ou `"`, `vrai`, `faux`.
- Opérateurs : `+ - * /`, `< <= > >=`, `== !=`, `&& || !`, `condition ? a : b`, parenthèses.
- Fonctions : `a('bac')` (la vie porte cette marque), `deja('slug')` (carte déjà jouée), `min`, `max`, `arrondi`, et pour le hasard `hasard()` (de 0 à 1) et `entier(1, 6)` (bornes comprises).
- Impact : des changements séparés par `;`. Affectations `=`, `+=`, `-=`, `*=`, `/=`, et les actions `pose('bac')` et `retire('bac')`.

Le hasard n’est permis que dans `variables` et `impact`. Une condition ou un poids se calcule sur l’état seul ; une issue se choisit sur l’état et les variables déjà tirées. Un `tirage` est l’autre source de hasard : le dé est tiré par le moteur, et ses modificateurs se lisent sur l’état, sans `hasard()` ni `entier()`.

| Nom | Type | Un impact peut le changer |
| --- | --- | --- |
| `sexe` | `'femme'` ou `'homme'` | non |
| `pays` | code du pays de naissance, `'FR'` | non |
| `milieu` | `'urbain'` ou `'rural'` | non |
| `qi` | nombre | non |
| `rangParents` | rang de richesse des parents, 1 à 100 | non |
| `rangParentsConnu` | booléen : Stochia donne-t-il ce rang ? | non |
| `revenuPays` | `'faible'`, `'intermediaire'` ou `'eleve'` : richesse du pays de naissance | non |
| `revenuPaysConnu` | booléen : le filtre a-t-il pu lire ce niveau ? | non |
| `age` | nombre | non |
| `sante`, `social`, `moral` | jauges de 0 à 100, départ à 50 | oui, bornées |
| `karma` | jauge de 0 à 100, départ neutre à 50 | oui, bornée |
| `education` | jauge de 0 à 100, départ à 0 | oui, bornée |
| `patrimoine` | nombre, départ à 0, peut être négatif | oui |
| `scolarise`, `emploi`, `couple` | booléens | oui |
| `enfants`, `petitsEnfants` | entiers, 0 ou plus | oui |
| `mineur`, `parent`, `grandParent` | booléens déduits de l’âge et des compteurs | non |

Les marques (`bac`, `voiture`…) sont des libellés libres : une carte en pose une sans que le modèle change. Lire `rangParents` ou `revenuPays` quand il est inconnu écarte la carte du tirage : écrire `rangParentsConnu && rangParents >= 80`, `revenuPaysConnu && revenuPays == 'eleve'`.

Ces paramètres sont dans `packages/engine/src/parameters.ts` et `state.ts`. Le patrimoine est en unité de jeu, sans lien avec la richesse de Stochia.

### Passage des années

Le moteur a une seule règle annuelle, `nextYear` : l’âge avance d’un an et, si la vie était `scolarise`, `education` gagne `5 + (qi - 100) / 15 + (rangParents - 50) / 25`, arrondi, au moins 1. Le terme du rang vaut 0 quand le rang est inconnu. La règle ne tire rien. Le filtre et `cards:simulate` passent tous les deux par elle.

### Tirage

`drawCard` tire une carte parmi celles dont la condition est vraie, au prorata des poids. `resolveCard` tire les variables, lance le dé de l’option s’il y en a un, choisit une issue, applique son impact et rend un nouvel état. Le générateur est fourni par l’appelant et initialisé par une graine : la même graine rejoue la même vie.

Une option peut porter un `tirage`. Le total du dé et des modificateurs est la variable `jet`, lisible par les issues de cette option seulement. `premier-amour` s’en sert : se déclarer lance un dé à 20 faces, et le moral, le QI, le social, la santé et le karma ajoutent ou retirent jusqu’à 2 chacun. Il faut 12. Le jeu montre le dé, les modificateurs, le total et le seuil. Il ne reçoit ni la formule, ni l’autre issue.

`relance` est un prix en karma, payé sur l’état d’avant le jet. Le jeu ne la propose que si ce karma suffit, et une seule fois : le premier résultat est oublié. Passer à l’année suivante le garde.

### Jeu de base

Le dépôt contient 11 types et 74 cartes qui suffisent à dérouler une vie, de 1 an à la retraite. Hors du gain annuel d’éducation (voir [Passage des années](#passage-des-années)), le moteur n’a pas de règle de vie : l’école, le travail, le couple ou les enfants n’arrivent que par des cartes, et l’enchaînement passe par les marques et les conditions.

| Type | Rôle | Exemples |
| --- | --- | --- |
| `etape` (Étape de vie) | Les passages d’une vie, de poids élevé quand leur moment vient | premiers pas, scolarisation, orientation, installation, naissance, retraite |
| `epreuve` (Épreuve) | Un score tiré qui décide de l’issue | bac, diplôme, premier emploi, recherche d’emploi |
| `rencontre` | Une personne entre dans la vie et pose une marque | ami d’enfance, premier amour, coup de foudre, mentor |
| `opportunite` (Opportunité) | Ne s’ouvre qu’après une marque ou une situation | recommandation, promotion, retour au travail |
| `pari` | Un risque choisi, issue tirée | créer son entreprise, placement en bourse, arrêter de fumer |
| `retour_de_baton` (Retour de bâton) | La suite d’un choix passé, lu dans les marques | colis réclamé, panne de voiture, toux du fumeur |
| `dilemme` | Deux options qui coûtent chacune quelque chose | première cigarette, triche, prêt à un ami, mutation |
| `chance`, `tuile` | Subies, une seule option | loterie, prime, pension ; bras cassé, grippe, licenciement |
| `choix`, `choix_mystere` (Choix mystère) | Choix du joueur, à issue connue ou cachée | école privée ou publique, vélo, vacances ; colis, voisin bruyant |

L’entrée à l’école dépend du pays, à partir de 6 ans :
- Dans un pays à revenu élevé, `ecole-privee-ou-publique` fait choisir. Le privé donne 5 points d’éducation et coûte un peu de vie sociale ; avec des parents sous le 40e rang ou de rang inconnu, la liste d’attente renvoie au public.
- Ailleurs, ou si le niveau est inconnu, `scolarisation` tire chaque année si les parents scolarisent l’enfant. La chance part de 0,4 en revenu faible, 0,85 en intermédiaire, 0,7 si inconnu, plus `(karma - 50) / 100` et un peu du rang des parents, bornée entre 0,1 et 0,95. Sans chance, pas d’école cette année et la carte revient ; à partir de 10 ans, l’école ne viendra plus (marques `pas_d_ecole` et `fin_etudes`, pour que le premier emploi reste possible).

L’éducation compte ensuite dans la note du `bac` et du `diplome`, et dans le score de `premier-emploi` et `recherche-emploi`. Une maladie ou un accident pendant la scolarité en retire un peu : grippe et varicelle 1, forte fièvre 2, bras cassé et blessure de sport grave 2, jambe cassée 3.

Le fil principal : `scolarisation` ou `ecole-privee-ou-publique` met à l’école (marque `ecole`), `orientation` mène au lycée, à l’apprentissage ou à l’arrêt (`lycee`, `fin_etudes`), `bac` puis `apres-le-bac` et `diplome` mènent aux études supérieures, `premier-emploi` puis `recherche-emploi` au travail, `coup-de-foudre` au couple, `installation` et `naissance` à la famille, `retraite` à partir de 62 ans.

### Karma

Le karma est une jauge de l’état, affichée au joueur comme les autres. Il se gagne par des bonnes actions qui coûtent toujours autre chose : rapporter le portefeuille plutôt que garder les billets, avouer son erreur au lieu de laisser accuser un collègue (au prix d’une prime), donner son sang (santé), son argent (patrimoine) ou ses samedis (moral). Les mauvaises actions rapportent tout de suite et font baisser le karma.

Le karma ne donne pas de points : il penche la chance, par les poids des cartes.
- Au-dessus de 75, `karma-rend-la-monnaie` peut tomber, d’autant plus souvent que le karma est haut. La loterie et la recommandation du mentor deviennent un peu plus probables.
- Au-dessous de 25, `karma-presente-la-note` coûte des amis, de l’argent ou du moral.
- Sous 45, à partir de 30 ans, `reparer-un-tort` offre de racheter une faute contre de l’argent.
- Sur `premier-amour`, 10 de karma rachètent un seul jet. Le karma d’avant la déclaration doit suffire, et le premier résultat disparaît.

`npm test` vérifie la règle : pour chaque carte dont les options changent le karma, l’option la plus vertueuse coûte plus en santé, social, moral ou patrimoine que la moins vertueuse.

### Ajouter ou modifier une carte

Créer ou modifier un fichier dans `apps/bff/cards/cartes/`, puis :

```bash
npm run cards:validate
npm run cards:simulate
```

`cards:validate` compile toutes les cartes, inactives comprises, et liste chaque fichier à corriger. `npm test` fait la même vérification.

`cards:simulate` déroule une vie avec le jeu du dépôt : une carte par an de 1 à 85 ans, une option prise au hasard, depuis la naissance de `apps/bff/fixtures/life.json`. Il affiche chaque année, l’état final et la commande pour rejouer la même graine : `npm run cards:simulate -- <graine>`, `--sensibles` pour inclure les cartes sensibles, `--saint` ou `--egoiste` pour prendre toujours l’option qui fait le plus ou le moins pour le karma, `--revenu faible|intermediaire|eleve|inconnu` pour la richesse du pays (intermédiaire par défaut, puisque l’outil ne demande rien à Stochia). C’est un outil de réglage, pas une règle du jeu : 85 ans est une borne de l’outil, pas une mort, et il n’appelle pas Stochia.

`npm test` simule aussi 300 vies au hasard, 100 de saints et 100 d’égoïstes, nées dans des pays de chaque niveau de revenu. Il vérifie que chaque carte est tirée, que chaque issue écrite est atteinte, que les états restent valides, que les étapes arrivent à leur âge dans la plupart des vies, que tous les enfants des pays riches vont à l’école et une minorité seulement des pays pauvres n’y va jamais, que l’éducation suit le QI, et que le karma suit la façon de jouer.

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

- La présentation de la partie est minimale : un état, une carte, ses choix et son issue. Il n’y a pas d’éditeur de cartes, ni de récapitulatif de vie à la fin.
- Les parties sont dans la mémoire d’un seul filtre : plusieurs instances hébergées derrière un répartiteur ne les partageraient pas.
- Les conditions, poids et impacts du jeu de base sont des valeurs de départ, à régler avec `cards:simulate`. En l’état, le patrimoine finit souvent négatif et la santé basse vers 85 ans.
- Une jauge à 0 n’a pas d’effet : la mort vient de Stochia, et rien ne la relie encore aux cartes.
- Sans moteur nouveau, une carte ne peut pas en appeler une autre l’année suivante, ni agir plusieurs années après, ni répéter un effet chaque année : ces enchaînements passent seulement par les marques et les conditions. Le seul effet annuel est celui de `nextYear` sur l’éducation.
- Les cartes changent avec le code : en modifier une demande de redémarrer le filtre, et de le redéployer une fois qu’il sera hébergé.
- Le filtre appelle Stochia depuis une seule adresse. Le service public limite `/api` à 60 requêtes par minute pour cette adresse, tous joueurs confondus. La richesse du pays ajoute jusqu’à trois requêtes la première fois qu’un pays apparaît, puis aucune tant que le filtre tourne.
- Les seuils de revenu, la chance d’être scolarisé et le gain annuel d’éducation sont des valeurs de départ, à régler avec `cards:simulate`.
- Ni le jeu ni le filtre ne sont déployés.
- Android, iOS et les installeurs signés ne sont pas faits. Une application Tauri de production a besoin d’un filtre hébergé et de `VITE_BFF_URL` au moment de la compilation.
- Les salaires ne sont pas affichés : Stochia les donne en dollars internationaux de 2021, et les convertir demande les tables de pouvoir d’achat.
- Pas de compte, de sauvegarde, d’inventaire ni de progression. La date de décès simulée n’est jamais envoyée au jeu.
