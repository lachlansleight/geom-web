import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import * as THREE from "three";

//Note - this class is basically a global class that can be used throughout the app by reference
class GlobalApp {
    static instance: GlobalApp;
    static hasInstance = false;

    renderer: THREE.WebGLRenderer;
    orthoCam: THREE.OrthographicCamera;
    perspCam: THREE.PerspectiveCamera;

    scene: THREE.Scene;
    others?: any;

    entities: Record<string, RealtimeEntity> = {};

    renderOrthographic = true;

    constructor(
        renderer: THREE.WebGLRenderer,
        orthoCam: THREE.OrthographicCamera,
        perspCam: THREE.PerspectiveCamera,
        scene: THREE.Scene
    ) {
        if (GlobalApp.hasInstance) {
            throw new Error("Global App instance already exists");
        }

        GlobalApp.instance = this;
        GlobalApp.hasInstance = true;

        this.renderer = renderer;
        this.orthoCam = orthoCam;
        this.perspCam = perspCam;
        this.scene = scene;
        this.entities = {};
    }
}

export default GlobalApp;
