# Karmageddon — game design

Karmageddon est un jeu de vie. Il montre ce que les événements climatiques extrêmes font à une vie, selon l’endroit où elle commence et les moyens qu’elle a. Le jeu passe d’abord : ce qu’il montre vient de la mécanique, jamais d’un texte qui l’explique.

Ce document décrit le jeu tel qu’il doit être. Tout n’est pas construit. Dans les tableaux de référence, la colonne « Construit » dit ce qui tourne déjà, et sinon la phase du [plan d’action](plan.md) qui s’en charge. Les sections entièrement à construire le disent sous leur titre.

Les commandes, la configuration et les routes du filtre sont dans le [README](../README.md). Les règles pour qui modifie le code sont dans [AGENTS.md](../AGENTS.md).

## 1. Le jeu

### 1.1 En quelques phrases

On naît quelque part, par tirage. On vit une carte par an. On meurt : à l’échéance que le tirage a fixée, plus tôt si la santé tombe à zéro, ou dans une catastrophe dont on n’avait pas les moyens de se protéger. Puis on renaît ailleurs, et seul le karma suit.

Ça s’appelle Karmageddon : on va tous mourir, et on en rit.

### 1.2 La boucle

**Une vie.** Une naissance tirée par Stochia, puis une carte par an jusqu’à la mort. La vie se termine par un bilan.

**Entre les vies.** On renaît par un nouveau tirage. Rien ne suit, sauf le karma. On meurt beaucoup, parfois très tôt, et c’est le moteur du jeu : chaque vie est une autre naissance, d’autres moyens, d’autres aléas.

### 1.3 Les piliers

1. **On va tous mourir.** La mort est la fin normale d’une partie, pas un échec.
2. **La naissance compte.** Le lieu, le foyer, le logement et les revenus viennent du tirage. Deux naissances donnent deux parties différentes.
3. **Le monde ne négocie pas.** L’aléa climatique vient de Stochia. Aucun choix ni aucun karma ne l’empêche d’arriver.
4. **Les moyens protègent.** Ce qu’on peut se payer, et le logement qu’on habite, décident de ce qu’on subit.
5. **Chaque choix coûte.** Aucune option n’est gratuite, aucune n’est dominée.
6. **Seul le karma survit.** C’est la chance qu’on emporte dans la vie suivante.

### 1.4 Ce que le jeu fait sentir

| Ce que le joueur doit sentir | La mécanique qui le porte |
| --- | --- |
| **L’exceptionnel devient l’ordinaire.** Ce qui arrivait une année sur dix arrive une année sur deux | Les aléas de Stochia, année par année, et un bilan qui les compte |
| **Le même aléa ne fait pas les mêmes dégâts.** L’âge, la santé, l’argent, le logement et l’entourage décident | Le dé visible : chaque fragilité et chaque protection est un modificateur que le joueur lit |
| **Le lieu de naissance distribue le risque.** On ne choisit pas sa côte | Les aléas sont ceux du lieu de naissance, et on n’en part pas. Renaître ailleurs change la partie |
| **Se protéger est une affaire de moyens.** La climatisation existe, pas pour tout le monde | Des protections qui ont un prix, une option grisée quand on ne peut pas la payer, et une mort possible |
| **Les chocs s’additionnent.** Le deuxième arrive avant qu’on se soit relevé du premier | Des marques (`sinistre`, `dette`) et des cartes de reprise, sur plusieurs années |
| **Se préparer est un pari, et il a des limites.** On paie aujourd’hui contre un risque incertain | Des cartes de préparation qui coûtent, et des protections qui finissent par céder |
| **On n’y échappe pas.** On peut jouer mieux, pas gagner | La mort, toujours, et un bilan fataliste |

## 2. Stochia et le jeu

Stochia tire le cadre d’une vie à la naissance. Le jeu décide des écarts à ce cadre.

| Sujet | Ce que Stochia tire | Ce que le jeu ajoute |
| --- | --- | --- |
| La naissance | Le lieu, le foyer, le QI, le rang des parents | Rien. La fiche de naissance la montre telle quelle |
| La mort | L’âge de la mort. C’est l’échéance, et rien ne la recule | Deux façons de mourir avant : la santé à zéro, la catastrophe |
| Les aléas | Les années de bulle de chaleur, de raz-de-marée et de tornade, au lieu de naissance | Les dégâts : ce que l’aléa fait à cette vie, selon ses moyens |
| Les revenus | Une carrière : l’âge et le salaire du début, l’âge et le salaire de la fin | Les écarts : une promotion, un licenciement, une entreprise, de la chance |
| Le logement | Le logement du foyer à la naissance | Les changements : acheter, louer, se retrouver à la rue |
| Le lieu | Le lieu de naissance | Rien : on ne déménage pas |

