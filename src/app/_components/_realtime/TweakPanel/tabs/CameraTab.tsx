import { useState } from "react";
import * as THREE from "three";
import GeomPatternManager from "_realtime/geom/patterns/GeomPatternManager";
import type {
    FloorFollowCameraDef,
    OrbitCameraDef,
    OscillatorDef,
} from "_realtime/geom/patterns/GeomPattern";
import NumberSliderField from "../fields/NumberSliderField";
import Vector3Field, { Axis } from "../fields/Vector3Field";
import OscillatorField, { OscField } from "../fields/OscillatorField";
import { cameraFloorFollowDefs, cameraOrbitDefs } from "../paramDefs";

const OrbitControls = ({
    patternManager,
    setZoom,
}: {
    patternManager: GeomPatternManager;
    setZoom: (zoom: number) => void;
}): JSX.Element => {
    const cam = patternManager.patterns[patternManager.currentIndex].camera as OrbitCameraDef;
    const orbit = patternManager.cameraOrbit;

    // Seed from the pattern JSON — the orbit entity's config is not kept in
    // sync with its oscillators, so the pattern is the last-applied truth.
    const [defaultZoom, setDefaultZoom] = useState(cam.defaultZoom ?? 1);
    const [lookAtAmount, setLookAtAmount] = useState(cam.lookAtAmount);
    const [orbitCenter, setOrbitCenter] = useState({
        x: cam.orbitCenter[0],
        y: cam.orbitCenter[1],
        z: cam.orbitCenter[2],
    });
    const [oscs, setOscs] = useState<Record<"radius" | "theta" | "phi", OscillatorDef>>({
        radius: { ...cam.radius },
        theta: { ...cam.theta },
        phi: { ...cam.phi },
    });

    const editCenter = (axis: Axis, v: number) => {
        const next = { ...orbitCenter, [axis]: v };
        setOrbitCenter(next);
        orbit.applyConfig({ orbitCenter: new THREE.Vector3(next.x, next.y, next.z) });
    };

    const editOsc = (name: "radius" | "theta" | "phi", field: OscField, v: number) => {
        const next = { ...oscs[name], [field]: v };
        setOscs(prev => ({ ...prev, [name]: next }));
        orbit.applyConfig({ [name]: next });
    };

    return (
        <div>
            <NumberSliderField
                def={cameraOrbitDefs.defaultZoom}
                value={defaultZoom}
                onChange={v => {
                    setDefaultZoom(v);
                    setZoom(v);
                }}
            />
            <NumberSliderField
                def={cameraOrbitDefs.lookAtAmount}
                value={lookAtAmount}
                onChange={v => {
                    setLookAtAmount(v);
                    orbit.applyConfig({ lookAtAmount: v });
                }}
            />
            <Vector3Field def={cameraOrbitDefs.orbitCenter} value={orbitCenter} onChange={editCenter} />
            <OscillatorField
                def={cameraOrbitDefs.radius}
                value={oscs.radius}
                onChange={(f, v) => editOsc("radius", f, v)}
            />
            <OscillatorField
                def={cameraOrbitDefs.theta}
                value={oscs.theta}
                onChange={(f, v) => editOsc("theta", f, v)}
            />
            <OscillatorField
                def={cameraOrbitDefs.phi}
                value={oscs.phi}
                onChange={(f, v) => editOsc("phi", f, v)}
            />
            <p className="text-white text-opacity-40 text-[10px]">
                note: phase edits step instantly (not time-preserved)
            </p>
        </div>
    );
};

const FloorFollowControls = ({
    patternManager,
    setZoom,
}: {
    patternManager: GeomPatternManager;
    setZoom: (zoom: number) => void;
}): JSX.Element => {
    const cam = patternManager.patterns[patternManager.currentIndex]
        .camera as FloorFollowCameraDef;
    const floorFollow = patternManager.cameraFloorFollow;

    const [values, setValues] = useState<Record<string, number>>({
        defaultZoom: cam.defaultZoom ?? 1,
        cameraZ: cam.cameraZ ?? 60,
        verticalOffset: cam.verticalOffset,
        halfLifeSeconds: cam.halfLifeSeconds ?? 0.5,
        lookAtAhead: cam.lookAtAhead,
        maxSpeed: cam.maxSpeed ?? 60,
        lookRotationHalfLifeSeconds: cam.lookRotationHalfLifeSeconds ?? 0.35,
    });

    const set = (key: string, v: number) => {
        setValues(prev => ({ ...prev, [key]: v }));
        if (key === "defaultZoom") {
            setZoom(v);
        } else {
            floorFollow.applyConfig({ [key]: v });
        }
    };

    return (
        <div>
            {Object.entries(cameraFloorFollowDefs).map(([key, def]) => (
                <NumberSliderField
                    key={key}
                    def={def}
                    value={values[key]}
                    onChange={v => set(key, v)}
                />
            ))}
        </div>
    );
};

const CameraTab = ({
    patternManager,
    setZoom,
}: {
    patternManager: GeomPatternManager;
    setZoom: (zoom: number) => void;
}): JSX.Element => {
    const mode =
        patternManager.patterns[patternManager.currentIndex].camera.mode ?? "orbit";

    return (
        <div>
            <p className="text-white text-opacity-70 text-xs mb-2">mode: {mode}</p>
            {mode === "floorFollow" ? (
                <FloorFollowControls patternManager={patternManager} setZoom={setZoom} />
            ) : (
                <OrbitControls patternManager={patternManager} setZoom={setZoom} />
            )}
        </div>
    );
};

export default CameraTab;
