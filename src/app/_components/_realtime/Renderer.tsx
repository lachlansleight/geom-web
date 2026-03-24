"use-client";

import * as THREE from "three";
import useAnimationFrame from "_lib/hooks/useAnimationFrame";
import useDimensions from "_lib/hooks/useDimensions";
import { useEffect, useRef, useState } from "react";
import useCameraControls from "_realtime/engine/cameraControls";
import RealtimeInteractor from "_realtime/engine/interaction/interactor";
import useKeyboard from "_lib/hooks/useKeyboard";
import GlobalApp from "_realtime/engine/systems/GlobalApp";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";

export type RealtimeHoverTarget = {
    type: "node" | "port" | "connection";
    nodeId?: string;
    portId?: string;
    connectionId?: string;
    direction?: "in" | "out";
};
const Renderer = (): JSX.Element => {
    const [hasGlobalAppInstance, setHasGlobalAppInstance] = useState(false);
    const screenDimensions = useDimensions();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const interactor = useRef<RealtimeInteractor | null>(null);
    const [cursor, setCursor] = useState("");

    const cameraControls = useCameraControls({
        useDebugControls: false,
        panSensitivity: 0.0015,
        isOrtho: false, // Using perspective for GEOM
        cameraZ: 10, // Position camera further back for perspective view
    });

    // Set up the wheel event - this needs to be done in this strange way due to not being able to
    // override the event by default with react due to reasons
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            interactor.current?.handleWheelEvent(e);
        };

        if (!canvasRef.current) return;

        const crc = canvasRef.current;
        crc.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            crc.removeEventListener("wheel", handleWheel);
        };
    }, [canvasRef]);

    // Set up the three.js scene, camera and renderer
    useEffect(() => {
        if (!canvasRef.current || screenDimensions.width <= 0) return;
        if (hasGlobalAppInstance) return;

        console.log("INITIALIZING GLOBAL APP");

        const scene = new THREE.Scene();
        // scene.background = new THREE.Color("rgb(20, 20, 25)");
        scene.background = new THREE.Color("rgb(10, 10, 13)");
        const cameraSize = {
            x: 0.001 * screenDimensions.width,
            y: 0.001 * screenDimensions.height,
        };
        const orthoCam = new THREE.OrthographicCamera(
            -cameraSize.x * 0.5,
            cameraSize.x * 0.5,
            cameraSize.y * 0.5,
            -cameraSize.y * 0.5,
            0.1,
            200
        );
        const perspCam = new THREE.PerspectiveCamera(
            75,
            screenDimensions.width / screenDimensions.height,
            0.1,
            1000
        );
        // camera.position.z = 100;
        // const camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.1, 10000 );
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current!,
            antialias: true,
        });

        renderer.setSize(screenDimensions.width, screenDimensions.height);

        // Uncomment this line to enable an occasionally useful inspector that can be used to interactively inspect objects
        // createInspector(canvasRef.current, {
        //     scene,
        //     camera,
        //     renderer,
        // });

        try {
            new GlobalApp(renderer, orthoCam, perspCam, scene);
            setHasGlobalAppInstance(true);
        } catch (e: any) {
            console.log("global app already exists, why are we we-triggering this?");
        }
    }, [hasGlobalAppInstance, screenDimensions, canvasRef]);

    useEffect(() => {
        if (!hasGlobalAppInstance) return;
        GlobalApp.instance.renderer.setSize(screenDimensions.width, screenDimensions.height);
    }, [hasGlobalAppInstance, screenDimensions]);

    // Set up the raycaster
    useEffect(() => {
        if (!cameraControls) return;
        if (!interactor.current) {
            interactor.current = new RealtimeInteractor();
            interactor.current.cameraControls = cameraControls;
            interactor.current.setCursor = setCursor;
        }
    }, [interactor, cameraControls]);

    // Create GEOM entity when GlobalApp is ready
    useEffect(() => {
        if (!hasGlobalAppInstance) return;

        console.log("Global App instance is initialised - creating GeomEntity");

        // Use perspective camera for GEOM
        GlobalApp.instance.renderOrthographic = false;

        // Position camera to view the geometry
        GlobalApp.instance.perspCam.position.set(0, 0, 10);
        GlobalApp.instance.perspCam.lookAt(0, 0, 0);

        // Create and initialize GeomEntity
        const geomEntity = new GeomContainerEntity({
            saturation: 1,
            translationPerSecond: new THREE.Vector3(0, 0, 10),
            // Pass dimensions from parent
            initialWidth: screenDimensions.width,
            initialHeight: screenDimensions.height,
        });

        // Position the GeomEntity
        geomEntity.object3D.position.set(0, 0, 0);

        // Async init
        geomEntity
            .init()
            .then(() => {
                console.log("GeomEntity initialized successfully");
            })
            .catch(err => {
                console.error("Failed to initialize GeomEntity:", err);
            });
        // Note: we only want to create GeomEntity once, so we only depend on hasGlobalAppInstance
        // The dimensions are captured at creation time
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasGlobalAppInstance]);

    useKeyboard(
        (e: KeyboardEvent) => {
            if (!interactor.current) return;
            interactor.current.handleKey(e);
        },
        [interactor]
    );

    // Render!
    useAnimationFrame(
        ({ time, delta }) => {
            if (!hasGlobalAppInstance) return;

            Object.values(GlobalApp.instance.entities).forEach((entity: RealtimeEntity) => {
                entity.update(time, delta);
            });

            // Render scene
            GlobalApp.instance.renderer.render(
                GlobalApp.instance.scene,
                GlobalApp.instance.renderOrthographic
                    ? GlobalApp.instance.orthoCam
                    : GlobalApp.instance.perspCam
            );
        },
        [hasGlobalAppInstance, interactor]
    );

    return (
        <div
            className={`h-screen w-screen overflow-hidden`}
            style={{
                cursor: cursor,
            }}
        >
            <canvas
                width={screenDimensions.width}
                height={screenDimensions.height}
                ref={canvasRef}
                onMouseDown={e => {
                    interactor.current?.handleMouseEvent(e);
                }}
                onMouseUp={e => {
                    interactor.current?.handleMouseEvent(e);
                }}
                onMouseMove={e => {
                    interactor.current?.handleMouseEvent(e);
                }}
                onContextMenu={e => {
                    e.preventDefault();
                }}
            />
        </div>
    );
};

export default Renderer;
