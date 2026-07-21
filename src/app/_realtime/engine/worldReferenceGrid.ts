import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GlobalApp from "_realtime/engine/systems/GlobalApp";

/** Total span along each axis (cube from -half … +half). */
const EXTENT = 200;
/** Major grid spacing in world units — also the wrap period for infinite scroll. */
export const WORLD_REFERENCE_GRID_STEP = 10;
/** Cross-section of non-axis grid lines (thin white rods). */
const LINE_THICK = 0.01;

/** Keep `v` in (-period/2, period/2], preserving residual past the snap. */
function wrapNearOrigin(v: number, period: number): number {
    return v - Math.round(v / period) * period;
}

/**
 * A 100×100×100 debug volume centered on the origin, with a 10 m grid of
 * thin box “lines”. Lines parallel to +X through the origin are red,
 * parallel to +Y green, parallel to +Z blue; all other lines are white.
 *
 * Scrolls with the active pattern's translationPerSecond and wraps by one
 * grid cell so it looks continuous without drifting far from the origin.
 */
export default class WorldReferenceGridEntity extends RealtimeEntity {
    private getTranslationPerSecond: () => THREE.Vector3;

    constructor(getTranslationPerSecond: () => THREE.Vector3) {
        super();
        this.getTranslationPerSecond = getTranslationPerSecond;
        this.object3D.name = "WorldReferenceGrid";
        buildGridMeshes(this.object3D);
    }

    init(): void {
        super.init();
        GlobalApp.instance.scene.add(this.object3D);
    }

    update(_time: number, deltaTime: number): void {
        const tps = this.getTranslationPerSecond();

        this.object3D.position.x += tps.x * deltaTime;
        this.object3D.position.y += tps.y * deltaTime;
        this.object3D.position.z += tps.z * deltaTime;

        const step = WORLD_REFERENCE_GRID_STEP;
        this.object3D.position.x = wrapNearOrigin(this.object3D.position.x, step);
        this.object3D.position.y = wrapNearOrigin(this.object3D.position.y, step);
        this.object3D.position.z = wrapNearOrigin(this.object3D.position.z, step);
    }
}

function buildGridMeshes(group: THREE.Object3D): void {
    const half = EXTENT * 0.5;
    const steps: number[] = [];
    for (let v = -half; v <= half + 1e-6; v += WORLD_REFERENCE_GRID_STEP) {
        steps.push(Math.round(v * 1000) / 1000);
    }

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x151515 });

    const geoX = new THREE.BoxGeometry(EXTENT, LINE_THICK, LINE_THICK);
    const geoY = new THREE.BoxGeometry(LINE_THICK, EXTENT, LINE_THICK);
    const geoZ = new THREE.BoxGeometry(LINE_THICK, LINE_THICK, EXTENT);

    const add = (mesh: THREE.Mesh) => {
        mesh.frustumCulled = false;
        group.add(mesh);
    };

    for (const y of steps) {
        for (const z of steps) {
            const onXAxis = Math.abs(y) < 1e-5 && Math.abs(z) < 1e-5;
            const mesh = new THREE.Mesh(geoX, onXAxis ? redMat : whiteMat);
            mesh.position.set(0, y, z);
            add(mesh);
        }
    }

    for (const x of steps) {
        for (const z of steps) {
            const onYAxis = Math.abs(x) < 1e-5 && Math.abs(z) < 1e-5;
            const mesh = new THREE.Mesh(geoY, onYAxis ? greenMat : whiteMat);
            mesh.position.set(x, 0, z);
            add(mesh);
        }
    }

    for (const x of steps) {
        for (const y of steps) {
            const onZAxis = Math.abs(x) < 1e-5 && Math.abs(y) < 1e-5;
            const mesh = new THREE.Mesh(geoZ, onZAxis ? blueMat : whiteMat);
            mesh.position.set(x, y, 0);
            add(mesh);
        }
    }
}
