import * as THREE from "three";
import RealtimeEntity from "../entities/realtimeEntity";
import { CameraControlsInterface } from "../cameraControls";
import GlobalApp from "../systems/GlobalApp";
import { handleMouseDown, handleMouseMove, handleMouseUp, handleWheelEvent } from "./mouseHandling";
import { handleKey } from "./keyHandling";
import { HoverableEntity, objectIsHoverable } from "_realtime/engine/components/hoverable";

class RealtimeInteractor {
    raycaster: THREE.Raycaster;
    interactionPos: THREE.Vector3 = new THREE.Vector3();
    cameraControls?: CameraControlsInterface;
    hoverStack: RealtimeEntity[];
    hoveredObject: HoverableEntity | null = null;

    worldPos: THREE.Vector3 = new THREE.Vector3();
    clickStartPos: THREE.Vector3 = new THREE.Vector3();
    draggingBtn = -1;
    shiftHeld = false;
    lastWheelEvent = 0;

    //we set this to true when the user is editing text to avoid performing all manner of strange shortcuts
    ignoreKeyboard = false;

    setCursor: (cursorName: string) => void = () => {};

    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.hoverStack = [];
    }

    public getFirstHover() {
        if (this.hoverStack.length === 0) return null;
        return this.hoverStack[0];
    }

    updateRaycast(mouseX: number, mouseY: number) {
        this.raycaster.setFromCamera(
            new THREE.Vector2(mouseX, mouseY),
            GlobalApp.instance.orthoCam
        );
        const intersects = this.raycaster.intersectObjects(
            GlobalApp.instance.scene.children.filter(c => c.visible)
        );
        intersects.sort((a, b) => a.distance - b.distance);
        //const preStackLength = this.hoverStack.length;
        this.hoverStack = intersects
            .filter(i => !!i.object.userData.entity)
            .map(o => o.object.userData.entity as RealtimeEntity);
        //if (this.hoverStack.length !== preStackLength) console.log(this.hoverStack);
        this.interactionPos = this.raycaster.ray.origin.clone();
        this.interactionPos.z = 0;

        //nothing grabbed, instead we update the hovered object
        const hoverCandidates = this.hoverStack.filter(objectIsHoverable);
        //if(hoverCandidates.length > 0) console.log(hoverCandidates);
        if (hoverCandidates.length > 0) {
            const newHover = hoverCandidates[0] as HoverableEntity;
            if (newHover !== this.hoveredObject) {
                if (this.hoveredObject) this.hoveredObject.unhover();
                newHover.hover();
                this.hoveredObject = newHover;
            }
        } else if (this.hoveredObject) {
            this.hoveredObject.unhover();
            this.hoveredObject = null;
        }
    }

    handleMouseEvent(e: React.MouseEvent) {
        if (!GlobalApp.instance) return;

        e.preventDefault();
        e.stopPropagation();

        switch (e.type) {
            case "mousemove":
                handleMouseMove(this, e);
                break;
            case "mousedown":
                handleMouseDown(this, e);
                break;
            case "mouseup":
                handleMouseUp(this, e);
                break;
        }
    }

    handleWheelEvent(e: WheelEvent) {
        handleWheelEvent(this, e);
    }

    handleKey(e: KeyboardEvent) {
        if (this.ignoreKeyboard) return;
        handleKey(this, e);
    }

    update() {}
}

export default RealtimeInteractor;
