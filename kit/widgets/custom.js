// I TUOI WIDGET: copia questo modello in un nuovo file (es. kit/widgets/lives.js) e aggiungilo
// in kit/widgets/index.js. Compare da solo nell'editor delle schermate, con le sue proprietà.
//
// export default {
//     label: 'Vite rimaste',
//     size: { width: 200, height: 40 },                   // riquadro nell'editor
//     props: [{ key: 'fontSize', label: 'Dimensione testo', type: 'number', default: 20 }],
//     create(scene, item, ctx) {
//         const c = scene.add.container(0, 0);             // la timeline muove/scala/sfuma questo oggetto
//         const t = scene.add.text(0, 0, '', { fontFamily: ctx.font, fontSize: `${item.props.fontSize}px` }).setOrigin(0.5);
//         c.add(t);
//         const update = () => t.setText(`♥ ${ctx.services.GAME_STATE.lives ?? 0}`);
//         update();
//         return { obj: c, update, refresh: update };      // ctx.emit('evento') per uscire dalla schermata
//     }
// };
export default null;
