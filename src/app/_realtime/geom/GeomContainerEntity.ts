import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import * as THREE from "three";
import GeomEntity from "./GeomEntity";
import { Perlin } from "ts-noise";
import { Vector2 } from "_lib/types/Vector2";

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
    sliceCount: 200,
    cubeCount: 32,
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
    perlin: Perlin;
    geomEntity: GeomEntity;

    constructor(config: Partial<GeomConfig> = {}) {
        super();
        this.perlin = new Perlin(Date.now() * 0.001);
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.geomEntity = new GeomEntity(this.config);
    }

    async init(): Promise<void> {
        super.init();

        this.geomEntity.init();
    }

    update(time: number, deltaTime: number): void {
        let noiseA = this.perlin.get2(new Vector2(time * 0.2, 0));
        let noiseB = this.perlin.get2(new Vector2(time * 0.5, 0.8));
        let noiseC = this.perlin.get2(new Vector2(time * 0.5, 0.2));
        let noiseD = this.perlin.get2(new Vector2(time * 0.5, 12.435));
        this.config.radius = noiseA * 3 + 3.5;
        this.config.cubeFill = noiseB * 0.6 + 0.3;
        // this.config.radius = (0.5 * Math.sin(time * 2.5) + 0.5) * 1.0 + 2.5;
        this.geomEntity.object3D.position.x = (noiseC - 0) * 16.0;
        this.geomEntity.object3D.position.y = (noiseD - 0) * 9.0;
        this.geomEntity.object3D.rotation.z = time * 0.7;

        this.geomEntity.config = this.config;
    }
}
