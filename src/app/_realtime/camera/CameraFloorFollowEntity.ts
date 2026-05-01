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
    /** How far ahead (in +Z) of the probe ring centre to look. */
    lookAtAhead: number;
    /** Camera Z plane the probe is sampled at. */
    cameraZ: number;
    /** Maximum XY units the camera may move in a single second (anti-snap clamp). */
    maxSpeed: number;
}

const DEFAULT_CONFIG: CameraFloorFollowConfig = {
    verticalOffset: 1.5,
    halfLifeSeconds: 0.5,
    lookAtAhead: 8,
    cameraZ: 80,
    maxSpeed: 60,
};

/** Fixed orientation: identity × rotateY(π) — camera looks along -Z in world space. */
const FLOOR_FOLLOW_QUAT = new THREE.Quaternion(0, 1, 0, 0);

/**
 * Camera controller that pins the perspective camera at a fixed world Z
 * plane and drives its X/Y to sit just under the geom ring's "floor"
 * (lowest world-Y point of the ring at that Z plane).
 *
 * The floor is sampled on the GPU by `FloorProbeService` (owned by the
 * GeomEntity); we simply read its latest sample each frame, smooth it,
 * and update the camera. Look direction blends toward a point a few
 * units further down the tunnel for a nicer forward feel.
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
            // Drop initial-sample flag so a re-enable will snap to the next probe.
            this.hasInitialSample = false;
        }
    }

    applyConfig(config: Partial<CameraFloorFollowConfig>): void {
        this.config = { ...this.config, ...config };
        // Make sure the geom probe samples at the configured Z plane.
        if (this.geom?.geomEntity) {
            this.geom.geomEntity.floorProbeCameraZ = this.config.cameraZ;
        }
    }

    update(_time: number, deltaTime: number): void {
        if (!this.enabled) return;
        if (!this.geom) return;

        const camera = GlobalApp.instance?.perspCam;
        if (!camera) return;

        const probe = this.geom.floorProbe;
        const sample = probe?.latest ?? null;

        if (!sample || !sample.exists) {
            // No probe data yet: leave camera where it is (or initialise once).
            return;
        }

        const targetX = sample.x;
        const targetY = sample.y + this.config.verticalOffset;

        if (!this.hasInitialSample) {
            this.smoothedX = targetX;
            this.smoothedY = targetY;
            this.hasInitialSample = true;
        } else {
            // Half-life smoothing: fraction of remaining error closed per frame.
            const halfLife = Math.max(this.config.halfLifeSeconds, 1e-4);
            const t = 1 - Math.exp((-Math.LN2 * Math.max(deltaTime, 0)) / halfLife);
            let dx = (targetX - this.smoothedX) * t;
            let dy = (targetY - this.smoothedY) * t;

            // Anti-snap clamp on per-frame XY delta.
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

        camera.position.set(this.smoothedX, this.smoothedY, this.config.cameraZ);

        // Fixed world rotation for now: 180° about Y (local forward ≈ -world Z).
        camera.rotation.set(0, 0, 0);
        // camera.quaternion.copy(FLOOR_FOLLOW_QUAT);
    }
}
