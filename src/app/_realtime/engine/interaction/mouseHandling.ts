import React from "react";
import RealtimeInteractor from "./interactor";
import GlobalApp from "_realtime/engine/systems/GlobalApp";
import { objectIsClickable } from "_realtime/engine/components/clickable";
import FreecamEntity from "_realtime/camera/FreecamEntity";

export const handleMouseMove = (interactor: RealtimeInteractor, e: React.MouseEvent) => {
    if (GlobalApp.instance?.freecamActive) {
        FreecamEntity.instance?.handleMouseMove(
            e.movementX,
            e.movementY,
            interactor.draggingBtn,
            e.buttons
        );
        return;
    }

    interactor.updateRaycast(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * -2 + 1
    );
};

export const handleMouseDown = (interactor: RealtimeInteractor, e: React.MouseEvent) => {
    interactor.draggingBtn = e.button;
    interactor.clickStartPos.copy(interactor.interactionPos);

    if (GlobalApp.instance?.freecamActive) {
        FreecamEntity.instance?.handleMouseDown(e.button);
        return;
    }

    const target = interactor.getFirstHover();
    if (objectIsClickable(target)) {
        if (e.button === 0) target.leftClickDown();
        else if (e.button === 1) target.middleClickDown();
        else if (e.button === 2) target.rightClickDown();
    }
};

export const handleMouseUp = (interactor: RealtimeInteractor, e: React.MouseEvent) => {
    if (GlobalApp.instance?.freecamActive) {
        FreecamEntity.instance?.handleMouseUp(e.button);
        interactor.draggingBtn = -1;
        return;
    }

    const target = interactor.getFirstHover();
    if (objectIsClickable(target)) {
        if (e.button === 0) target.leftClickUp();
        else if (e.button === 1) target.middleClickUp();
        else if (e.button === 2) target.rightClickUp();
    }

    interactor.draggingBtn = -1;
};

export const handleWheelEvent = (interactor: RealtimeInteractor, e: WheelEvent) => {
    if (!GlobalApp.instance) return;
    if (!interactor.cameraControls) return;

    e.preventDefault();

    if (GlobalApp.instance.freecamActive) {
        FreecamEntity.instance?.handleWheel(e.deltaY);
        return;
    }

    //note - this is unreliable - if the user is scrolling fast, it will think it's a mouse
    const isMouse = Math.abs(e.deltaY) > 40 && Math.abs(e.deltaY) % 10 === 0;

    if (e.ctrlKey || isMouse) {
        interactor.cameraControls.offsetZoom(
            e.deltaY * (isMouse ? 0.5 : 4),
            (e.clientX / window.innerWidth) * 2 - 1,
            (e.clientY / window.innerHeight) * -2 + 1
        );
    } else {
        interactor.cameraControls.offsetPosition(e.deltaX, e.deltaY, 0);
    }
};
