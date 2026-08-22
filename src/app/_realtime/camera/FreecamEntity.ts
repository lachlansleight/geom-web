import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GlobalApp from "_realtime/engine/systems/GlobalApp";

export type SavedCameraLocation = {
    timestamp: string;
    position: { x: number; y: number; z: number };
    quaternion: { x: number; y: number; z: number; w: number };
    orbitCenter: { x: number; y: number; z: number };
    radius: number;
    theta: number;
    phi: number;
    zoom: number;
};

const SAVED_LOCATIONS_KEY = "savedCameraLocations";

/** Radians of orbit per pixel of left-drag */
const ORBIT_SENSITIVITY = 0.002;
/** Fraction of orbit radius panned per pixel of middle-drag */
const PAN_SENSITIVITY = 0.0006;
/** Log-radius change per wheel delta unit */
const ZOOM_SENSITIVITY = 0.0012;
/** Left+right chord drag: 500px of vertical movement halves/doubles the zoom */
const FOCAL_ZOOM_SENSITIVITY = Math.LN2 / 500;

// Damping rates (per second) — higher is snappier. Applied as 1 - exp(-rate * dt).
const ORBIT_DAMPING = 3;
const PAN_DAMPING = 3;
const ZOOM_DAMPING = 1;
const FOCAL_ZOOM_DAMPING = 4;
/** How quickly fly velocity approaches its target (accel and decel) */
const MOVE_DAMPING = 3;

const BASE_FLY_SPEED = 12; // units per second
const FAST_FLY_MULTIPLIER = 5;

const MIN_RADIUS = 0.25;
const MAX_RADIUS = 800;

const MIN_FOCAL_ZOOM = 0.1;
const MAX_FOCAL_ZOOM = 20;
/** Keep phi away from the poles so lookAt never degenerates */
const PHI_EPSILON = 0.05;

/**
 * Manual orbit/fly camera, toggled from the header.
 *
 * While enabled it takes exclusive control of the perspective camera (the
 * pattern camera entities and the ortho->persp copy in cameraControls check
 * GlobalApp.freecamActive and stand down).
 *
 * Controls:
 *  - left drag: orbit around the center point
 *  - middle drag: pan the orbit center in the camera plane
 *  - wheel: dolly (change orbit radius)
 *  - left+right drag up/down: focal zoom (perspCam.zoom), 500px = half/double
 *  - hold right: fly with WASD (+ space up, ctrl/Q down, shift = 5x speed).
 *    Mouse-look while flying rotates about the camera; the orbit center stays
 *    pinned at the current radius along the view direction so orbit controls
 *    remain sensible afterwards.
 *  - p: append the current camera state to localStorage.savedCameraLocations
 */
export default class FreecamEntity extends RealtimeEntity {
    static instance: FreecamEntity | null = null;

    enabled = false;

    /** Returns the active pattern's orbit center to seed from, or null */
    private getSeedCenter: () => THREE.Vector3 | null;

    // Target state (moved by input) and smoothed state (applied to the camera)
    private targetCenter = new THREE.Vector3();
    private center = new THREE.Vector3();
    private targetTheta = 0;
    private theta = 0;
    private targetPhi = Math.PI / 2;
    private phi = Math.PI / 2;
    private targetLogRadius = Math.log(20);
    private logRadius = Math.log(20);
    private targetLogZoom = 0;
    private logZoom = 0;

    private velocity = new THREE.Vector3();
    private flying = false;
    private keys = new Set<string>();

    constructor(getSeedCenter: () => THREE.Vector3 | null) {
        super();
        this.object3D.name = "Freecam";
        this.getSeedCenter = getSeedCenter;
        FreecamEntity.instance = this;
    }

    setEnabled(enabled: boolean): void {
        if (enabled === this.enabled) return;
        this.enabled = enabled;
        if (GlobalApp.instance) GlobalApp.instance.freecamActive = enabled;
        if (enabled) {
            this.captureFromCamera();
        } else {
            this.flying = false;
            this.keys.clear();
            this.velocity.set(0, 0, 0);
        }
    }

