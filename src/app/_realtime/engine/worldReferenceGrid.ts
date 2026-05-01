import * as THREE from "three";

/** Total span along each axis (cube from -half … +half). */
const EXTENT = 100;
/** Major grid spacing in world units. */
const STEP = 10;
/** Cross-section of non-axis grid lines (thin white rods). */
const LINE_THICK = 0.01;

/**
 * A 100×100×100 debug volume centered on the origin, with a 10 m grid of
 * thin box “lines”. Lines parallel to +X through the origin are red,
 * parallel to +Y green, parallel to +Z blue; all other lines are white.
 */
export function createWorldReferenceGrid(): THREE.Group {
    const group = new THREE.Group();
    group.name = "WorldReferenceGrid";

    const half = EXTENT * 0.5;
    const steps: number[] = [];
    for (let v = -half; v <= half + 1e-6; v += STEP) {
        steps.push(Math.round(v * 1000) / 1000);
    }

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
    // const redMat = new THREE.MeshBasicMaterial({ color: 0xe04040 });
    // const greenMat = new THREE.MeshBasicMaterial({ color: 0x40e040 });
    // const blueMat = new THREE.MeshBasicMaterial({ color: 0x4080ff });
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

    return group;
}
