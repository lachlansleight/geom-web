import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import Hoverable from "../components/hoverable";
import GlobalApp from "../systems/GlobalApp";

// Basic example class that demonstrates how to implement component interfaces,
// create object child entities, and link to the Global App
class ExampleEntity extends RealtimeEntity implements Hoverable {
    isHoverable: true = true;
    isHovered: boolean = false;

    constructor() {
        super();
    }

    init() {
        super.init();

        this.object3D.name = "Example Object";
        GlobalApp.instance.scene.add(this.object3D);
        this.object3D.position.set(0, 0, 0);

        const geo = new THREE.BoxGeometry(1, 1, 1);
        const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x6a4b2c }));
        body.userData.entity = this;
        body.name = "CubeGeometry";
        this.object3D.add(body);
    }

    hover() {
        console.log("Example entity hover on");
    }

    unhover() {
        console.log("Example entity hover off");
    }
}

export default ExampleEntity;
