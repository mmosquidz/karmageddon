# Karmageddon — plan d’action

Ce plan construit le jeu décrit dans [game-design.md](game-design.md). Il dit quoi faire, dans quel ordre, et à quoi on reconnaît qu’une phase est finie. Il ne redit pas le design : chaque phase renvoie aux sections qu’elle réalise.

Une phase se construit quand le propriétaire du projet la demande, pas avant.

## Vue d’ensemble

| Phase | Ce que le joueur gagne | Sections du design | Dépend de | Poids estimé |
| --- | --- | --- | --- | --- |
| **1. Mourir et renaître** | Une vie qui finit par une mort et un bilan, et un karma qui passe à la vie suivante | 2, 4, 5, 10 | — | moyen |
| **2. Les moyens** | Un revenu, des prix, un logement, des options hors de portée | 3.4, 6, 7, 9.1 | 1 | gros |
| **3. Le climat** | Les aléas de son lieu de naissance, le dé qui les explique, la mort par catastrophe | 8, 4, 10 | 2 | moyen |
| **4. Le deck** | Un jeu varié et réglé, de la naissance au grand âge | 9.4, 9.5, 11 | 3 | gros, surtout de l’écriture |
| **5. Présenter et mettre en ligne** | Un jeu qu’on comprend sans aide, et qui tient à plusieurs joueurs | 1, 12 | 4 | petit à moyen |

Le poids est une estimation relative, pas un délai.

Les phases se suivent. Chacune laisse un jeu jouable. L’écriture des cartes de la phase 4 peut commencer dès la fin de la phase 2, sur les cartes qui ne touchent pas au climat.

## Ce que chaque phase doit tenir

Une phase est finie quand tout ceci est vrai :

- `npm test`, `npm run check`, `npm run build` et `npm run cards:validate` passent, et `npm run cards:simulate` déroule une vie entière.
- **Rien du futur n’atteint le jeu.** Un test joue deux vies dont les agendas sont identiques jusqu’à une année et différents ensuite : les réponses du filtre sont identiques jusqu’à cette année. Il couvre l’échéance (phase 1), la carrière (phase 2) et les aléas (phase 3).
- Toute réponse du filtre est construite à partir d’une liste explicite de champs. Un champ inconnu de Stochia n’apparaît dans aucune réponse sérialisée.
- Les tests ne touchent pas Stochia : fixtures et faux amont. Les erreurs réseau, les délais dépassés et les `429` restent couverts.
- Le jeu marche dans le navigateur et dans Tauri, sur mobile et sur ordinateur.
- Les documents suivent : la colonne « Construit » de `game-design.md`, la section « Partie » du README, et les invariants d’`AGENTS.md` listés dans la phase.
- `C:\stochia` n’est pas modifié. Aucune phase n’en a besoin.

---

## Phase 1 — Mourir et renaître

**But.** La partie ne s’arrête plus à 85 ans. Elle finit par une mort, à l’échéance de Stochia ou quand la santé tombe à zéro, puis par un bilan. La vie suivante commence avec le karma de la précédente. Le karma pèse sur tous les dés.

**À vérifier d’abord, dans Stochia.** `death_age` est facultatif dans la réponse : dans quels cas est-il absent ? Proposition : sans échéance, le filtre refuse la naissance comme une réponse invalide, plutôt que d’inventer une fin.

### Moteur (`packages/engine`)

1. `initialState` accepte un karma de départ. Sans lui, 50.
2. Une fonction dit si la vie est finie et de quoi (`sante` à 0). Le filtre et l’outil de simulation passent par elle.
3. Le moteur ajoute lui-même le modificateur « Karma » à chaque dé : `arrondi((karma - 50) / 25)` sur 20 faces, soit de −2 à +2, à proportion des faces sur un autre dé. Une carte garde donc 7 modificateurs à elle, au lieu de 8.
4. Tests du moteur : bornes du modificateur, proportion, karma de départ, fin de vie.

### Filtre (`apps/bff`)