**L’agenda.** Le filtre garde ce cadre en mémoire avec la partie : l’échéance, les aléas, la carrière de référence. Cet agenda ne sort jamais du filtre. Chaque année, le filtre en tire le **contexte de l’année** (l’année civile, les aléas de cette année, le revenu de référence de cet âge) et le donne au moteur. Le joueur n’apprend une chose que l’année où elle arrive.

Quatre principes tiennent l’ensemble :

- **Le jeu ne retire jamais un tirage de Stochia.** Il ne redécide ni de la naissance, ni de l’échéance, ni d’un aléa.
- **Le jeu peut seulement raccourcir une vie**, jamais la prolonger au-delà de l’échéance.
- **Rien du futur n’atteint le joueur.** Ni la mort, ni un aléa, ni un revenu à venir.
- **Si Stochia n’envoie pas une donnée, le jeu s’en passe** et n’invente rien. Sans aléas, pas de cartes d’aléa.

## 3. Une vie

### 3.1 Une année

1. L’âge avance d’un an.
2. Les règles annuelles s’appliquent (3.4).
3. Le moteur tire une carte parmi celles dont la condition est vraie, au prorata des poids.
4. Le joueur choisit une option.
5. Le moteur tire une issue de cette option et applique son impact.

Une année sans carte tirable passe sans s’afficher. La dernière année jouée est celle de l’échéance, sauf si la vie finit avant (section 4). Aujourd’hui la partie s’arrête à 85 ans, sans mort ni bilan : cette borne disparaît en phase 1.

Le joueur voit son âge, ses jauges, son argent, son logement, sa situation (scolarisé, en emploi, en couple, enfants) et son QI. D’une carte, il voit le type, le titre et le libellé des options. Après son choix, il voit le texte de l’issue tirée, ce qui a changé, et le dé s’il y en a un. Il ne voit jamais l’effet d’une option avant de la choisir, ni ses marques. La liste exacte de ce que le jeu reçoit est dans le README, section « Partie ».

### 3.2 L’état

Les noms ci-dessous sont ceux que lisent les scripts des cartes et des règles.

| Nom | Type | Un impact peut le changer | Construit |
| --- | --- | --- | --- |
| `sexe` | `'femme'` ou `'homme'` | non | oui |
| `pays` | code du pays de naissance, `'FR'` | non | oui |
| `milieu` | `'urbain'` ou `'rural'` | non | oui |
| `qi` | nombre | non | oui |
| `rangParents` | rang de richesse des parents, 1 à 100 | non | oui |
| `revenuPays` | `'faible'`, `'intermediaire'` ou `'eleve'` : richesse du pays de naissance | non | oui |
| `rangParentsConnu`, `revenuPaysConnu` | booléens : la donnée existe-t-elle pour cette vie ? | non | oui |
| `age` | nombre | non | oui |
| `sante`, `social`, `moral` | jauges de 0 à 100, départ à 50 | oui, bornées | oui |
| `karma` | jauge de 0 à 100. Départ à 50, ou au karma de la vie précédente | oui, bornée | départ hérité : phase 1 |
| `education` | jauge de 0 à 100, départ à 0 | oui, bornée | oui |
| `patrimoine` | nombre, départ à 0, peut être négatif. Même unité que les revenus (section 6) | oui | unité : phase 2 |
| `scolarise`, `emploi`, `couple` | booléens | oui | oui |
| `enfants`, `petitsEnfants` | entiers, 0 ou plus | oui | oui |
| `mineur`, `parent`, `grandParent` | booléens déduits de l’âge et des compteurs | non | oui |
| `logement` | texte : le logement actuel (section 7) | oui | phase 2 |
| `carriere` | nombre, départ à 1 : l’écart à la carrière de référence (section 6) | oui, borné | phase 2 |
| `revenu` | nombre : le revenu mensuel de l’année | non | phase 2 |
| `logementConnu`, `revenuConnu` | booléens : Stochia a-t-il tiré un logement, une carrière ? | non | phase 2 |
| `annee` | nombre : l’année civile | non | phase 3 |
| `aleaChaleur`, `aleaMer`, `aleaTornade` | booléens : l’aléa a lieu cette année | non | phase 3 |
| `anneesChaleur`, `anneesMer`, `anneesTornade` | entiers : années touchées depuis la naissance | non | phase 3 |
| `chaleurConnue`, `merConnue`, `tornadeConnue` | booléens : Stochia a-t-il une donnée pour ce lieu et cette année ? | non | phase 3 |

S’y ajoutent deux mémoires, que les scripts lisent par des fonctions :

- Les **marques** (`bac`, `voiture`, `fumeur`…) sont des libellés libres. Une carte en pose une sans que le modèle change.
- L’**historique** garde chaque carte jouée, l’option prise, l’issue tirée et l’âge.

Lire une donnée inconnue écarte la carte du tirage. Il faut écrire `rangParentsConnu && rangParents >= 80`, ou `chaleurConnue && aleaChaleur`.

### 3.3 Comment l’état change

