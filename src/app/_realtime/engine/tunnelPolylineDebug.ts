import * as THREE from "three";
import type GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import { TUNNEL_POLYLINE_Z_SAMPLES } from "_realtime/geom/TunnelPolylineService";

const SEGMENT_COUNT = TUNNEL_POLYLINE_Z_SAMPLES - 1;
const ROD_THICK = 0.12;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Draws the GPU-sampled tunnel floor as a chain of thin box segments in world
 * space (bright yellow), so you can compare it to the WebGPU tunnel render.
 */
export default class TunnelPolylineDebug {
    readonly group: THREE.Group;
    private readonly segments: THREE.Mesh[] = [];
    private readonly tmpA = new THREE.Vector3();
    private readonly tmpB = new THREE.Vector3();
    private readonly tmpDir = new THREE.Vector3();
    private readonly tmpMid = new THREE.Vector3();
    private readonly quat = new THREE.Quaternion();
    private readonly flipAxis = new THREE.Vector3(1, 0, 0);

    constructor(scene: THREE.Scene) {
        this.group = new THREE.Group();
        this.group.name = "TunnelPolylineDebug";

        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffdd33,
            depthTest: true,
            transparent: true,
            opacity: 0.95,
        });

        for (let i = 0; i < SEGMENT_COUNT; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            mesh.name = `TunnelSeg_${i}`;
            this.segments.push(mesh);
            this.group.add(mesh);
        }

        scene.add(this.group);
    }

    dispose(): void {
        this.group.parent?.remove(this.group);
        const first = this.segments[0];
        if (first) {
            first.geometry.dispose();
            (first.material as THREE.Material).dispose();
        }
    }

    update(geom: GeomContainerEntity | null): void {
        const buf = geom?.tunnelPolylineLatest;
        if (!buf || buf.length < TUNNEL_POLYLINE_Z_SAMPLES * 4) {
            for (const m of this.segments) m.visible = false;
            return;
        }

        for (let i = 0; i < SEGMENT_COUNT; i++) {
            const o = i * 4;
            const ax = buf[o];
            const ay = buf[o + 1];
            const az = buf[o + 2];
            const aw = buf[o + 3];
            const bx = buf[o + 4];
            const by = buf[o + 5];
            const bz = buf[o + 6];
            const bw = buf[o + 7];

            const mesh = this.segments[i];
            if (aw < 0.5 || bw < 0.5 || !Number.isFinite(ax + bx)) {
                mesh.visible = false;
                continue;
            }

            this.tmpA.set(ax, ay, az);
            this.tmpB.set(bx, by, bz);
            this.tmpDir.subVectors(this.tmpB, this.tmpA);
            const len = this.tmpDir.length();
            if (len < 1e-4) {
                mesh.visible = false;
                continue;
            }

            this.tmpDir.multiplyScalar(1 / len);
            this.tmpMid.addVectors(this.tmpA, this.tmpB).multiplyScalar(0.5);

            mesh.visible = true;
            mesh.position.copy(this.tmpMid);
            mesh.scale.set(ROD_THICK, len, ROD_THICK);

            if (this.tmpDir.dot(UP) > 0.9999) {
                mesh.quaternion.identity();
            } else if (this.tmpDir.dot(UP) < -0.9999) {
                mesh.quaternion.setFromAxisAngle(this.flipAxis, Math.PI);
            } else {
                this.quat.setFromUnitVectors(UP, this.tmpDir);
                mesh.quaternion.copy(this.quat);
            }
        }
    }
}