1. `lifeResponseSchema` lit `death_age`.
2. Nouveau module `agenda.ts` : `toAgenda(life)` construit l’agenda à partir d’une liste explicite de champs. En phase 1, il ne contient que l’échéance. L’agenda est rangé avec la partie dans `lives.ts` et n’est jamais sérialisé.
3. `lives.next` termine la vie quand l’âge atteint l’échéance, ou quand la santé est à zéro. `LIFE_LAST_AGE` disparaît. Une vie d’échéance 0 se termine au premier appel, sans carte.
4. Une vie finie reste en mémoire, marquée finie, jusqu’à son délai d’oubli : elle porte le karma à transmettre.
5. `POST /api/births` accepte l’identifiant de la vie précédente. La nouvelle vie commence :
   - avec le karma final de la vie précédente, si elle est finie ;
   - avec le karma que la vie précédente avait reçu, si elle a été abandonnée ou jamais jouée ;
   - à 50 si l’identifiant est absent, inconnu ou oublié.
6. Le bilan est construit à partir d’une liste explicite : la cause, l’âge, le karma emporté, ce qu’on laisse.
7. L’outil de simulation prend une échéance en option : il n’appelle pas Stochia.

### Contrat (`packages/contract`)

1. La fin de partie porte un bilan : `{ kind: "end", status, summary: { cause, age, karma, … } }`, avec `cause` parmi `echeance` et `sante`.
2. La demande de naissance accepte `previousLifeId`. La réponse dit le karma de départ.

### Jeu (`apps/game`)

1. L’écran de fin devient le bilan : la cause, l’âge, ce qu’on laisse, le karma emporté. Ton fataliste, un texte par cause.
2. Un seul bouton, « Renaître », qui envoie l’identifiant de la vie finie. Pas de double envoi.
3. La fiche de naissance montre le karma reçu quand il diffère de 50.
4. Une vie de zéro an s’affiche proprement : la fiche, puis le bilan.

### Cartes

1. `premier-amour` perd son modificateur de karma écrit à la main.
2. Relire les conditions d’âge : des vies dépassent maintenant 85 ans.

### Documents

- `AGENTS.md` : le déroulé (« until the game’s last age » devient la mort) ; un invariant de plus : l’agenda reste dans la mémoire du filtre, et un fait de l’agenda n’atteint le client que l’année où il arrive ; « No new mechanics » garde sa liste, le karma entre les vies n’étant ni un compte ni une sauvegarde.
- README : section « Partie » (borne de 85 ans, champs reçus, demande de naissance).

### Fini quand

- Une vie se termine par un bilan qui dit la cause et l’âge.
- L’échéance n’apparaît dans aucune réponse avant la fin.
- Renaître après une mort garde le karma. Renaître après un redémarrage du filtre repart de 50.
- Le karma apparaît sur chaque dé, entre −2 et +2.

**Limite connue.** La santé ne se tient pas encore : il n’y a ni usure de l’âge ni récupération avant les règles annuelles de la phase 2, et le réglage attend la phase 4. D’ici là, la mort par la santé dépend du deck de départ.

---

## Phase 2 — Les moyens

**But.** L’argent devient réel : un revenu cadré par la carrière que Stochia a tirée, des prix dans la même unité, un affichage dans la monnaie du pays. Le logement entre dans l’état et change par des cartes. Une option trop chère s’affiche grisée. Ce qui dure passe par des règles annuelles écrites comme des données.

**À vérifier d’abord, dans Stochia.**

- Dans quels cas `career` est-il absent, et dans quels cas sa fin est-elle absente ?
- `dwelling` décrit-il bien le logement du foyer à la naissance ?

### Moteur

1. **Règles annuelles en données.** `nextYear(state, rules, context)` applique les règles dans l’ordre. Une règle a un `slug`, une `condition` et un `impact`, compilés par la chaîne des cartes. `hasard()` et `entier()` y sont refusés. La règle de l’école sort du code et devient la première règle du fichier.
2. **Contexte de l’année.** Le moteur reçoit de l’appelant un objet en lecture seule. En phase 2 : le revenu de référence de cet âge.
3. **`logement`** : un nouveau genre de champ, un texte pris dans une liste fermée. Écrire une valeur hors de la liste fait refuser la carte à la compilation. `logementConnu` vaut faux tant que ni Stochia ni une carte ne l’a fixé.
4. **`carriere`** : un nombre borné, départ à 1. **`revenu`** : lu seulement, la référence multipliée par `carriere`, nul sans emploi. `revenuConnu` vaut faux quand Stochia n’a pas tiré de carrière.
5. **`depuis('slug')`** : le nombre d’années depuis la dernière fois que la carte a été jouée.
6. **Condition sur une option**, avec son `motif`. Le moteur refuse de résoudre une option hors de portée. Une carte doit garder au moins une option sans condition : le joueur n’est jamais bloqué.
7. Tests du moteur pour chacun de ces points.

