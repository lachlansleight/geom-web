/**
 * A GeomPattern bundles together all the parameters needed to define
 * a complete visual style: camera behaviour, geom properties, and
 * parameter animation configs.
 *
 * The format is JSON-serialisable (Vector3s are [x,y,z] arrays).
 */

export interface OscillatorDef {
    center: number;
    amplitude: number;
    period: number;
    phase: number;
}

export interface ShufflerDef {
    muted?: boolean;
    absoluteMin: number;
    absoluteMax: number;
    maxChangePerSecond: number;
    minFrequency: number;
    maxFrequency: number;
    freezeChance?: number;
    isLoopable?: boolean;
    sawtoothChance?: number;
}

export interface AnimatorDef {
    interpolationPeriodMin: number;
    interpolationPeriodMax: number;
    shuffler: ShufflerDef;
}

/** Original orbit-based camera (oscillator-driven spherical orbit around a point). */
export interface OrbitCameraDef {
    mode?: "orbit";
    orbitCenter: [number, number, number];
    lookAtAmount: number;
    radius: OscillatorDef;
    theta: OscillatorDef;
    phi: OscillatorDef;
}

/** Camera that pins Z at a plane and rides on the ring's floor at that plane. */
export interface FloorFollowCameraDef {
    mode: "floorFollow";
    /** Camera Z plane the floor probe samples. Default 60. */
    cameraZ?: number;
    /** Distance below the ring floor at which the camera parks. */
    verticalOffset: number;
    /** Error halves every this many seconds (frame-rate independent). Default 0.5. */
    halfLifeSeconds?: number;
    /** Distance ahead (in +Z) of the probe ring centre to look at. */
    lookAtAhead: number;
    /** Maximum XY units per second the camera may move (anti-snap). Default 60. */
    maxSpeed?: number;
}

export type CameraDef = OrbitCameraDef | FloorFollowCameraDef;

export interface GeomPattern {
    name: string;

    camera: CameraDef;

    geom: {
        sliceCount?: number;
        cubeCount?: number;
        cubeRotateAmount?: [number, number, number];
        endCrunchSlices?: number;
        saturation?: number;
        brightness?: number;
        translationPerSecond?: [number, number, number];
        rotationPerSecond?: [number, number, number];
        scalingPerSecond?: [number, number, number];
        huePerSecond?: number;
        saturationPerSecond?: number;
        brightnessPerSecond?: number;
        cubeFillPerSecond?: number;
        cubeHeightPerSecond?: number;
        cubeSpinPerSecond?: [number, number, number];
        metallic?: number;
        smoothness?: number;
        opacity?: number;
        dissolveMin?: number;
        dissolveMax?: number;
        noiseScale?: number;
        noiseStrength?: number;
        dissolveForwardBias?: number;
    };

    animators: {
        [paramName: string]: AnimatorDef;
    };
}
