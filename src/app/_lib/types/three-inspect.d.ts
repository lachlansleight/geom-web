declare module "three-inspect/vanilla" {
    import { Scene, Camera, Renderer } from "three";

    export function createInspector(
        element: HTMLElement,
        config: {
            scene: Scene;
            camera: Camera;
            renderer: Renderer;
        }
    );
}