| Façon | Ce qu’elle change | Quand | Construit |
| --- | --- | --- | --- |
| L’impact d’une issue | Les jauges, l’argent, le logement, les booléens, les compteurs. Une jauge reste entre 0 et 100, un compteur ne descend pas sous 0 | Quand le joueur a choisi et que l’issue est tirée | oui |
| `pose('x')` et `retire('x')`, dans un impact | Les marques | Idem | oui |
| Les règles annuelles | Tout ce qu’un impact peut changer | À chaque passage d’année, sans tirage | phase 2. Aujourd’hui, une seule règle, en code, sur l’éducation |
| La relance d’un dé | `karma`, du prix de la relance | Quand le joueur la paie | oui |
| `meurt('cause')`, dans un impact | Termine la vie | Idem | phase 3 |

Il n’y a pas d’autre façon de modifier l’état.

### 3.4 Les règles annuelles

*À construire : phase 2.*

Les règles annuelles sont des données, chargées, validées et compilées comme les cartes. Chacune a une condition et un impact, écrits dans le langage des cartes. Elles s’appliquent à chaque passage d’année, dans l’ordre du fichier, sans hasard.

```json
[
  { "slug": "ecole", "condition": "scolarise", "impact": "education += max(1, arrondi(5 + (qi - 100) / 15))" },
  { "slug": "revenu", "condition": "emploi", "impact": "patrimoine += 12 * revenu * 0.15" },
  { "slug": "tabac", "condition": "a('fumeur')", "impact": "sante -= 0.5" },
  { "slug": "grand-age", "condition": "age >= 60", "impact": "sante -= (age - 55) / 10" },
  { "slug": "moral-revient", "condition": "vrai", "impact": "moral += (50 - moral) / 10" }
]
```

Les valeurs sont des exemples. Ces règles portent tout ce qui dure : le revenu, le coût de la vie et du logement, l’usure de l’âge, le retour des jauges vers leur milieu, une maladie chronique, une dette, une prime d’assurance.

Aujourd’hui le moteur n’a qu’une règle annuelle, écrite en code : une année passée à l’école ajoute à `education` `5 + (qi - 100) / 15 + (rangParents - 50) / 25`, arrondi, au moins 1. Le terme du rang vaut 0 quand le rang est inconnu. Elle deviendra la première règle du fichier.

## 4. La mort

*À construire : phase 1, sauf la mort par catastrophe, en phase 3.*

On meurt de trois façons.

| Cause | Règle | Ce que le joueur y peut |
| --- | --- | --- |
| **L’échéance** | L’âge de la mort tiré par Stochia est atteint | Rien. C’était l’heure |
| **La santé à zéro** | La jauge `sante` atteint 0 | Tout ce qui entretient ou ruine la santé |
| **La catastrophe** | Sur une carte d’aléa, le dé tombe dans sa pire issue | Ses moyens, son logement, sa préparation, et un peu de chance |

- **La catastrophe tue par le dé visible.** Le joueur lit ce qui l’a exposé : un logement inadapté, pas de quoi acheter une protection, un grand âge, une santé basse.
- **Seules les cartes d’aléa peuvent tuer**, par l’action `meurt('cause')`. La cause est gardée pour le bilan.
- **La santé se tient.** Elle s’use avec l’âge et se regagne par des choix. Mourir de la santé doit venir de ce qu’on a fait ou subi, pas du hasard d’un tirage de cartes.
- **Une vie peut être très courte.** Stochia tire des morts à 0 ou 2 ans. La vie se termine alors par son bilan, parfois avant la première carte.

Deux garde-fous :

- **La mort par catastrophe est une règle du jeu, pas une donnée.** Stochia dit que ses aléas ne changent pas la durée de vie et ne sont pas validés scientifiquement. Le bilan le dit aussi.
- **Le rire porte sur sa propre mort.** Les cartes touchent les biens, la santé, le moral et la vie du joueur, jamais la mort d’un proche. La mort d’un enfant se dit sobrement, sans un mot sur le pays.

## 5. Le karma

**Le karma est un bonus de chance dans les tirages.** Il ne donne pas de points.

| Effet | Règle | Construit |
| --- | --- | --- |
| Un modificateur sur chaque dé | De −2 à +2 sur un dé à 20 faces, à proportion sur un autre dé. Le moteur l’ajoute lui-même, y compris sur les dés où l’on risque sa vie | phase 1. Aujourd’hui, écrit à la main sur un seul dé |
| La relance | Du karma dépensé rachète un jet, une fois. Le premier résultat est oublié | oui |
| Le poids de certaines cartes | La chance sourit un peu plus à qui a un karma haut, et présente la note à qui l’a bas | oui |
| La vie suivante | Elle commence avec tout le karma de la précédente | phase 1 |

**Le karma se gagne toujours contre autre chose** : de l’argent, de la santé, du temps. Les mauvaises actions rapportent tout de suite et le font baisser. Un test le vérifie : pour chaque carte dont les options changent le karma, l’option la plus vertueuse coûte plus que la moins vertueuse.

