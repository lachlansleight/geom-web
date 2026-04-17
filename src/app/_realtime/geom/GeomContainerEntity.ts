import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import * as THREE from "three";
import GeomEntity from "./GeomEntity";
import GeomParameterAnimator from "./animation/GeomParameterAnimator";
import AudioCapture from "_realtime/engine/systems/AudioCapture";

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
    // Dissolve (camera proximity)
    dissolveMin: number;
    dissolveMax: number;
    noiseScale: number;
    noiseStrength: number;
    /** 0 = uniform dissolve distance, 1 = dissolve distance drops to zero at camera sides */
    dissolveForwardBias: number;
    // Particle force field
    particleNoiseScale: number;
    particleForceStrength: number;
    particleRampTime: number;
    particleDamping: number;
    particleNoiseTimeScale: number;
    particleMinSize: number;
    particleShrinkTime: number;
    particleTranslationPerSecond: THREE.Vector3;
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
    huePerSecond: 0,
    saturationPerSecond: 0,
    brightnessPerSecond: 0,
    cubeFillPerSecond: 0,
    cubeHeightPerSecond: 0,
    cubeSpinPerSecond: new THREE.Vector3(0, 0, 0),
    metallic: 0.0,
    smoothness: 0.5,
    opacity: 1.0,
    dissolveMin: 5.0,
    dissolveMax: 12.0,
    noiseScale: 12,
    noiseStrength: 0.5,
    dissolveForwardBias: 0.9,
    particleNoiseScale: 0.3,
    particleForceStrength: 3,
    particleRampTime: 6.0,
    particleDamping: 0.1,
    particleNoiseTimeScale: 1,
    particleMinSize: 0.3,
    particleShrinkTime: 5.0,
    particleTranslationPerSecond: new THREE.Vector3(0, 0, 0),
};

export default class GeomContainerEntity extends RealtimeEntity {
    config: GeomConfig;
    geomEntity: GeomEntity;
    animator: GeomParameterAnimator;

    _primedForHueOffset: boolean = false;
    _silenceThreshold: number = 0.01;
    _silenceDurationRequirement: number = 0.5;
    _silenceDuration: number = 0;

    _hueOffset: number = 0.001;

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

        this.geomEntity.object3D.position.z = 0;

        if(AudioCapture.instance.active) {
            if(this._primedForHueOffset) {
                this._hueOffset += Math.random();
                this._primedForHueOffset = false;
                this._silenceDuration = 0;
            } else {
                if(AudioCapture.instance.momentary < this._silenceThreshold) {
                    this._silenceDuration += deltaTime;
                    if(this._silenceDuration > this._silenceDurationRequirement) {
                        this._primedForHueOffset = true;
                    }
                } else {
                    this._silenceDuration = 0;
                }
            }

            this.config.brightness = THREE.MathUtils.clamp((AudioCapture.instance.flicker - 0.1) / 0.9, 0, 1);
            this.config.hue = (AudioCapture.instance.pulse * 0.3 + 0.45) + AudioCapture.instance.flicker * 0.1;
            this.config.hue += this._hueOffset;
        }

        // Pass updated config to the GPU renderer
        this.geomEntity.config = this.config;
    }
}
