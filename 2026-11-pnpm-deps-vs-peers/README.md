# dependencies vs peerDependencies, avec deux versions différentes

Une app consomme deux libs qui demandent chacune une version **différente et incompatible** du même paquet. Que fait pnpm selon que les libs le déclarent en `dependencies` ou en `peerDependencies` ?

Lodash n'est que le cobaye : `lib1` est une vieille lib qui demande `^3.10.0`, `lib2` une lib récente qui demande `^4.17.21` (aucune version ne satisfait les deux).

Chaque lib appelle une fonction qui a changé entre lodash 3 et 4, pour voir si elle tourne avec la bonne version :

- `lib1.capitalizeAll` passe chaque mot dans `_.capitalize`. Celle de lodash 3 ne touche qu'à la première lettre (`'hELLO'` → `HELLO`), celle de lodash 4 met aussi le reste en minuscules (`'hELLO'` → `Hello`). Avec la mauvaise version, aucune erreur : juste un résultat faux.
- `lib2.sumBy` appelle `_.sumBy`, qui n'existe que depuis lodash 4. Avec lodash 3, elle plante : `_.sumBy is not a function`.

```
├── deps/     ← lib1 et lib2 déclarent lodash en dependencies
│   └── lib1/  lib2/  app/
└── peers/    ← lib1 et lib2 déclarent lodash en peerDependencies
    └── lib1/  lib2/  app/  app-with-lodash/
```

Les deux `app/` sont identiques : elles ne dépendent que de `lib1` et `lib2`, et n'importent jamais lodash elles-mêmes. `peers/app-with-lodash/` est la même app après un `pnpm add lodash` : la réaction d'un consommateur face aux avertissements (voir plus bas).

Dans chaque scénario, les projets sont indépendants (pas de workspace) : les libs sont empaquetées en `.tgz`, puis l'app les installe comme des paquets publiés.

## Lancer

```bash
./run.sh
```

Ou un seul scénario : `./run.sh deps`, `./run.sh peers`. Le script empaquette les libs puis, pour chaque app du scénario, l'installe et lance `pnpm peers check` (les problèmes de peers, que `pnpm install` ne détaille pas), `pnpm start` (quel lodash chaque lib charge, et ce qu'elle renvoie) et `pnpm build` (combien de copies dans le bundle esbuild), même si l'app plante. Dans une app, `pnpm why:lodash` montre qui tire lodash.

## Résultats (pnpm 11.28.11)

|                                  | `deps/app`                   | `peers/app`                                                  | `peers/app-with-lodash`                                      |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Qui fournit lodash               | chaque lib, pour elle-même   | personne : c'est à l'app de le faire                         | l'app, une version pour tout le monde                        |
| `pnpm install`                   | rien à signaler              | réussit, avec un simple avertissement                        | réussit, avec un simple avertissement                        |
| `pnpm peers check`               | rien à signaler              | **échoue** : `conflicting peer lodash` (^3.10.0 et ^4.17.21) | **échoue** : `unmet peer lodash` (lib1 veut ^3.10.0)         |
| Copies dans `node_modules/.pnpm` | 2 (3.10.1 et 4.18.1)         | aucune                                                       | 1 (4.18.1)                                                   |
| lib1 (veut ^3.10.0) charge       | lodash 3.10.1                | **rien** : `Cannot find module 'lodash'`                     | **lodash 4.18.1**                                            |
| lib2 (veut ^4.17.21) charge      | lodash 4.18.1                | **rien** : `Cannot find module 'lodash'`                     | lodash 4.18.1                                                |
| `pnpm start`                     | marche, résultats corrects   | **plante** : l'app ne peut pas démarrer                      | marche, mais **lib1 se trompe** : `Hello` au lieu de `HELLO` |
| `pnpm build` (esbuild)           | 383 kb (lodash 3 + lodash 4) | **échoue** : `Could not resolve "lodash"`                    | 224 kb (lodash 4 seul)                                       |

- **`dependencies`** : c'est la lib qui décide. Chaque lib obtient une version de sa plage, sans bruit. Le prix : deux copies sur le disque, dans le bundle et en mémoire. Gênant dès que le paquet a un état ou une identité à partager (React, un singleton, un `instanceof`).
- **`peerDependencies`** : la lib ne fournit pas lodash, elle compte sur l'app pour le faire.
  - Si l'app ne le fournit pas (`peers/app`), pnpm ne peut pas combler le manque, puisqu'aucune version ne convient aux deux libs. L'installation réussit quand même, avec un simple avertissement : le problème n'éclate qu'au démarrage et au build.
  - Si l'app le fournit (`peers/app-with-lodash`), sa version sert aux deux libs, même si elle ne leur convient pas : lib1 tourne avec lodash 4 et se trompe sans rien dire.

