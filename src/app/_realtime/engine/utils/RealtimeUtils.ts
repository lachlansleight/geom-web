import * as THREE from "three";

class RealtimeUtils {
    public static getBoxLineGeometry(width = 1, height = 1, depth = 1) {
        const w = width * 0.5;
        const h = height * 0.5;
        const d = depth * 0.5;
        const points = [
            new THREE.Vector3(-w, -h, -d),
            new THREE.Vector3(w, -h, -d),
            new THREE.Vector3(w, -h, -d),
            new THREE.Vector3(w, h, -d),
            new THREE.Vector3(w, h, -d),
            new THREE.Vector3(-w, h, -d),
            new THREE.Vector3(-w, h, -d),
            new THREE.Vector3(-w, -h, -d),

            new THREE.Vector3(-w, -h, d),
            new THREE.Vector3(w, -h, d),
            new THREE.Vector3(w, -h, d),
            new THREE.Vector3(w, h, d),
            new THREE.Vector3(w, h, d),
            new THREE.Vector3(-w, h, d),
            new THREE.Vector3(-w, h, d),
            new THREE.Vector3(-w, -h, d),

            new THREE.Vector3(-w, -h, d),
            new THREE.Vector3(-w, -h, -d),
            new THREE.Vector3(w, -h, d),
            new THREE.Vector3(w, -h, -d),
            new THREE.Vector3(w, h, d),
            new THREE.Vector3(w, h, -d),
            new THREE.Vector3(-w, h, d),
            new THREE.Vector3(-w, h, -d),
        ];
        return new THREE.BufferGeometry().setFromPoints(points);
    }
}

export default RealtimeUtils;
