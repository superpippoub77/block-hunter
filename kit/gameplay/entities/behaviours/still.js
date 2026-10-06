// Fermo: non si muove (trappole, torrette, ostacoli che fanno danno al contatto).
export default {
    label: 'Fermo',
    params: [],
    init(scene, s) { s.body.setVelocity(0, 0); s.body.setImmovable(true); },
    update() { }
};
