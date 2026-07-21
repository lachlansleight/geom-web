"use-client";

import * as THREE from "three";
import useAnimationFrame from "_lib/hooks/useAnimationFrame";
import useDimensions from "_lib/hooks/useDimensions";
import { useCallback, useEffect, useRef, useState } from "react";
import useCameraControls from "_realtime/engine/cameraControls";
import RealtimeInteractor from "_realtime/engine/interaction/interactor";
import useKeyboard from "_lib/hooks/useKeyboard";
import GlobalApp from "_realtime/engine/systems/GlobalApp";
import WorldReferenceGridEntity from "_realtime/engine/worldReferenceGrid";
import TunnelPolylineDebug from "_realtime/engine/tunnelPolylineDebug";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import CameraOrbitEntity from "_realtime/camera/CameraOrbitEntity";
import CameraFloorFollowEntity from "_realtime/camera/CameraFloorFollowEntity";
import GeomPatternManager from "_realtime/geom/patterns/GeomPatternManager";
import SkyGradientEntity from "_realtime/sky/SkyGradientEntity";

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
    const geomContainerRef = useRef<GeomContainerEntity | null>(null);
    const tunnelPolylineDebugRef = useRef<TunnelPolylineDebug | null>(null);
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

    // The hook returns a fresh interface each render, but the pattern manager and
    // the debounced zoom save are created once — route them through a ref.
    const cameraControlsRef = useRef(cameraControls);
    useEffect(() => {
        cameraControlsRef.current = cameraControls;
    }, [cameraControls]);

    // Persist the current mousewheel zoom into the current pattern's
    // camera.defaultZoom in patterns.json (dev only, debounced).
    const zoomSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const saveCurrentZoom = useCallback(() => {
        const pm = patternManager.current;
        if (!pm) return;
        const zoom = Number(cameraControlsRef.current.getZoom().toFixed(4));
        const pattern = pm.patterns[pm.currentIndex];
        if (pattern.camera.defaultZoom === zoom) return;
        // Keep the in-memory pattern in sync so switching away and back uses
        // the new zoom without waiting for the file round-trip.
        pattern.camera.defaultZoom = zoom;
        fetch("/api/patterns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: pm.currentIndex, defaultZoom: zoom }),
        }).catch(err => console.error("Failed to save defaultZoom:", err));
    }, []);

    const scheduleZoomSave = useCallback(() => {
        if (zoomSaveTimeout.current) clearTimeout(zoomSaveTimeout.current);
        zoomSaveTimeout.current = setTimeout(() => {
            zoomSaveTimeout.current = null;
            saveCurrentZoom();
        }, 1500);
    }, [saveCurrentZoom]);

    // Save immediately (if a save is pending) so zoom tweaks aren't lost or
    // written against the wrong pattern when switching.
    const flushZoomSave = useCallback(() => {
        if (!zoomSaveTimeout.current) return;
        clearTimeout(zoomSaveTimeout.current);
        zoomSaveTimeout.current = null;
        saveCurrentZoom();
    }, [saveCurrentZoom]);

    // Set up the wheel event - this needs to be done in this strange way due to not being able to
    // override the event by default with react due to reasons
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            interactor.current?.handleWheelEvent(e);
            scheduleZoomSave();
        };

        if (!canvasRef.current) return;

        const crc = canvasRef.current;
        crc.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            crc.removeEventListener("wheel", handleWheel);
        };
    }, [canvasRef, scheduleZoomSave]);

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
            30,
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
        const { width, height } = screenDimensions;
        if (width <= 0 || height <= 0) return;

        GlobalApp.instance.renderer.setSize(width, height);

        const persp = GlobalApp.instance.perspCam;
        persp.aspect = width / height;
        persp.updateProjectionMatrix();

        const ortho = GlobalApp.instance.orthoCam;
        const cameraSize = {
            x: 0.001 * width,
            y: 0.001 * height,
        };
        ortho.left = -cameraSize.x * 0.5;
        ortho.right = cameraSize.x * 0.5;
        ortho.top = cameraSize.y * 0.5;
        ortho.bottom = -cameraSize.y * 0.5;
        ortho.updateProjectionMatrix();
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

        // Sky gradient background
        const sky = new SkyGradientEntity();
        sky.init();

        // Set up camera entities (orbit + floor-follow). The pattern manager
        // enables exactly one of them per pattern.
        const cameraOrbit = new CameraOrbitEntity();
        cameraOrbit.init();
        const cameraFloorFollow = new CameraFloorFollowEntity();
        cameraFloorFollow.init();

        // Create and initialize GeomEntity
        const geomEntity = new GeomContainerEntity({
            initialWidth: screenDimensions.width,
            initialHeight: screenDimensions.height,
        });

        // Grid scrolls with the active pattern's translation, wrapping by cell size
        const worldGrid = new WorldReferenceGridEntity(
            () => geomEntity.config.translationPerSecond
        );
        worldGrid.init();

        // Async init
        geomEntity
            .init()
            .then(() => {
                console.log("GeomEntity initialized successfully");

                geomContainerRef.current = geomEntity;

                // if (GlobalApp.instance && !tunnelPolylineDebugRef.current) {
                //     tunnelPolylineDebugRef.current = new TunnelPolylineDebug(GlobalApp.instance.scene);
                // }

                // Create pattern manager after geom is ready
                const pm = new GeomPatternManager(
                    cameraOrbit,
                    cameraFloorFollow,
                    geomEntity,
                    zoom => cameraControlsRef.current.setZoom(zoom)
                );
                pm.init();
                patternManager.current = pm;
                showPatternOverlay(
                    pm.patterns[pm.currentIndex].name,
                    pm.currentIndex,
                    pm.patterns.length
                );
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
                    flushZoomSave();
                    pm.nextPattern();
                    showPatternOverlay(
                        pm.patterns[pm.currentIndex].name,
                        pm.currentIndex,
                        pm.patterns.length
                    );
                } else if (e.key === "ArrowLeft") {
                    flushZoomSave();
                    pm.previousPattern();
                    showPatternOverlay(
                        pm.patterns[pm.currentIndex].name,
                        pm.currentIndex,
                        pm.patterns.length
                    );
                }
            }
        },
        [interactor, patternManager, flushZoomSave]
    );

    // Render!
    useAnimationFrame(
        ({ time, delta }) => {
            if (!hasGlobalAppInstance) return;

            Object.values(GlobalApp.instance.entities).forEach((entity: RealtimeEntity) => {
                entity.update(time, delta);
            });

            tunnelPolylineDebugRef.current?.update(geomContainerRef.current);

            const persp = GlobalApp.instance.perspCam;
            console.log(
                persp.position.x.toFixed(3),
                persp.position.y.toFixed(3),
                persp.position.z.toFixed(3)
            );

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
            className="fixed inset-0 overflow-hidden"
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
