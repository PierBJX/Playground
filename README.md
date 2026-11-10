# playground

Dossier d'expérimentation : un sous-dossier par test, indépendant des autres.

## Conventions

- Nom du dossier : `AAAA-MM-sujet-court` (ex. `2026-11-essai-sqlite-wasm`)
- Dépendances isolées par dossier (`package.json`, `.venv`… propres à chaque test)
- Une ligne dans le tableau ci-dessous par test, avec la conclusion

## Tests

| Dossier | Sujet | Conclusion |
| ------- | ----- | ---------- |
| [2026-11-pnpm-deps-vs-peers](2026-11-pnpm-deps-vs-peers/) | pnpm : deux libs qui demandent des versions incompatibles d'un même paquet, en dependencies vs en peerDependencies | dependencies : chaque lib a sa version, donc deux copies. peerDependencies : si l'app ne fournit pas lodash, l'installation réussit avec un simple avertissement et l'app plante au démarrage ; si elle le fournit (`pnpm add lodash`), elle ne peut en choisir qu'une version et l'une des libs casse |