    /** Seed orbit state from wherever the camera currently is, so enabling
     *  freecam doesn't move the view at all. */
    private captureFromCamera(): void {
        const camera = GlobalApp.instance?.perspCam;
        if (!camera) return;

        const seed = this.getSeedCenter();
        let center: THREE.Vector3;
        if (seed && seed.distanceTo(camera.position) > 0.1) {
            center = seed.clone();
        } else {
            // No meaningful orbit center (e.g. floor-follow pattern) — pin one
            // a fixed distance along the current view direction.
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            center = camera.position.clone().addScaledVector(forward, 20);
        }

        const offset = camera.position.clone().sub(center);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        this.theta = this.targetTheta = spherical.theta;
        this.phi = this.targetPhi = THREE.MathUtils.clamp(
            spherical.phi,
            PHI_EPSILON,
            Math.PI - PHI_EPSILON
        );
        this.logRadius = this.targetLogRadius = Math.log(
            THREE.MathUtils.clamp(spherical.radius, MIN_RADIUS, MAX_RADIUS)
        );
        this.center.copy(center);
        this.targetCenter.copy(center);
        this.logZoom = this.targetLogZoom = Math.log(
            THREE.MathUtils.clamp(camera.zoom, MIN_FOCAL_ZOOM, MAX_FOCAL_ZOOM)
        );
        this.velocity.set(0, 0, 0);
    }

    handleMouseDown(button: number): void {
        if (!this.enabled) return;
        if (button === 2) this.flying = true;
    }

    handleMouseUp(button: number): void {
        if (button === 2) {
            this.flying = false;
            this.keys.clear();
        }
    }

    handleMouseMove(deltaX: number, deltaY: number, draggingBtn: number, buttons: number): void {
        if (!this.enabled) return;

        // Left+right chord: slow focal zoom. Drag up to zoom in, down to zoom
        // out; 500px doubles/halves. Takes priority over orbit and mouse-look.
        if ((buttons & 1) !== 0 && (buttons & 2) !== 0) {
            this.targetLogZoom = THREE.MathUtils.clamp(
                this.targetLogZoom - deltaY * FOCAL_ZOOM_SENSITIVITY,
                Math.log(MIN_FOCAL_ZOOM),
                Math.log(MAX_FOCAL_ZOOM)
            );
            return;
        }

        if (draggingBtn === 0) {
            // Orbit around the center
            this.targetTheta -= deltaX * ORBIT_SENSITIVITY;
            this.targetPhi = THREE.MathUtils.clamp(
                this.targetPhi - deltaY * ORBIT_SENSITIVITY,
                PHI_EPSILON,
                Math.PI - PHI_EPSILON
            );
        } else if (draggingBtn === 1) {
            // Pan the orbit center in the camera plane, scaled by distance
            const camera = GlobalApp.instance?.perspCam;
            if (!camera) return;
            const scale = Math.exp(this.targetLogRadius) * PAN_SENSITIVITY;
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            this.targetCenter.addScaledVector(right, -deltaX * scale);
            this.targetCenter.addScaledVector(up, deltaY * scale);
        } else if (draggingBtn === 2) {
            // Mouse-look: rotate about the camera, not the center. Keep the
            // target camera position fixed and move the center to stay pinned
            // at the current radius along the new view direction.
            const radius = Math.exp(this.targetLogRadius);
            const oldDir = new THREE.Vector3().setFromSphericalCoords(
                radius,
                this.targetPhi,
                this.targetTheta
            );
            const cameraPos = this.targetCenter.clone().add(oldDir);

            this.targetTheta -= deltaX * ORBIT_SENSITIVITY;
            this.targetPhi = THREE.MathUtils.clamp(
                this.targetPhi - deltaY * ORBIT_SENSITIVITY,
                PHI_EPSILON,
                Math.PI - PHI_EPSILON
            );

            const newDir = new THREE.Vector3().setFromSphericalCoords(
                radius,
                this.targetPhi,
                this.targetTheta
            );
            this.targetCenter.copy(cameraPos).sub(newDir);
        }
    }

    handleWheel(deltaY: number): void {
        if (!this.enabled) return;
        this.targetLogRadius = THREE.MathUtils.clamp(
            this.targetLogRadius + deltaY * ZOOM_SENSITIVITY,
            Math.log(MIN_RADIUS),
            Math.log(MAX_RADIUS)
        );
    }

