import GlobalApp from "_realtime/engine/systems/GlobalApp";
import * as THREE from "three";

class RealtimeEntity {
    objectId: string;
    object3D: THREE.Object3D;

    constructor() {
        this.objectId = THREE.MathUtils.generateUUID();
        this.object3D = new THREE.Object3D();
        this.object3D.userData.entityId = this.objectId;
    }

    init(data?: any) {
        GlobalApp.instance.entities[this.objectId] = this;
    }

    update(deltaTime: number) {}

    destroy() {
        console.log("Removing", this.object3D);
        GlobalApp.instance.scene.remove(this.object3D);
        delete GlobalApp.instance.entities[this.objectId];
    }
}

export default RealtimeEntity;
