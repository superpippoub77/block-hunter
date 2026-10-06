// Registro degli effetti: ogni file della cartella esporta una mappa id → effetto.
// Per aggiungere una famiglia nuova crea il file e aggiungilo qui sotto.
import entrances from './entrances.js';
import exits from './exits.js';
import moves from './moves.js';
import loops from './loops.js';
import actions from './actions.js';
import custom from './custom.js';

const all = [entrances, exits, moves, loops, actions, custom];

export const EFFECTS = {};
export const ACTIONS = {};
all.forEach((family) => Object.entries(family || {}).forEach(([id, fx]) => {
    if (fx.kind === 'action') ACTIONS[id] = fx;
    else EFFECTS[id] = fx;
}));
