const _ = require('lodash');

module.exports = {
  // Expose l'instance de lodash vue par cette lib, pour pouvoir la comparer
  lodash: _,
  lodashPath: require.resolve('lodash'),
  capitalizeAll: (words) => words.map(_.capitalize),
};
