declare module "troika-three-utils" {
    import { Mesh } from "three";
    export class BezierMesh extends Mesh {
        constructor();
        pointA: Vector3;
        pointB: Vector3;
        controlA: Vector3;
        controlB: Vector3;
        radius: number;
        dashArray: Vector2;
        dashOffset: number;
    }
}