### Filtre

1. `lifeResponseSchema` lit `career` : l’âge et le salaire mensuel du début et de la fin. L’agenda garde la carrière de référence.
2. Le revenu de référence d’un âge : le salaire de début avant et au début, celui de fin à la fin et après, une ligne droite entre les deux. Le filtre ne retire rien : il lit la carrière tirée.
3. Nouveau fichier `apps/bff/cards/regles.json`, chargé et validé au démarrage. Proposition : une règle refusée empêche le filtre de démarrer, là où une carte refusée est seulement mise de côté. Une règle absente change tout le jeu.
4. `npm run cards:validate` couvre les règles.
5. Le statut montre l’argent et le revenu de l’année dans la monnaie du pays, par le facteur de pouvoir d’achat déjà utilisé pour la fiche de naissance (`purchasing-power.ts`). Les montants en dollars internationaux ne sortent pas du filtre.
6. Une option hors de portée part vers le jeu avec son motif. Sa condition ne sort pas.
7. L’outil de simulation prend une carrière de référence en option.

**À décider en début de phase.** Pour un pays sans monnaie connue du filtre, la fiche de naissance cache le revenu des parents. Proposition pour la partie : afficher l’argent sans unité, comme aujourd’hui.

### Contrat

1. Le statut gagne le logement, le revenu mensuel, et l’argent sous la forme déjà utilisée par la fiche de naissance (montant et monnaie).
2. Un choix gagne `available` et `reason`.

### Jeu

1. Le statut montre le logement (les silhouettes de `dwelling.ts`, plus une pour la rue), le revenu et l’argent en monnaie.
2. Une option hors de portée s’affiche grisée, avec son motif, lisible par un lecteur d’écran et impossible à envoyer.

### Cartes et règles

1. Premières règles de `regles.json` : l’école, le revenu moins le coût de la vie, le coût du logement et des enfants, l’usure de l’âge, le retour du moral vers son milieu.
2. Les 37 cartes qui touchent au patrimoine passent dans la nouvelle unité.
3. Les cartes de carrière déplacent `carriere` : diplôme, promotion, licenciement, entreprise, retraite.
4. Cartes de logement : acheter un pavillon, louer un appartement, être mis à la rue, sortir de la rue.
5. `demenagement` et `mutation` supposent qu’on change de lieu : à réécrire ou à retirer.

### Documents

- `AGENTS.md` : « Salaries stay hidden » devient : l’argent s’affiche dans la monnaie du pays de naissance par le facteur de pouvoir d’achat, jamais par un taux de change ; les montants en dollars internationaux et les revenus futurs ne sortent pas du filtre. L’état part toujours de la fiche de naissance ; le contexte de l’année vient de l’agenda. Les règles annuelles suivent les invariants des cartes (données, jamais `eval`, lues par le filtre seul).
- README : champs du statut, fichier des règles, options de la simulation.

### Fini quand

- Un emploi verse un revenu chaque année, et ce revenu suit la carrière tirée tant qu’aucune carte ne s’en mêle.
- Le joueur lit son argent dans la monnaie de son pays.
- Une option trop chère s’affiche grisée avec son motif.
- Le logement de naissance est dans le statut, et une carte peut le changer.
- Aucune règle de vie n’est plus écrite en code.

---

## Phase 3 — Le climat

**But.** Les aléas que Stochia a tirés entrent dans la partie, l’année où ils arrivent. Les cartes ordinaires les lisent. Les cartes d’aléa les jouent au dé visible, et leur pire issue tue. Le bilan compte ce qu’on a traversé.

**À vérifier d’abord.**

- Le service public de Stochia renvoie-t-il `hazards` ? Son README dit qu’il lit les aléas, mais aucune réponse réelle n’a été vérifiée. Sans aléas, cette phase n’a rien à montrer en ligne.
- En local, Stochia doit être lancé avec `STOCHIA_HAZARDS`.

### Moteur