**Le karma survit à la mort.** C’est le fil entre les vies, et la raison de bien finir une vie perdue d’avance. Le filtre le garde tant que la session dure, sans compte ni sauvegarde : un redémarrage le remet à 50.

Ce que le karma ne fait jamais :

- **Il ne choisit pas la naissance.** Elle reste le tirage de Stochia. Sinon le jeu dirait qu’on mérite de naître pauvre.
- **Il n’empêche pas un aléa** et ne recule pas l’échéance.

## 6. L’argent

*À construire : phase 2. Aujourd’hui le patrimoine est une unité de jeu sans revenu : un emploi ne verse rien.*

**Les revenus sont cadrés par le tirage.** Stochia tire pour chaque vie une carrière : l’âge et le salaire mensuel du début, l’âge et le salaire de la fin. C’est la carrière de référence, ce que cette vie gagne si rien ne s’en mêle. Entre le début et la fin, la référence passe de l’un à l’autre en ligne droite.

**Le joueur peut s’en écarter sensiblement.** `carriere` vaut 1 au départ, et les cartes le déplacent : des études, une promotion, une entreprise qui marche le montent ; un licenciement, une faillite, une santé ruinée le baissent. Le revenu d’une année est la référence de cet âge multipliée par `carriere`. Il est nul sans emploi.

**L’argent circule chaque année.** Une règle annuelle verse le revenu et retire le coût de la vie, du logement et des enfants.

**Les prix sont dans la même unité que les revenus.** Une protection coûte à peu près la même chose partout, et les revenus tirés ne sont pas les mêmes partout. C’est ce qui fait tenir le pilier « les moyens protègent ».

**Le joueur voit son argent dans la monnaie de son pays**, comme sur la fiche de naissance : le filtre convertit par le facteur de pouvoir d’achat, jamais par un taux de change, et le montant en dollars ne sort pas du filtre. Le patrimoine du joueur se compare ainsi à celui de ses parents.

## 7. Le logement

*À construire : phase 2.*

**Le logement fait partie de l’état.** Sa valeur de départ est celle que Stochia tire pour le foyer à la naissance.

| Valeur | Sens | Origine |
| --- | --- | --- |
| `maison` | Maison individuelle | Stochia |
| `maison_jumelee` | Maison jumelée | Stochia |
| `maison_en_bande` | Maison en bande | Stochia |
| `appartement` | Appartement | Stochia |
| `concession` | Concession | Stochia |
| `traditionnel` | Habitation traditionnelle | Stochia |
| `precaire` | Habitat précaire | Stochia |
| `mobile` | Habitat mobile | Stochia |
| `rue` | À la rue | Le jeu |

**Des cartes le changent de temps en temps** : acheter un pavillon, louer un appartement, être mis à la rue.

**On change de logement, pas de lieu.** Les aléas restent ceux du lieu de naissance. Le logement change ce qu’ils font.

**Le logement pèse sur le dé.** Chaque type protège plus ou moins de la chaleur, de l’eau et du vent. Ces valeurs sont des hypothèses de jeu : elles se documentent, et elles ne se moquent d’aucune façon d’habiter.

## 8. Le climat

*À construire : phase 3.*

### 8.1 Ce que Stochia fournit

Stochia tire trois aléas pour chaque vie, dans la cellule de naissance (0,25°, environ 25 km), année par année, jusqu’en 2100, sur la trajectoire SSP2-4.5. Sa méthode est dans `docs/hazards.md` du dépôt Stochia.

| Aléa | Ce que signifie une année touchée | Rythme de référence |
| --- | --- | --- |
| Bulle de chaleur | Le jour le plus chaud de l’année atteint le troisième maximum annuel de 1981–2010 | Environ une année sur dix en 1981–2010 |
| Raz-de-marée | La mer atteint le niveau qui était centennal. À partir de 2020, la montée des eaux le rend plus facile à atteindre | Environ une année sur cent avant 2020 |
| Tornade | Une tornade forte (magnitude 2 ou plus) dans la cellule | Constant dans le temps. États-Unis seulement |

Trois faits contraignent la conception :

1. **Un aléa n’est pas un dégât.** Stochia dit que l’aléa a eu lieu dans la cellule cette année-là, pas que la personne a été touchée. Les dégâts, et la mort, sont l’affaire du jeu.
2. **Les aléas peuvent tomber presque tous les ans.** Dans la vie d’essai du dépôt, née en 2026 sur la côte de Lombok, 59 des 75 années tirées ont une bulle de chaleur et 39 un raz-de-marée. Une carte de catastrophe par aléa est impossible : le jeu ne serait plus que cela.
3. **Le risque se déplace au cours d’une vie.** Le rapport de production de Stochia donne à La Rochelle un raz-de-marée 1 année sur 100 dans les années 2010, 6 sur 100 dans les années 2050 et près d’une sur deux dans les années 2090. Une vie jouée année par année peut le montrer.

