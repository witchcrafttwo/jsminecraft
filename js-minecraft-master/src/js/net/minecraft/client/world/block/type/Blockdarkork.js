import BoundingBox from "../../../../util/BoundingBox.js";
import Block from "../Block.js";

export default class Blockdarkork extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);

        this.boundingBox = new BoundingBox(0.0, 0.0, 0.0, 1.0, 0.5, 1.0);

        // Sound
        this.sound = Block.sounds.wood;
    }

    getOpacity() {
        return 0.0;
    }

}