    handleKey(e: KeyboardEvent): void {
        if (!this.enabled) return;
        const capitalKey = (e.key === " " ? "SPACE" : e.key).toUpperCase();

        if (e.type === "keydown") {
            if (capitalKey === "P") {
                this.saveCurrentLocation();
                return;
            }
            this.keys.add(capitalKey);
            // While flying, keep movement keys from scrolling the page etc.
            if (this.flying) e.preventDefault();
        } else {
            this.keys.delete(capitalKey);
        }
    }

    saveCurrentLocation(): void {
        const camera = GlobalApp.instance?.perspCam;
        if (!camera) return;

        const entry: SavedCameraLocation = {
            timestamp: new Date().toISOString(),
            position: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
            },
            quaternion: {
                x: camera.quaternion.x,
                y: camera.quaternion.y,
                z: camera.quaternion.z,
                w: camera.quaternion.w,
            },
            orbitCenter: {
                x: this.targetCenter.x,
                y: this.targetCenter.y,
                z: this.targetCenter.z,
            },
            radius: Math.exp(this.targetLogRadius),
            theta: this.targetTheta,
            phi: this.targetPhi,
            zoom: camera.zoom,
        };

        let store: Record<string, SavedCameraLocation> = {};
        try {
            store = JSON.parse(localStorage.getItem(SAVED_LOCATIONS_KEY) ?? "{}");
        } catch {
            store = {};
        }
        const key = String(Date.now());
        store[key] = entry;
        localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(store));
        console.log(`Saved camera location ${key}`, entry);
    }

    update(_time: number, deltaTime: number): void {
        if (!this.enabled) return;
        const camera = GlobalApp.instance?.perspCam;
        if (!camera) return;

        // Fly movement: build a target velocity from held keys (camera-local),
        // then damp actual velocity toward it so starts/stops are smooth.
        const targetVelocity = new THREE.Vector3();
        if (this.flying) {
            const local = new THREE.Vector3(
                (this.keys.has("D") ? 1 : 0) - (this.keys.has("A") ? 1 : 0),
                (this.keys.has("SPACE") || this.keys.has("E") ? 1 : 0) -
                    (this.keys.has("CONTROL") || this.keys.has("Q") ? 1 : 0),
                (this.keys.has("S") ? 1 : 0) - (this.keys.has("W") ? 1 : 0)
            );
            if (local.lengthSq() > 0) {
                const speed =
                    BASE_FLY_SPEED * (this.keys.has("SHIFT") ? FAST_FLY_MULTIPLIER : 1);
                local.normalize().multiplyScalar(speed);
                targetVelocity.copy(local).applyQuaternion(camera.quaternion);
            }
        }
        this.velocity.lerp(targetVelocity, 1 - Math.exp(-MOVE_DAMPING * deltaTime));
        if (this.velocity.lengthSq() > 1e-8) {
            // Move center and smoothed center together: the orbit pivot stays
            // pinned to the camera while flying.
            const step = this.velocity.clone().multiplyScalar(deltaTime);
            this.targetCenter.add(step);
            this.center.add(step);
        }

        // Damped interpolation toward targets
        const orbitBlend = 1 - Math.exp(-ORBIT_DAMPING * deltaTime);
        this.theta += (this.targetTheta - this.theta) * orbitBlend;
        this.phi += (this.targetPhi - this.phi) * orbitBlend;
        this.logRadius +=
            (this.targetLogRadius - this.logRadius) * (1 - Math.exp(-ZOOM_DAMPING * deltaTime));
        this.center.lerp(this.targetCenter, 1 - Math.exp(-PAN_DAMPING * deltaTime));

        const offset = new THREE.Vector3().setFromSphericalCoords(
            Math.exp(this.logRadius),
            this.phi,
            this.theta
        );
        camera.position.copy(this.center).add(offset);
        camera.up.set(0, 1, 0);
        camera.lookAt(this.center);

        this.logZoom +=
            (this.targetLogZoom - this.logZoom) * (1 - Math.exp(-FOCAL_ZOOM_DAMPING * deltaTime));
        camera.zoom = Math.exp(this.logZoom);
        camera.updateProjectionMatrix();
    }
}