Quand les plages se recouvrent (par exemple `^4.17.0` et `^4.17.21`), la différence s'efface : pnpm résout les deux vers la même version et il n'y a qu'une copie dans les deux cas.

## Variantes du scénario `peers`

Les deux apps de `peers/` sont dans le tableau des résultats. Celui ci-dessous donne les variantes qui n'ont pas leur dossier : mêmes libs, mais un autre réglage de pnpm ou un autre choix du consommateur.

|                                  | `peers/app` avec `strictPeerDependencies: true`                          | `peers/app-with-lodash` après `pnpm add lodash@3`          |
| -------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Qui fournit lodash               | personne : c'est à l'app de le faire                                     | l'app, une version pour tout le monde                      |
| `pnpm install`                   | **échoue** (`ERR_PNPM_PEER_DEP_ISSUES`), mais seulement la première fois | réussit, avec un simple avertissement                      |
| `pnpm peers check`               | **échoue** : `conflicting peer lodash` (^3.10.0 et ^4.17.21)             | **échoue** : `unmet peer lodash` (lib2 veut ^4.17.21)      |
| Copies dans `node_modules/.pnpm` | aucune                                                                   | 1 (3.10.1)                                                 |
| lib1 (veut ^3.10.0) charge       | **rien** : `Cannot find module 'lodash'`                                 | lodash 3.10.1                                              |
| lib2 (veut ^4.17.21) charge      | **rien** : `Cannot find module 'lodash'`                                 | **lodash 3.10.1**                                          |
| `pnpm start`                     | **plante** : l'app ne peut pas démarrer                                  | marche, mais **lib2 plante** : `_.sumBy is not a function` |
| `pnpm build` (esbuild)           | **échoue** : `Could not resolve "lodash"`                                | 163 kb (lodash 3 seul)                                     |

Comme les apps du dépôt, aucune variante ne fait marcher les deux libs.

### Côté pnpm

Aucun réglage ne règle le conflit. `strictPeerDependencies` le fait éclater dès l'installation, mais une seule fois : l'installation qui échoue a déjà rempli `node_modules` et écrit le lockfile. `pnpm start` se lance donc quand même, et les installations suivantes réussissent sans un mot, même `pnpm install --frozen-lockfile` en CI, puisque pnpm ne refait pas la résolution (voir les Notes). Si ce lockfile est commité, le garde-fou ne sert plus à rien. Le garde-fou fiable, c'est `pnpm peers check` : il relit le lockfile et échoue (code 1) à chaque lancement tant que le conflit existe. C'est lui qu'il faut mettre en CI.

pnpm 11 lit ses réglages dans `pnpm-workspace.yaml` (`strictPeerDependencies: true`, `autoInstallPeers: false`, `overrides`…), en ligne de commande (`--config.strict-peer-dependencies=true`) ou en variable d'environnement (`pnpm_config_strict_peer_dependencies=true`). Il ignore le reste :

- `.npmrc`, sans prévenir ;
- le champ `"pnpm"` du `package.json`, en ne prévenant que pour certaines clés (`pnpm.overrides` oui, `pnpm.strictPeerDependencies` non) ;
- les champs `overrides` (format npm) et `resolutions` (format Yarn) du `package.json`, sans prévenir.

Tout est fait avec `autoInstallPeers: true`, le réglage par défaut : quand personne ne fournit une peer, pnpm l'installe lui-même, à condition qu'une version convienne à toutes les libs. En cas de conflit, il ne peut donc rien faire. C'est lui qui installe le lodash partagé quand les plages se recouvrent ; ce lodash sert aux libs, mais l'app ne peut pas l'importer, puisqu'elle ne le déclare pas. Avec `autoInstallPeers: false`, ce cas-là plante aussi, faute de lodash.

### Côté consommateur