1. Les noms du contexte de l’année sont déclarés par l’appelant. Le moteur ne connaît pas la liste des aléas.
2. L’action `meurt('cause')`. Elle n’est acceptée que dans une carte dont le type est déclaré mortel dans `types.json`, et dans une issue d’une option qui porte un dé : la catastrophe tue par le dé visible, et par lui seul.
3. Tests du moteur : `meurt` acceptée et refusée, noms de contexte inconnus refusés.

### Filtre

1. `lifeResponseSchema` lit `hazards` : les événements (année, âge, sorte), la couverture par sorte, la dernière année tirée.
2. Nouveau fichier `apps/bff/cards/aleas.json` : pour chaque sorte de Stochia, le nom lu par les scripts et le libellé montré au joueur. Une sorte absente de ce fichier est ignorée et notée dans le journal. Ajouter un aléa, c’est ajouter une ligne et des cartes.
3. Le contexte de l’année gagne l’année civile et, par aléa, trois valeurs : a-t-il lieu cette année, combien d’années depuis la naissance, la donnée existe-t-elle. La donnée n’existe pas quand Stochia ne couvre pas le lieu, ou après la dernière année tirée.
4. Sans `hazards`, la vie se joue sans cartes d’aléa. Le filtre n’invente rien.
5. Le bilan gagne, par aléa couvert : les années touchées, les années vécues comptées, et le nombre attendu au rythme de référence. Il gagne la cause `catastrophe`, avec l’aléa.
6. L’outil de simulation prend une liste d’aléas en option.

### Contrat et jeu

1. Le statut gagne l’année civile.
2. Le bilan gagne le climat traversé et la mention honnête (section 10 du design).
3. La carte d’aléa a son apparence. Le dé, ses modificateurs et la relance existent déjà.

### Cartes

1. Le type `alea`, déclaré mortel.
2. Un premier jeu sur les trois moments de la section 8.4 : environ six cartes pour subir, sept pour préparer, cinq pour se relever.
3. Une dizaine de cartes ordinaires lisent l’aléa de l’année dans leurs issues.
4. Les marques communes : `sinistre`, `assure`, `logement_frais`, `dette`.
5. La valeur de chaque logement face à la chaleur, à l’eau et au vent, écrite et justifiée dans `game-design.md`, section 7.

### Documents

- `AGENTS.md` : « No simulated future reaches the client » cite aussi les aléas à venir ; la mort par catastrophe est une règle du jeu et le bilan le dit ; le texte d’une carte ne dit pas plus que la donnée.
- README : `STOCHIA_HAZARDS` côté Stochia, champs du bilan, limites (2100, couverture).

### Fini quand

- Une vie née sur une côte exposée et une vie née à l’intérieur des terres ne reçoivent pas les mêmes cartes.
- Sur une même carte d’aléa, deux vies de moyens différents lisent des modificateurs différents.
- Une catastrophe peut tuer, et le bilan dit ce qui a manqué.
- Aucun aléa à venir n’apparaît dans une réponse.
- Une vie sans aléas se joue normalement.

---

## Phase 4 — Le deck

**But.** Réécrire le jeu de cartes sur le moteur complet, et le régler. Le deck de départ a servi à construire le moteur : il ne se règle pas, il se remplace.

### Outil

1. `npm run cards:simulate` joue un lot de vies sur des naissances et des agendas d’essai, sans appeler Stochia : plusieurs pays, plusieurs rangs, plusieurs logements, avec et sans aléas.
2. Il mesure les cibles de la section 11 du design : cartes subies de suite, retours d’une même carte, part des cartes qui lisent la naissance, écart à la carrière de référence, causes de mort, écart sur le dé d’aléa, poids du karma, nombre de cartes liées au climat.
3. Ces cibles deviennent des tests, à la place des vérifications actuelles sur le deck de départ.

### Écriture

1. Une grille de couverture avant d’écrire : les âges de la vie en colonnes, les familles de types en lignes, par niveau de richesse du pays. Chaque case a assez de cartes pour qu’aucune ne revienne plus de trois fois.
2. Chaque carte passe la liste de la section 9.5.
3. Les paris et les épreuves passent au dé visible.
4. Les enchaînements par marques s’étendent : c’est ce que le deck de départ fait de mieux.
5. Une relecture du ton sur tout le deck : on rit de sa propre mort, jamais de l’origine, du handicap ou de la famille. Les morts d’enfants se disent sobrement.

