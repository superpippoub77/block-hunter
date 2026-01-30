// Level 4 - sublevel 2 (level42)
// 9 cols x 7 rows — claustrophobic chamber with a ring of holes
window.LEVEL_MAP = {
  cols: 9,
  rows: 7,
  map: [
    ['sand1','sand2','sand3','sand4','sand5','sand6','sand7','sand8','sand9'],
    ['sand2','sand3','sand4','sand5','hole' ,'hole' ,'sand6','sand7','sand8'],
    ['sand3','sand4','sand5','hole' ,'sandPile','hole' ,'sand7','sand8','sand9'],
    ['sand4','sand5','hole' ,'sandPile','sandPile','sandPile','hole' ,'sand9','sand1'],
    ['sand5','hole' ,'sandPile','sandPile','hole' ,'sand7','sand8','sand9','sand2'],
    ['sand6','sand7','sand8','sand9','sand1','sand2','sand3','sand4','sand5'],
    ['sand7','sand8','sand9','sand1','sand2','sand3','sand4','sand5','sand6']
  ]
};
