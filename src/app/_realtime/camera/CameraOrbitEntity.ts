import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GlobalApp from "_realtime/engine/systems/GlobalApp";
import Oscillator, { OscillatorShape } from "_realtime/geom/animation/Oscillator";

export interface CameraOrbitConfig {
    /** Center point the camera orbits around */
    orbitCenter: THREE.Vector3;
    /** How much to look at the orbit center (0 = no rotation, 1 = fully facing center) */
    lookAtAmount: number;
    /** Whether oscillation is active */
    playing: boolean;
    /** Radius oscillator: distance from orbit center */
    radius: { center: number; amplitude: number; period: number; phase: number };
    /** Theta oscillator: horizontal orbit angle (degrees) */
    theta: { center: number; amplitude: number; period: number; phase: number };
    /** Phi oscillator: vertical orbit angle (degrees) */
    phi: { center: number; amplitude: number; period: number; phase: number };
}

const DEFAULT_CONFIG: CameraOrbitConfig = {
    orbitCenter: new THREE.Vector3(0, 0, 50),
    lookAtAmount: 1.0,
    playing: true,
    radius: { center: 12, amplitude: 4, period: 25, phase: 0 },
    theta: { center: 0, amplitude: 30, period: 35, phase: 0.25 },
    phi: { center: 0, amplitude: 30, period: 40, phase: 0.5 },
};

/**
 * Orbits the perspective camera around a center point using three oscillators
 * (spherical coordinates: radius, theta, phi).
 *
 * Theta and phi are in degrees in the config, converted to radians internally.
 * The camera looks toward the orbit center, blended by lookAtAmount.
 */
export default class CameraOrbitEntity extends RealtimeEntity {
    config: CameraOrbitConfig;

    oscillatorRadius: Oscillator;
    oscillatorTheta: Oscillator;
    oscillatorPhi: Oscillator;

    constructor(config: Partial<CameraOrbitConfig> = {}) {
        super();
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            orbitCenter: config.orbitCenter ?? DEFAULT_CONFIG.orbitCenter.clone(),
        };
        this.object3D.name = "CameraOrbit";

        this.oscillatorRadius = new Oscillator({
            shape: OscillatorShape.Sine,
            ...this.config.radius,
        });
        this.oscillatorTheta = new Oscillator({
            shape: OscillatorShape.Sine,
            ...this.config.theta,
        });
        this.oscillatorPhi = new Oscillator({
            shape: OscillatorShape.Sine,
            ...this.config.phi,
        });
    }

    init(): void {
        super.init();
    }

    update(_time: number, deltaTime: number): void {
        if (!this.config.playing) return;

        const camera = GlobalApp.instance?.perspCam;
        if (!camera) return;

        // Advance oscillators
        this.oscillatorRadius.update(deltaTime);
        this.oscillatorTheta.update(deltaTime);
        this.oscillatorPhi.update(deltaTime);

        // Evaluate spherical coordinates
        const radius = this.oscillatorRadius.getValue();
        const theta = this.oscillatorTheta.getValue() * (Math.PI / 180);
        const phi = this.oscillatorPhi.getValue() * (Math.PI / 180);

        // Spherical to cartesian (matching Unity's convention from the source)
        const x = Math.cos(theta) * Math.sin(phi);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(theta);

        const center = this.config.orbitCenter;
        camera.position.set(
            center.x + radius * x,
            center.y + radius * y,
            center.z + radius * z,
        );

        // LookAt with blend
        if (this.config.lookAtAmount > 0) {
            const lookTarget = new THREE.Quaternion();
            const lookMatrix = new THREE.Matrix4().lookAt(camera.position, center, new THREE.Vector3(0, 1, 0));
            lookTarget.setFromRotationMatrix(lookMatrix);

            camera.quaternion.slerp(lookTarget, this.config.lookAtAmount);
        }
    }
}
