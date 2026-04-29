import Block from "../Block.js";

export default class BlockWhiteTorch extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);

        // Sound
        this.sound = Block.sounds.stone;
    }

    getLightValue() {
        return 14;
    }

}
