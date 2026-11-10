const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rel = (p) => path.relative(root, p);
const declared = (lib) => {
  const pkg = require(`${lib}/package.json`);
  const field = pkg.peerDependencies?.lodash ? 'peerDependencies' : 'dependencies';
  return `${field} lodash@${pkg[field].lodash}`;
};

console.log(`Scénario : ${path.basename(root)}/${path.basename(__dirname)}`);
console.log('\nCe que chaque lib déclare :');
console.log('  lib1 :', declared('lib1'));
console.log('  lib2 :', declared('lib2'));

// L'app n'importe jamais lodash elle-même : elle ne fait que charger lib1 et lib2.
// Si une lib ne trouve pas son lodash, ça casse dès son chargement.
// (require en dur dans chaque appel, pour qu'esbuild embarque bien les libs)
const load = (name, req) => {
  try {
    const lib = req();
    console.log(`  ${name} : ok`);
    return lib;
  } catch (err) {
    console.log(`  ${name} : ✕ ${err.message.split('\n')[0]}`);
    return null;
  }
};
console.log('\nChargement des libs :');
const lib1 = load('lib1', () => require('lib1'));
const lib2 = load('lib2', () => require('lib2'));
if (!lib1 || !lib2) {
  console.log('\nL\'app ne peut pas démarrer.');
  process.exit(1);
}

const real1 = fs.realpathSync(lib1.lodashPath);
const real2 = fs.realpathSync(lib2.lodashPath);
console.log('\nCe que chaque lib charge réellement :');
console.log(`  lib1 : lodash ${lib1.lodash.VERSION}  (${rel(real1)})`);
console.log(`  lib2 : lodash ${lib2.lodash.VERSION}  (${rel(real2)})`);

// Chaque lib appelle une fonction qui dépend de la version majeure de lodash :
// depuis lodash 4, _.capitalize met le reste du mot en minuscules, et _.sumBy n'existe pas avant.
const check = (call, fn, expected) => {
  let result;
  try {
    result = JSON.stringify(fn());
  } catch (err) {
    console.log(`  ${call} : ✕ ${err.message}`);
    return;
  }
  const verdict = result === JSON.stringify(expected) ? 'ok' : `✕ attendu ${JSON.stringify(expected)}`;
  console.log(`  ${call} : ${result}  ${verdict}`);
};
console.log('\nCe que renvoient les libs :');
check("lib1.capitalizeAll(['hELLO', 'wORLD'])", () => lib1.capitalizeAll(['hELLO', 'wORLD']), ['HELLO', 'WORLD']);
check("lib2.sumBy([{ n: 2 }, { n: 3 }], 'n')", () => lib2.sumBy([{ n: 2 }, { n: 3 }], 'n'), 5);

console.log('\nMême fichier sur le disque :', real1 === real2);
console.log('Même instance en mémoire   :', lib1.lodash === lib2.lodash);
