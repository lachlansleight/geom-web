"use-client";

import * as THREE from "three";
import useAnimationFrame from "_lib/hooks/useAnimationFrame";
import useDimensions from "_lib/hooks/useDimensions";
import { useCallback, useEffect, useRef, useState } from "react";
import useCameraControls from "_realtime/engine/cameraControls";
import RealtimeInteractor from "_realtime/engine/interaction/interactor";
import useKeyboard from "_lib/hooks/useKeyboard";
import GlobalApp from "_realtime/engine/systems/GlobalApp";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import CameraOrbitEntity from "_realtime/camera/CameraOrbitEntity";
import GeomPatternManager from "_realtime/geom/patterns/GeomPatternManager";

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
    const patternManager = useRef<GeomPatternManager | null>(null);
    const [patternOverlay, setPatternOverlay] = useState<{
        name: string;
        index: number;
        total: number;
        key: number; // changes on each switch to retrigger animation
    } | null>(null);
    const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showPatternOverlay = useCallback((name: string, index: number, total: number) => {
        // Clear any existing timeout
        if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);

        // Show overlay (key change retriggers the CSS animation)
        setPatternOverlay({ name, index, total, key: Date.now() });

        // Hide after hold + fade duration (1.5s hold + 1s fade)
        overlayTimeoutRef.current = setTimeout(() => {
            setPatternOverlay(null);
        }, 2500);
    }, []);

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

        // Set up camera orbit controller
        const cameraOrbit = new CameraOrbitEntity();
        cameraOrbit.init();

        // Create and initialize GeomEntity
        const geomEntity = new GeomContainerEntity({
            initialWidth: screenDimensions.width,
            initialHeight: screenDimensions.height,
        });

        // Async init
        geomEntity
            .init()
            .then(() => {
                console.log("GeomEntity initialized successfully");

                // Create pattern manager after geom is ready
                const pm = new GeomPatternManager(cameraOrbit, geomEntity);
                pm.init();
                patternManager.current = pm;
                showPatternOverlay(pm.patterns[pm.currentIndex].name, pm.currentIndex, pm.patterns.length);
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

            // Pattern switching with arrow keys
            if (e.type === "keydown" && patternManager.current) {
                const pm = patternManager.current;
                if (e.key === "ArrowRight") {
                    pm.nextPattern();
                    showPatternOverlay(pm.patterns[pm.currentIndex].name, pm.currentIndex, pm.patterns.length);
                } else if (e.key === "ArrowLeft") {
                    pm.previousPattern();
                    showPatternOverlay(pm.patterns[pm.currentIndex].name, pm.currentIndex, pm.patterns.length);
                }
            }
        },
        [interactor, patternManager]
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
            {patternOverlay && (
                <div
                    key={patternOverlay.key}
                    className="fixed bottom-8 left-8 pointer-events-none font-jetbrains z-50"
                    style={{ animation: "patternOverlayFade 2.5s ease-out forwards" }}
                >
                    <div className="text-white text-lg tracking-widest uppercase opacity-90">
                        {patternOverlay.name}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                        {Array.from({ length: patternOverlay.total }, (_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full border border-white/60 ${
                                    i === patternOverlay.index ? "bg-white" : "bg-transparent"
                                }`}
                            />
                        ))}
                    </div>
                </div>
            )}

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
