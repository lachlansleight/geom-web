import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import * as THREE from "three";
import GeomEntity from "./GeomEntity";
import GeomParameterAnimator from "./animation/GeomParameterAnimator";

export interface GeomConfig {
    sliceCount: number;
    cubeCount: number;
    radius: number;
    spread: number;
    cubeFill: number;
    cubeHeight: number;
    cubeSpin: THREE.Vector3;
    radiusCrunch: number;
    hue: number;
    saturation: number;
    brightness: number;
    cubeRotateAmount: THREE.Vector3;
    endCrunchSlices: number;
    // Animation
    translationPerSecond: THREE.Vector3;
    rotationPerSecond: THREE.Vector3;
    scalingPerSecond: THREE.Vector3;
    radiusPerSecond: number;
    spreadPerSecond: number;
    huePerSecond: number;
    saturationPerSecond: number;
    brightnessPerSecond: number;
    cubeFillPerSecond: number;
    cubeHeightPerSecond: number;
    cubeSpinPerSecond: THREE.Vector3;
    // Rendering
    metallic: number;
    smoothness: number;
    opacity: number;
    // Canvas dimensions (passed from parent)
    initialWidth?: number;
    initialHeight?: number;
}

const DEFAULT_CONFIG: GeomConfig = {
    sliceCount: 1000,
    cubeCount: 64,
    radius: 2.0,
    spread: 1.0,
    cubeFill: 0.5,
    cubeHeight: 1.0,
    cubeSpin: new THREE.Vector3(0, 0, 0),
    radiusCrunch: 1.0,
    hue: 0.0,
    saturation: 1.0,
    brightness: 1.0,
    cubeRotateAmount: new THREE.Vector3(0, 0, 1),
    endCrunchSlices: 3,
    translationPerSecond: new THREE.Vector3(0, 0, 0),
    rotationPerSecond: new THREE.Vector3(0, 0, 0),
    scalingPerSecond: new THREE.Vector3(1, 1, 1),
    radiusPerSecond: 0,
    spreadPerSecond: 0,
    huePerSecond: 0.1,
    saturationPerSecond: 0,
    brightnessPerSecond: 0,
    cubeFillPerSecond: 0,
    cubeHeightPerSecond: 0,
    cubeSpinPerSecond: new THREE.Vector3(0, 0, 0),
    metallic: 0.0,
    smoothness: 0.5,
    opacity: 1.0,
};

export default class GeomContainerEntity extends RealtimeEntity {
    config: GeomConfig;
    geomEntity: GeomEntity;
    animator: GeomParameterAnimator;

    constructor(config: Partial<GeomConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.geomEntity = new GeomEntity(this.config);
        this.animator = new GeomParameterAnimator();

        // Parent the animator under our Object3D for scene hierarchy
        this.object3D.add(this.animator.object3D);
    }

    async init(): Promise<void> {
        super.init();
        this.animator.init();
        this.geomEntity.init();
    }

    update(time: number, deltaTime: number): void {
        // The animator is registered in GlobalApp and gets its own update() call.
        // We just read the values it computed this frame (one-frame latency is fine
        // for slow-moving animation parameters).
        this.animator.applyToConfig(this.config, this.geomEntity.object3D);

        // this.geomEntity.object3D.position.copy(new THREE.Vector3(0, 0, -30));
        this.geomEntity.object3D.position.z = -100;

        // Pass updated config to the GPU renderer
        this.geomEntity.config = this.config;
    }
}