### Réglage

1. La santé d’abord : elle doit se tenir pour qui en prend soin et s’user pour qui la néglige.
2. Puis l’argent : les prix des protections face aux revenus tirés, par niveau de richesse du pays.
3. Puis les dés d’aléa, jusqu’à l’écart voulu entre le mieux protégé et le plus exposé.
4. Les cibles se corrigent si le jeu les contredit : ce sont des valeurs de départ.

### Fini quand

- Les tests des cibles passent.
- Dix vies jouées à la main, dans des pays de chaque niveau de richesse, ne montrent ni option dominée ni carte qui lasse.
- L’annexe de `game-design.md` décrit le nouveau deck.

---

## Phase 5 — Présenter et mettre en ligne

**But.** Un joueur qui arrive sans rien savoir comprend le jeu en une vie, et le jeu tient quand plusieurs personnes jouent.

1. **L’entrée.** L’accueil dit la règle en deux phrases. Le premier dé s’explique par son affichage, sans texte d’aide.
2. **Le bilan.** Relecture des textes par cause. La mention honnête renvoie aux sources et aux limites de Stochia.
3. **Les naissances en nombre.** On meurt souvent, donc on naît souvent, et le service public de Stochia limite le filtre à 60 appels par minute pour tous les joueurs. Le jeu honore déjà `429` et `Retry-After` : vérifier le message d’attente, et mesurer combien de naissances par minute une table de joueurs demande.
4. **La mémoire du filtre.** Les vies finies restent en mémoire pour le karma : revoir le délai d’oubli et le nombre maximal de vies.
5. **L’accessibilité.** Le dé, les options grisées et le bilan au clavier et au lecteur d’écran, sur mobile et sur ordinateur.
6. **La mise en ligne**, selon les étapes du README. Jamais de `localhost` dans `VITE_BFF_URL`.

### Fini quand

- Une personne qui n’a jamais vu le jeu joue une vie entière et explique ensuite pourquoi elle est morte.
- Le déploiement visé a été vérifié, et le compte rendu dit lequel.

---

## Plus tard

Ces sujets sont hors du plan. Chacun demande une décision du propriétaire.

| Sujet | Ce qu’il attend |
| --- | --- |
| Les feux, puis d’autres catastrophes | Que Stochia les tire. Côté jeu : une ligne dans `aleas.json` et des cartes |
| D’autres trajectoires climatiques | Une décision de jeu, et un paramètre de Stochia |
| Choisir son année de naissance | Stochia n’accepte aujourd’hui que la graine, la ville et le pays |
| Déménager | Des aléas tirés pour un autre lieu que celui de la naissance |
| Un karma qui survit au redémarrage | Un compte ou une sauvegarde : une mécanique nouvelle |

## Risques

| Risque | Ce qui le contient |
| --- | --- |
| **Le futur fuit vers le joueur**, par un champ, un message d’erreur ou les données d’hydratation | L’agenda n’est jamais sérialisé ; le test des deux agendas, à chaque phase |
| **Le jeu dit plus que la donnée** : une mort par canicule présentée comme un fait | La mention honnête du bilan ; la règle d’écriture 7 ; aucun chiffre de température, aucune catastrophe nommée |
| **Les morts du jeu noient celles de Stochia** | La cible : moins d’une vie sur trois finit avant l’échéance |
| **Les vies très courtes lassent ou blessent** | Un bilan sobre pour les morts d’enfants ; renaître en un geste |
| **Trop de naissances pour la limite de Stochia** | `429` et `Retry-After` honorés ; mesure en phase 5 |
| **Le climat écrase le reste**, quand un lieu est touché presque tous les ans | L’année comme contexte d’abord ; les cartes d’aléa sous condition ; la cible de 8 à 15 cartes |
| **Rien après 2100** : une naissance d’aujourd’hui y arrive vers 74 ans | `chaleurConnue` et ses pareils passent à faux ; le bilan le dit |
| **Le service public ne sert pas les aléas** | Vérification avant la phase 3 |
| **Le logement devient un jugement** sur une façon d’habiter | Des valeurs documentées, des textes relus, aucune moquerie |
| **Le deck ne suit pas** : beaucoup de cartes à écrire | La grille de couverture ; l’écriture commence dès la fin de la phase 2 |
