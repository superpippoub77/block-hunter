// Registro dei widget: un file per widget. Per aggiungerne uno crea il file e aggiungilo qui.
import coins from './coins.js';
import arcadeControls from './arcadeControls.js';
import language from './language.js';
import topTen from './topTen.js';
import menu from './menu.js';
import textCycle from './textCycle.js';
import custom from './custom.js';

export const WIDGETS = { coins, arcadeControls, language, topTen, menu, textCycle };
if (custom && custom.create) WIDGETS.custom = custom;