**Ajouter un aléa est une affaire de données.** Les feux, puis d’autres catastrophes, viendront quand Stochia les tirera : une sorte de plus dans l’agenda, trois noms de plus pour les scripts, des cartes. Le moteur ne connaît pas la liste des aléas.

### 8.2 Deux façons d’entrer dans la partie

**L’année comme contexte.** Les cartes ordinaires lisent l’aléa de l’année dans leurs issues. Le bac se passe sous une bulle de chaleur, les heures supplémentaires coûtent plus de santé, les vacances tournent court. C’est le canal principal : le climat ne remplace pas la vie, il pèse sur elle.

**La carte d’aléa.** Le type `alea`, pour les années où l’aléa devient l’événement. Elle ne se tire pas à chaque aléa, mais quand une condition lui donne du sens : la première fois, à un âge fragile, dans un logement exposé, quand deux aléas tombent la même année, ou quand la maison n’est pas encore réparée.

### 8.3 Le dé visible comme démonstration

Une carte d’aléa se résout par un dé. L’aléa est le lancer. Les modificateurs sont ce qui rend cette vie fragile ou protégée, et le joueur les lit un par un.

```json
{
  "slug": "chaleur-grand-age",
  "type": "alea",
  "titre": "Le jour le plus chaud de l'année atteint un niveau qu'on voyait autrefois une année sur dix",
  "condition": "chaleurConnue && aleaChaleur && age >= 70",
  "poids": "30",
  "options": [
    {
      "id": "rester",
      "libelle": "Vous fermez les volets et vous attendez",
      "tirage": {
        "de": 20,
        "seuil": 12,
        "relance": 10,
        "modificateurs": [
          { "libelle": "Santé", "valeur": "arrondi((sante - 50) / 15)" },
          { "libelle": "Grand âge", "valeur": "age >= 80 ? -4 : -2" },
          { "libelle": "Logement", "valeur": "a('logement_frais') ? 5 : logement == 'rue' ? -5 : logement == 'precaire' ? -3 : 0" },
          { "libelle": "Des voisins qui passent", "valeur": "arrondi((social - 50) / 20)" }
        ]
      },
      "issues": [
        { "condition": "jet >= 12", "texte": "Vous tenez. Le ventilateur aussi, de justesse.", "impact": "moral -= 2" },
        { "condition": "jet >= 5 && jet < 12", "texte": "Un malaise, puis les urgences. La salle d'attente est pleine.", "impact": "sante -= 15; moral -= 5" },
        { "condition": "jet < 5", "texte": "On va tous mourir. Vous, c'était cet après-midi.", "impact": "meurt('chaleur')" }
      ]
    },
    {
      "id": "climatiseur",
      "libelle": "Vous achetez un climatiseur",
      "condition": "patrimoine >= 600",
      "motif": "Hors de vos moyens",
      "issues": [
        { "texte": "Il fait un bruit de frigo. Vous dormez enfin.", "impact": "patrimoine -= 600; pose('logement_frais')" }
      ]
    }
  ]
}
```

Les valeurs sont à régler. Le karma n’est pas écrit dans la carte : le moteur l’ajoute au dé. Sans une ligne d’explication, le joueur lit que son âge pèse −4, que son logement pèse −3 et que son karma vaut +1. Il voit aussi que le climatiseur existe, grisé, hors de ses moyens. Dans la vie suivante, il s’en souvient.

### 8.4 Préparer, subir, se relever

| Moment | Ce que fait le joueur | Types | Cartes à écrire |
| --- | --- | --- | --- |
| **Préparer**, les années calmes | Il paie, ou non, pour un risque qu’il ne connaît pas | `choix`, `dilemme`, `pari` | S’assurer ; rafraîchir ou isoler le logement ; surélever la maison ; mettre de l’argent de côté ; connaître ses voisins ; financer la digue de la commune ; changer de logement |
| **Subir**, l’année de l’aléa | Il décide sous la contrainte, et lance le dé | `alea` | La première bulle de chaleur ; la chaleur au grand âge ; l’eau dans la maison ; chaleur et raz-de-marée la même année ; la tornade ; l’aléa quand on est à la rue |
| **Se relever**, les années suivantes | Il reconstruit, s’endette ou perd son logement | `retour_de_baton`, `opportunite` | L’assurance paie, ou se retire après le troisième sinistre ; l’aide publique arrive, ou non, selon la richesse du pays ; les voisins aident ; réparer, se reloger, ou la rue |

- **Une préparation coûte quelque chose de réel**, tout de suite, et ne sert peut-être jamais.
- **Une protection a une limite.** L’assureur se retire, la digue est dépassée, le logement rafraîchi ne suffit plus à 85 ans.
- **Un choc qui tombe sur un sinistre non réparé est pire.** Ce n’est pas la force d’un événement qui ruine, c’est le suivant.