Fournir lodash, c'est le réflexe face à l'avertissement de pnpm, et ce que demandent les peerDependencies. Mais l'app ne peut en fournir qu'une version : avec `pnpm add lodash` (`peers/app-with-lodash`), lib1 casse ; avec `pnpm add lodash@3` (dernière colonne du tableau), c'est lib2. Pour la voir : `pnpm add lodash@3` dans `peers/app-with-lodash`, puis `pnpm start` (et `pnpm add lodash` pour revenir).

Le consommateur ne règle donc pas le conflit : il choisit quelle lib en fait les frais. Son seul indice est `pnpm peers check`, qui désigne la lib mal servie (`unmet peer lodash`) : `pnpm install` se contente d'un avertissement générique, puis plus rien une fois le lockfile à jour. La suite se joue hors de son `package.json` : mettre à jour cette lib si une version accepte lodash 4 ; sinon garder le risque en testant ce qu'il en utilise, remplacer la lib, ou signaler le problème à son auteur.

Un override ne règle rien non plus. Celui-ci, dans `pnpm-workspace.yaml`, est bien appliqué (il apparaît dans le lockfile) :

```yaml
overrides:
  lib1>lodash: ^3.10.0
  lib2>lodash: ^4.17.21
```

Mais les deux libs reçoivent toujours le lodash de l'app, ou rien s'il n'y en a pas : une peer se résout avec ce que fournit l'app, et l'app n'en a qu'un. Sur une peer, un override ne change que la plage demandée : `lib1>lodash: ^4.17.0` fait taire `pnpm peers check`, mais lib1 se trompe toujours. Sur une dépendance, en revanche, il force bien la version : dans `deps/app`, `lib1>lodash: 4.18.1` ne laisse qu'une copie de lodash.

Avec `dependencies`, ce conflit ne remonte jamais jusqu'au consommateur : chaque lib a sa copie.

Il existe des contournements qui réécrivent le manifeste des libs à l'installation, comme un hook `readPackage` dans `.pnpmfile.cjs` qui repasse lodash en `dependencies` (`packageExtensions`, qui ajoute lodash aux `dependencies` des libs sans retirer la peer, ne suffit pas : la peer reste prioritaire). Mais ils supposent de connaître le fonctionnement interne des libs : c'est un dernier recours, pas un geste de consommateur.

## Notes

- `pnpm install` ne signale les problèmes de peers qu'au moment de la résolution : quand le lockfile est déjà à jour, il n'affiche rien. Pour les retrouver :
  - `pnpm peers check` les liste à partir du lockfile, et sort en code 1 (`--json` pour une sortie lisible par un script) ;
  - `pnpm install --resolution-only` relance la résolution sans toucher au lockfile ni à `node_modules`, et réaffiche l'avertissement de la première installation. Avec `--strict-peer-dependencies` en plus, il détaille le problème et échoue (code 1), comme `peers check` ;
  - `pnpm dedupe --check` le réaffiche aussi, puisqu'il refait la résolution ;
  - `pnpm install --force` réinstalle tout, mais ne le réaffiche pas, pas plus que `pnpm ls` ou `pnpm why`.
- Quand lodash est fourni (`peers/app-with-lodash`, ou des plages qui se recouvrent), les dossiers des libs dans `node_modules/.pnpm/` portent un suffixe (`lib1@..._lodash@4.18.1`) : c'est la peer dependency contre laquelle cette copie de la lib a été résolue.
- Si on retire lodash d'une app déjà installée, l'ancien dossier `node_modules/.pnpm/lodash@…` reste sur le disque : pnpm garde quelque temps les paquets orphelins en cache. Il n'est relié à aucune lib : l'app plante quand même.
- Après une modification d'une lib, il faut la rempaqueter et la réinstaller, ce que fait `./run.sh` : l'app en a une copie, pas un lien vers ses sources. pnpm détecte que le contenu du tarball a changé, même si la `version` est restée la même.
- `app/pnpm-workspace.yaml` ne déclare aucun workspace : c'est simplement le fichier de réglages pnpm du projet. Il autorise ici le script d'installation d'esbuild (`allowBuilds`, ce qu'écrit `pnpm approve-builds esbuild`), sans quoi `pnpm install` échoue sur `ERR_PNPM_IGNORED_BUILDS`.
- Le champ `packageManager` du `package.json` de chaque app fixe la version de pnpm : un pnpm installé dans une autre version bascule tout seul sur celle-ci. Les libs ne l'ont pas : seul compte le champ du projet où l'on lance pnpm, et `pnpm pack` le retire de toute façon du tarball.
