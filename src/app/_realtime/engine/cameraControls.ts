import * as THREE from "three";
import useAnimationFrame from "_lib/hooks/useAnimationFrame";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GlobalApp from "./systems/GlobalApp";

export type CameraControlsConfig = {
    useDebugControls?: boolean;
    panSensitivity: number;
    zoomSensitivity: number;
    panLerpSpeed: number;
    zoomLerpSpeed: number;
    zoomBounds: {
        max: number;
        min: number;
    };
    cameraZ: number;
    isOrtho: boolean;
};

export type CameraControlsInterface = {
    offsetZoom: (deltaZoom: number, targetX?: number, targetY?: number) => void;
    offsetPosition: (deltaX: number, deltaY: number, deltaZ: number) => void;
};

const useCameraControls = (config?: Partial<CameraControlsConfig>) => {
    const fullConfig = useMemo<CameraControlsConfig>(() => {
        const defaultConfig: CameraControlsConfig = {
            panSensitivity: 1.5,
            zoomSensitivity: 3,
            panLerpSpeed: 0,
            zoomLerpSpeed: 0.000001,
            zoomBounds: {
                max: 25,
                min: 0.1,
            },
            cameraZ: 2,
            isOrtho: true,
        };
        return {
            ...defaultConfig,
            ...config,
        };
    }, [config]);
    const targetPos = useRef(new THREE.Vector3(0, 0, fullConfig.cameraZ));
    const targetZoom = useRef(1);
    const zoomCenter = useRef(new THREE.Vector2(0, 0));

    useEffect(() => {
        if (fullConfig.useDebugControls) {
            // flyControls.current = new FlyControls(
            //     world.camera as THREE.PerspectiveCamera,
            //     world.renderer.domElement
            // );
            // flyControls.current.movementSpeed = 2;
            // flyControls.current.rollSpeed = 2;
            // flyControls.current.dragToLook = true;
            // world.camera.current.update();
        }

        //Load cached camera setup
        const cameraSetup = null; //localStorage.getItem("cameraSetup");
        if (!cameraSetup) return;
        const setup = JSON.parse(cameraSetup);
        targetPos.current.x = setup.position.x;
        targetPos.current.y = setup.position.y;
        targetPos.current.z = setup.position.z;
        targetZoom.current = setup.zoom;
    }, [fullConfig, targetZoom]);

    const offsetZoom = useCallback(
        (delta: number, targetX?: number, targetY?: number) => {
            const mappedDelta = delta * -0.001 * fullConfig.zoomSensitivity;
            const newZoom = Math.max(
                fullConfig.zoomBounds.min,
                Math.min(fullConfig.zoomBounds.max, targetZoom.current * (1 + mappedDelta))
            );
            if (targetX != null && targetY != null) {
                zoomCenter.current.set(targetX, targetY);
            }
            targetZoom.current = newZoom;
        },
        [fullConfig, targetZoom, zoomCenter]
    );

    const offsetPosition = useCallback(
        (deltaX: number, deltaY: number, deltaZ: number) => {
            if (!GlobalApp.instance) return;

            targetPos.current.x +=
                (deltaX * fullConfig.panSensitivity) / GlobalApp.instance.orthoCam.zoom;
            targetPos.current.y -=
                (deltaY * fullConfig.panSensitivity) / GlobalApp.instance.orthoCam.zoom;
            targetPos.current.z +=
                (deltaZ * fullConfig.panSensitivity) / GlobalApp.instance.orthoCam.zoom;
        },
        [fullConfig]
    );

    useAnimationFrame(
        e => {
            if (!GlobalApp.instance) return;

            if (fullConfig.useDebugControls) {
                // flyControls.current?.update(e.time, e.delta);
                return;
            }

            if (fullConfig.panLerpSpeed > 0)
                GlobalApp.instance.orthoCam.position.lerp(
                    targetPos.current,
                    1 - Math.pow(fullConfig.panLerpSpeed, e.delta)
                );
            else GlobalApp.instance.orthoCam.position.copy(targetPos.current);

            if (fullConfig.zoomLerpSpeed > 0) {
                const newZoom = THREE.MathUtils.lerp(
                    GlobalApp.instance.orthoCam.zoom,
                    targetZoom.current,
                    1 - Math.pow(fullConfig.zoomLerpSpeed, e.delta)
                );
                //move position towards zoom center based on the zoom offset
                const zoomOffset = newZoom / GlobalApp.instance.orthoCam.zoom - 1;
                const offset = new THREE.Vector2();
                offset.copy(zoomCenter.current);
                // offset.subVectors(zoomCenter.current, new THREE.Vector2(0.5, 0.5));
                offset.multiplyScalar(zoomOffset);
                targetPos.current.x += offset.x;
                targetPos.current.y += offset.y;
                GlobalApp.instance.orthoCam.position.x += offset.x;
                GlobalApp.instance.orthoCam.position.y += offset.y;

                GlobalApp.instance.orthoCam.zoom = newZoom;
            } else {
                GlobalApp.instance.orthoCam.zoom = targetZoom.current;
            }

            GlobalApp.instance.orthoCam.updateProjectionMatrix();

            GlobalApp.instance.perspCam.position.copy(GlobalApp.instance.orthoCam.position);
            GlobalApp.instance.perspCam.rotation.copy(GlobalApp.instance.orthoCam.rotation);
            GlobalApp.instance.perspCam.zoom = GlobalApp.instance.orthoCam.zoom;
            GlobalApp.instance.perspCam.updateProjectionMatrix();
        },
        [targetZoom, targetPos, fullConfig]
    );

    const output: CameraControlsInterface = {
        offsetZoom,
        offsetPosition,
    };
    return output;
};

export default useCameraControls;