## 9. Les cartes

### 9.1 Le format

Une carte est un fichier JSON, `apps/bff/cards/cartes/<slug>.json`. Le nom du fichier est le slug.

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

| Champ | Rôle | Défaut | Construit |
| --- | --- | --- | --- |
| `slug` | Identifiant, égal au nom du fichier | | oui |
| `type` | Un type de `types.json` | | oui |
| `condition` | La carte peut-elle être tirée pour cette vie ? | `vrai` | oui |
| `poids` | Fréquence relative parmi les cartes tirables | `1` | oui |
| `unique` | Jouée une seule fois par vie | `false` | oui |
| `sensible` | Sujet dur : hors des tirages sauf demande explicite | `false` | oui |
| `actif` | `false` garde le fichier sans jamais tirer la carte | `true` | oui |
| `variables` | Tirages intermédiaires `{ "nom", "valeur" }`, faits dans l’ordre à la résolution | aucune | oui |
| `options` | Les choix du joueur. Une carte subie n’en a qu’un | | oui |
| `options[].condition`, `motif` | L’option est-elle à la portée du joueur ? Sinon elle s’affiche grisée, avec le motif | `vrai` | phase 2 |
| `options[].tirage` | Un dé (`de`), des `modificateurs` (`libelle`, `valeur`), un `seuil`, et une `relance` facultative en karma. Le total s’appelle `jet` | aucun | oui |
| `options[].issues` | Les suites possibles d’une option : `condition`, `poids`, `texte`, `impact` | | oui |

Une carte est refusée entière si son fichier n’est pas du JSON, si son slug diffère du nom du fichier, si un champ est inconnu, si son type est absent de `types.json` ou si un script est faux. Ce que le filtre fait d’une carte refusée est dans le README, section « Cartes ».

### 9.2 Le langage de script

`condition`, `poids`, `valeur` et `impact` sont écrits dans un petit langage propre au jeu. Ce n’est pas du JavaScript et rien n’est passé à `eval`. Un nom ou une fonction hors des listes ci-dessous fait refuser la carte, avec le champ et la colonne de l’erreur.

- Valeurs : nombres, textes entre `'` ou `"`, `vrai`, `faux`.
- Opérateurs : `+ - * /`, `< <= > >=`, `== !=`, `&& || !`, `condition ? a : b`, parenthèses.
- Impact : des changements séparés par `;`, avec les affectations `=`, `+=`, `-=`, `*=`, `/=`, et des actions.

| Fonction ou action | Sens | Construit |
| --- | --- | --- |
| `a('bac')` | La vie porte cette marque | oui |
| `deja('slug')` | La carte a déjà été jouée | oui |
| `depuis('slug')` | Nombre d’années depuis que la carte a été jouée, pour qu’elle ne revienne pas trop tôt | phase 2 |
| `min`, `max`, `arrondi` | Calcul | oui |
| `hasard()`, `entier(1, 6)` | Hasard : de 0 à 1, ou un entier, bornes comprises | oui |
| `pose('bac')`, `retire('bac')` | Action : pose ou retire une marque | oui |
| `meurt('cause')` | Action : termine la vie. Permise seulement sur une carte d’aléa, dans une issue jouée au dé | phase 3 |

Le hasard n’est permis que dans `variables` et `impact`. Une condition ou un poids se calcule sur l’état seul. Une issue se choisit sur l’état et les variables déjà tirées. Un `tirage` est l’autre source de hasard : le moteur lance le dé, et ses modificateurs se lisent sur l’état, sans `hasard()` ni `entier()`.

### 9.3 Tirage et résolution

Le moteur tire une carte parmi celles dont la condition est vraie, au prorata des poids. Pour l’option choisie, il tire les variables, lance le dé s’il y en a un, choisit une issue, applique son impact et rend un nouvel état. Le générateur est initialisé par une graine : la même graine rejoue la même vie.

Le total du dé et des modificateurs est la variable `jet`, lisible par les issues de cette option seulement. Le jeu montre le dé, les modificateurs, le total et le seuil. Il ne reçoit ni la formule, ni les autres issues.

`relance` est un prix en karma, payé sur l’état d’avant le jet. Le jeu ne la propose que si ce karma suffit, et une seule fois : le premier résultat est oublié. Passer à l’année suivante garde le premier résultat.

### 9.4 Les types

Un type est une donnée : en ajouter un, c’est ajouter `{ "slug", "libelle" }` dans `apps/bff/cards/types.json`. Le moteur tire tous les types de la même façon. Le type est un contrat tenu avec le joueur : il annonce le genre de moment qu’il va vivre.

