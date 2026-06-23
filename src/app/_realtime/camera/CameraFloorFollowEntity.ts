import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GlobalApp from "_realtime/engine/systems/GlobalApp";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";

export interface CameraFloorFollowConfig {
    /** How far below the floor to park the camera (positive moves camera further down from the floor). */
    verticalOffset: number;
    /**
     * Distance-to-target error halves every this many seconds (exponential decay).
     * Frame-rate independent: uses `1 - exp(-ln(2) * dt / halfLifeSeconds)` per step.
     */
    halfLifeSeconds: number;
    /** How far ahead (in +Z) of the probe ring centre to look at. */
    lookAtAhead: number;
    /** Camera Z plane the floor probe samples at. */
    cameraZ: number;
    /** Maximum XY units the camera may move in a single second (anti-snap clamp). */
    maxSpeed: number;
    /**
     * Camera quaternion blends toward lookAt(camera → SetNow ring centre) with this half-life (seconds).
     * Use 0 to snap rotation each frame.
     */
    lookRotationHalfLifeSeconds: number;
}

const DEFAULT_CONFIG: CameraFloorFollowConfig = {
    verticalOffset: 1.5,
    halfLifeSeconds: 0.5,
    lookAtAhead: 8,
    cameraZ: 80,
    maxSpeed: 60,
    lookRotationHalfLifeSeconds: 0.35,
};

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Camera controller that pins the perspective camera at a fixed world Z
 * plane and drives its X/Y to sit on the geom ring's sampled floor.
 *
 * Rotation interpolates toward looking at the **current SetNow ring centre**
 * (same `object3D` world position that feeds the GPU slice transform), driven
 * by the oscillation system on the CPU — no GPU readback for look direction.
 */
export default class CameraFloorFollowEntity extends RealtimeEntity {
    config: CameraFloorFollowConfig;

    /** When false, update() is a no-op. */
    enabled: boolean = false;

    private geom: GeomContainerEntity | null = null;

    /** Smoothed camera position; lerps toward the latest probe sample. */
    private smoothedX: number = 0;
    private smoothedY: number = 0;
    private hasInitialSample: boolean = false;

    /** First full frame after enable: snap rotation to target, then blend. */
    private rotationInitialized: boolean = false;

    private readonly circleCenterWorld = new THREE.Vector3();
    private readonly lookMatrix = new THREE.Matrix4();
    private readonly targetQuat = new THREE.Quaternion();

    constructor(config: Partial<CameraFloorFollowConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.object3D.name = "CameraFloorFollow";
    }

    init(): void {
        super.init();
    }

    /** Wire up the geom container so we can read its floor probe. */
    setGeomContainer(geom: GeomContainerEntity): void {
        this.geom = geom;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.hasInitialSample = false;
            this.rotationInitialized = false;
        }
    }

    applyConfig(config: Partial<CameraFloorFollowConfig>): void {
        this.config = { ...this.config, ...config };
        if (this.geom?.geomEntity) {
            this.geom.geomEntity.floorProbeCameraZ = this.config.cameraZ;
        }
    }

    update(_time: number, deltaTime: number): void {
        if (!this.enabled) return;
        if (!this.geom) return;

        const camera = GlobalApp.instance?.perspCam;
        if (!camera) return;

        const geomObj = this.geom.geomEntity.object3D;
        geomObj.updateMatrixWorld(true);
        geomObj.getWorldPosition(this.circleCenterWorld);

        const probe = this.geom.floorProbe;
        const sample = probe?.latest ?? null;

        if (sample?.exists) {
            const targetX = sample.x;
            const targetY = sample.y + this.config.verticalOffset;

            if (!this.hasInitialSample) {
                this.smoothedX = targetX;
                this.smoothedY = targetY;
                this.hasInitialSample = true;
            } else {
                const halfLife = Math.max(this.config.halfLifeSeconds, 1e-4);
                const t = 1 - Math.exp((-Math.LN2 * Math.max(deltaTime, 0)) / halfLife);
                let dx = (targetX - this.smoothedX) * t;
                let dy = (targetY - this.smoothedY) * t;

                const maxStep = this.config.maxSpeed * Math.max(deltaTime, 0);
                const stepLen = Math.hypot(dx, dy);
                if (stepLen > maxStep && stepLen > 0) {
                    const scale = maxStep / stepLen;
                    dx *= scale;
                    dy *= scale;
                }

                this.smoothedX += dx;
                this.smoothedY += dy;
            }

            camera.position.x = this.smoothedX;
            camera.position.y = this.smoothedY;
        }

        camera.position.z = this.config.cameraZ;

        // Look toward SetNow ring centre (world origin of current slice transform).
        this.lookMatrix.lookAt(camera.position, this.circleCenterWorld, WORLD_UP);
        this.targetQuat.setFromRotationMatrix(this.lookMatrix);

        if (!this.rotationInitialized) {
            camera.quaternion.copy(this.targetQuat);
            this.rotationInitialized = true;
        } else {
            const rotHalf = this.config.lookRotationHalfLifeSeconds;
            if (rotHalf <= 1e-6) {
                camera.quaternion.copy(this.targetQuat);
            } else {
                const t = 1 - Math.exp((-Math.LN2 * Math.max(deltaTime, 0)) / rotHalf);
                camera.quaternion.slerp(this.targetQuat, t);
            }
        }
    }
}