| Famille | Types | Le contrat |
| --- | --- | --- |
| Ce qui arrive | `chance`, `tuile`, `alea` | Pas de choix, ou un choix sous contrainte pour `alea`. L’issue se lit sur l’état : la même tuile ne fait pas le même mal à tout le monde |
| Ce qu’on décide | `choix`, `dilemme`, `choix_mystere` | Deux options ou plus, aucune dominée. Dans un `choix`, le libellé annonce le prix. Dans un `dilemme`, chaque option coûte. Dans un `choix_mystere`, le joueur sait qu’il ne sait pas |
| Ce qu’on tente | `pari`, `epreuve` | Toujours un dé visible, avec des modificateurs lus sur l’état et une relance |
| Ce qui structure | `etape`, `rencontre`, `opportunite`, `retour_de_baton` | Une étape arrive à son âge. Une rencontre pose une marque. Une opportunité et un retour de bâton lisent une marque posée plus tôt |

Les onze premiers types existent. `alea` vient en phase 3 : c’est le seul type dont une carte peut tuer.

### 9.5 Écrire une carte

1. **Une carte, une idée.** Un titre qui se lit d’un coup d’œil, des options courtes.
2. **Aucune option gratuite.** Chaque option coûte ou risque quelque chose.
3. **La carte lit la vie.** Au moins un paramètre autre que l’âge : la naissance, le logement, les moyens, une jauge, une marque.
4. **La carte laisse une trace** quand c’est possible : une marque qu’une autre carte viendra lire.
5. **Un score se joue au dé visible**, avec des modificateurs que le joueur comprend sans explication.
6. **L’aléa vient de l’agenda**, jamais d’un `hasard()` dans la carte.
7. **Le texte ne dit pas plus que la donnée.** Une bulle de chaleur est le jour le plus chaud de l’année : pas de « dix jours de canicule », pas de température chiffrée, pas de catastrophe réelle nommée.
8. **Le ton.** On rit de la mort, et d’abord de la sienne. Jamais de l’origine, du handicap ou de la famille.

## 10. Le bilan

*À construire : phase 1, puis phase 3 pour le climat.*

La vie se termine par un bilan. Il ne contient que du passé.

**Le ton est fataliste.** Le bilan ne félicite pas et ne console pas. Il constate : on va tous mourir, voilà comment c’est arrivé cette fois.

- **La cause et l’âge.** L’échéance (« c’était l’heure »), la santé, ou la catastrophe, avec ce qui a manqué : un logement, de l’argent, de la chance.
- **Le climat traversé.** « 31 années de bulle de chaleur sur 74. Au rythme de 1981–2010, il y en aurait eu environ 7. » Ce rythme de référence est exact par construction : le seuil de Stochia est celui qu’on atteignait une année sur dix. Pour le raz-de-marée, la référence est d’une année sur cent avant 2020.
- **Ce qu’on laisse** : de l’argent ou des dettes, des enfants, un logement.
- **Le karma emporté** dans la vie suivante.
- **La mention honnête.** Les aléas sont tirés et non validés scientifiquement, la mort par catastrophe est une règle du jeu, et le compte des aléas s’arrête en 2100.

Puis un seul bouton : renaître.

## 11. Le réglage

| Réglage | Fichier |
| --- | --- |
| Bornes et départs des jauges, gain annuel d’éducation, âge de la majorité | `packages/engine/src/parameters.ts` |
| Noms de l’état, et ce qu’un impact a le droit d’écrire | `packages/engine/src/state.ts` |
| Conditions, poids, impacts, seuils des dés | `apps/bff/cards/cartes/*.json` |
| Types | `apps/bff/cards/types.json` |
| Dernier âge joué, jusqu’à la phase 1 | `LIFE_LAST_AGE`, `apps/bff/src/lives.ts` |
| Seuils de richesse du pays | `apps/bff/src/economy.ts` |

`npm run cards:validate` compile toutes les cartes, et `npm run cards:simulate` déroule une vie entière. Leurs options sont dans le README. La simulation est un outil de réglage, jamais une règle du jeu.

Le deck se règle sur ces cibles. Ce sont des valeurs de départ, que la phase 4 transforme en tests.

| Sujet | Cible |
| --- | --- |
| Choix | Aucune option dominée. Pas plus de deux cartes subies de suite après la petite enfance |
| Variété | Une carte ne revient pas plus de trois fois dans une vie |
| Naissance | Une carte sur trois au moins lit la naissance, le logement ou les moyens |
| Revenus | La moitié des vies reste près de la carrière de référence. Une sur dix la double, une sur dix la perd de moitié |
| Mort | Moins d’une vie sur trois finit avant l’échéance, et cela dépend nettement du logement et des moyens |
| Aléa | Sur le même dé, le mieux protégé et le plus exposé sont séparés d’au moins 6 points sur 20 |
| Karma | Jamais plus de 2 points sur 20. Un karma haut se voit sur dix vies, pas sur une |
| Climat | Une vie exposée voit entre 8 et 15 cartes liées au climat |

Aujourd’hui, `npm test` simule 300 vies au hasard, 100 de saints et 100 d’égoïstes sur le deck de départ. Il vérifie que chaque carte est tirée et chaque issue atteinte, que les états restent valides, que les étapes arrivent à leur âge, que l’école suit la richesse du pays, que l’éducation suit le QI et que le karma suit la façon de jouer.

## 12. Ce que le jeu ne fait pas

- **On ne déménage pas.** Le lieu reste celui de la naissance.
- **On ne choisit pas son année de naissance.** Une naissance d’aujourd’hui atteint 2100 vers 74 ans. Après 2100, Stochia ne tire plus d’aléa : la vie continue sans cartes d’aléa, et le bilan le dit.
- **Une seule trajectoire climatique**, SSP2-4.5.
- **Trois aléas** : bulle de chaleur, raz-de-marée, tornade. Les tornades ne sont tirées qu’aux États-Unis. Les feux et d’autres catastrophes viendront avec Stochia.
- **Ni compte ni sauvegarde.** Les parties et le karma vivent dans la mémoire du filtre.
- **Aucune affirmation scientifique.** Les aléas sont tirés selon des probabilités, ne rejouent pas des catastrophes réelles, et ne sont pas validés.

## Annexe — Le deck de départ

Le dépôt contient 76 cartes et 11 types. Ce deck a servi à construire le moteur. Il est trop simple pour être réglé et sera réécrit en phase 4. Cette annexe décrit ce qu’il fait aujourd’hui.

| Type | Cartes | Dont sans choix | Exemples |
| --- | ---: | ---: | --- |
| `etape` (Étape de vie) | 10 | 6 | premiers pas, scolarisation, orientation, installation, naissance, retraite |
| `epreuve` (Épreuve) | 4 | 4 | bac, diplôme, premier emploi, recherche d’emploi |
| `rencontre` | 4 | 0 | ami d’enfance, premier amour, coup de foudre, mentor |
| `opportunite` (Opportunité) | 3 | 1 | recommandation, promotion, retour au travail |
| `pari` | 4 | 0 | créer son entreprise, placement en bourse, arrêter de fumer |
| `retour_de_baton` (Retour de bâton) | 6 | 4 | colis réclamé, panne de voiture, toux du fumeur |
| `dilemme` | 12 | 0 | première cigarette, triche, prêt à un ami, mutation |
| `chance` | 6 | 6 | loterie, prime, pension |
| `tuile` | 10 | 10 | bras cassé, grippe, licenciement |
| `choix` | 15 | 0 | école privée ou publique, vélo, vacances |
| `choix_mystere` (Choix mystère) | 2 | 0 | colis, voisin bruyant |

**Le fil principal** passe par les marques. `scolarisation` ou `ecole-privee-ou-publique` met à l’école (marque `ecole`). `orientation` mène au lycée, à l’apprentissage ou à l’arrêt (`lycee`, `apprentissage`, `fin_etudes`). `bac`, puis `apres-le-bac` et `diplome`, mènent aux études supérieures. `premier-emploi` puis `recherche-emploi` mènent au travail, `coup-de-foudre` au couple, `installation` et `naissance` à la famille, `retraite` à la retraite à partir de 62 ans.

**Les premiers pas dépendent du pays**, à 1 ou 2 ans. Dans un pays à revenu faible, `sur-le-dos` remplace `premiers-pas`, et `foot-au-village` revient une fois entre 4 et 8 ans, avec un texte différent en milieu rural et urbain.

**L’entrée à l’école dépend du pays**, à partir de 6 ans :

- Dans un pays à revenu élevé, `ecole-privee-ou-publique` fait choisir. Le privé donne 5 points d’éducation et coûte un peu de vie sociale. Avec des parents sous le 40e rang, ou de rang inconnu, la liste d’attente renvoie au public.
- Ailleurs, ou si le niveau est inconnu, `scolarisation` tire chaque année si les parents scolarisent l’enfant. La chance part de 0,4 en revenu faible, 0,85 en intermédiaire, 0,7 si inconnu, plus `(karma - 50) / 100` et un peu du rang des parents. Elle reste entre 0,1 et 0,95. À partir de 10 ans sans école, l’école ne viendra plus : les marques `pas_d_ecole` et `fin_etudes` sont posées, pour que le premier emploi reste possible.

**L’éducation** compte dans la note du `bac` et du `diplome`, et dans le score de `premier-emploi` et `recherche-emploi`. Une maladie ou un accident pendant la scolarité en retire un peu.

**Le karma** pèse sur quatre cartes. Au-dessus de 75, `karma-rend-la-monnaie` peut tomber. Au-dessous de 25, `karma-presente-la-note` coûte des amis, de l’argent ou du moral. Sous 45, à partir de 30 ans, `reparer-un-tort` offre de racheter une faute. Sur `premier-amour`, seul dé visible du deck, 10 de karma rachètent un jet.

**Ce qui est à garder** : les enchaînements par marques, comme la cigarette et la toux vingt ans plus tard, ou le colis gardé et le destinataire qui sonne. C’est le modèle à suivre pour le climat.
