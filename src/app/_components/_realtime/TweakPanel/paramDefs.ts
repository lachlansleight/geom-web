/**
 * All slider ranges for the tweak panel live in this one file.
 * Tweak min/max/step here — the tabs just iterate these records.
 *
 * Record keys are the config/pattern field names and drive the read/write
 * wiring, so only change keys if the underlying config field is renamed.
 */

export type ParamDef = {
    label: string;
    min: number;
    max: number;
    /** Step size (not count). Omit for continuous. */
    step?: number;
    /** Round to whole numbers and display without decimals. */
    int?: boolean;
    /** Display precision (default 2). */
    decimals?: number;
};

export type Vec3Def = { label: string; axes: [ParamDef, ParamDef, ParamDef] };

export const vec3 = (label: string, min: number, max: number, step?: number): Vec3Def => ({
    label,
    axes: [
        { label: "x", min, max, step },
        { label: "y", min, max, step },
        { label: "z", min, max, step },
    ],
});

export type OscDef = {
    label: string;
    center: ParamDef;
    amplitude: ParamDef;
    period: ParamDef;
    phase: ParamDef;
};

export const osc = (label: string, centerMin: number, centerMax: number, ampMax: number): OscDef => ({
    label,
    center: { label: "center", min: centerMin, max: centerMax },
    amplitude: { label: "amplitude", min: 0, max: ampMax },
    period: { label: "period (s)", min: 1, max: 120 },
    phase: { label: "phase", min: 0, max: 1 },
});

// ---------------------------------------------------------------------------
// Color settings tab
// ---------------------------------------------------------------------------
export const colorDefs: Record<string, ParamDef> = {
    saturation: { label: "saturation", min: 0, max: 1 },
    brightness: { label: "brightness", min: 0, max: 2 },
    huePerSecond: { label: "hue/s", min: -1, max: 1, decimals: 3 },
    saturationPerSecond: { label: "saturation/s", min: -1, max: 1, decimals: 3 },
    brightnessPerSecond: { label: "brightness/s", min: -1, max: 1, decimals: 3 },
    metallic: { label: "metallic", min: 0, max: 1 },
    smoothness: { label: "smoothness", min: 0, max: 1 },
    opacity: { label: "opacity", min: 0, max: 1 },
    noiseColorStartAge: { label: "noise color start age", min: 0, max: 10 },
    noiseColorFadeAge: { label: "noise color fade age", min: 0, max: 10 },
    noiseHueFactor: { label: "noise hue factor", min: 0, max: 2 },
    noiseSaturationFactor: { label: "noise sat factor", min: 0, max: 2 },
    noiseBrightnessFactor: { label: "noise bright factor", min: 0, max: 3 },
    bloomThreshold: { label: "bloom threshold", min: 0, max: 2 },
    bloomIntensity: { label: "bloom intensity", min: 0, max: 3 },
    quantiseHue: { label: "quantise hue", min: 0, max: 16, step: 1, int: true },
    quantiseSaturation: { label: "quantise sat", min: 0, max: 16, step: 1, int: true },
    quantiseBrightness: { label: "quantise bright", min: 0, max: 16, step: 1, int: true },
};

// ---------------------------------------------------------------------------
// Geom movement tab
// ---------------------------------------------------------------------------
export const geomMovementScalarDefs: Record<string, ParamDef> = {
    cubeFillPerSecond: { label: "cube fill/s", min: -2, max: 2 },
    cubeHeightPerSecond: { label: "cube height/s", min: -2, max: 2 },
    // Hard max 1000: GPU buffers are sized at init
    sliceCount: { label: "slice count", min: 1, max: 1000, step: 1, int: true },
    // Hardware max 64 cubes per slice
    cubeCount: { label: "cube count", min: 1, max: 64, step: 1, int: true },
    endCrunchSlices: { label: "end crunch slices", min: 0, max: 200, step: 1, int: true },
};

export const geomMovementVectorDefs: Record<string, Vec3Def> = {
    translationPerSecond: vec3("translation/s", -30, 30),
    rotationPerSecond: vec3("rotation/s", -2, 2),
    scalingPerSecond: vec3("scaling/s", -1, 1),
    cubeSpinPerSecond: vec3("cube spin/s", -3, 3),
    cubeRotateAmount: vec3("cube rotate amount", -3.2, 3.2),
};

// ---------------------------------------------------------------------------
// Particle dissolve tab
// ---------------------------------------------------------------------------
export const particleDefs: Record<string, ParamDef> = {
    dissolveMin: { label: "dissolve min", min: 0, max: 30 },
    dissolveMax: { label: "dissolve max", min: 0, max: 40 },
    noiseScale: { label: "noise scale", min: 0, max: 30 },
    noiseStrength: { label: "noise strength", min: 0, max: 3 },
    dissolveForwardBias: { label: "forward bias", min: 0, max: 1 },
    particleRampTime: { label: "ramp time", min: 0, max: 15 },
    particleForceStrength: { label: "force strength", min: 0, max: 15 },
    particleNoiseScale: { label: "particle noise scale", min: 0, max: 3 },
    particleNoiseTimeScale: { label: "noise time scale", min: 0, max: 3 },
    particleDamping: { label: "damping", min: 0, max: 1 },
    particleMinSize: { label: "min size", min: 0, max: 1 },
    particleShrinkTime: { label: "shrink time", min: 0, max: 15 },
};

// ---------------------------------------------------------------------------
// Camera tab
// ---------------------------------------------------------------------------
export const cameraOrbitDefs = {
    defaultZoom: { label: "default zoom", min: 0.1, max: 3, decimals: 4 } as ParamDef,
    lookAtAmount: { label: "look-at amount", min: 0, max: 1 } as ParamDef,
    orbitCenter: vec3("orbit center", -50, 100),
    radius: osc("radius", 2, 60, 30),
    theta: osc("theta (deg)", -180, 180, 90),
    phi: osc("phi (deg)", -90, 90, 90),
};

export const cameraFloorFollowDefs: Record<string, ParamDef> = {
    defaultZoom: { label: "default zoom", min: 0.1, max: 3, decimals: 4 },
    cameraZ: { label: "camera z", min: 0, max: 150 },
    verticalOffset: { label: "vertical offset", min: -10, max: 10 },
    halfLifeSeconds: { label: "half-life (s)", min: 0.01, max: 3 },
    lookAtAhead: { label: "look-at ahead (unused)", min: 0, max: 30 },
    maxSpeed: { label: "max speed", min: 1, max: 200 },
    lookRotationHalfLifeSeconds: { label: "look rot half-life", min: 0, max: 2 },
};

// ---------------------------------------------------------------------------
// Animation tab
// ---------------------------------------------------------------------------
export const animatorSharedDefs = {
    absoluteMin: { label: "absolute min", min: 0, max: 1 } as ParamDef, // per-param range below
    absoluteMax: { label: "absolute max", min: 0, max: 1 } as ParamDef,
    maxChangePerSecond: { label: "max change/s", min: 0.05, max: 5 } as ParamDef,
    minFrequency: { label: "min frequency (Hz)", min: 0.01, max: 0.3, decimals: 3 } as ParamDef,
    maxFrequency: { label: "max frequency (Hz)", min: 0.01, max: 0.3, decimals: 3 } as ParamDef,
    freezeChance: { label: "freeze chance", min: 0, max: 1 } as ParamDef,
    interpolationPeriodMin: { label: "interp period min (s)", min: 1, max: 60 } as ParamDef,
    interpolationPeriodMax: { label: "interp period max (s)", min: 1, max: 60 } as ParamDef,
    sawtoothChance: { label: "sawtooth chance", min: 0, max: 1 } as ParamDef,
};

/** Slider bounds for each animated parameter's absoluteMin/absoluteMax. */
export const animatorAbsRanges: Record<string, { min: number; max: number; isIntegrated?: boolean }> = {
    radius: { min: 0, max: 30 },
    cubeFill: { min: 0, max: 1 },
    cubeHeight: { min: 0, max: 4 },
    hue: { min: 0, max: 6 },
    positionX: { min: -20, max: 20 },
    positionY: { min: -12, max: 12 },
    rotationZ: { min: -1.5, max: 1.5, isIntegrated: true },
    spread: { min: 0, max: 3 },
};

export const ANIMATOR_NAMES = [
    "radius",
    "cubeFill",
    "cubeHeight",
    "hue",
    "positionX",
    "positionY",
    "rotationZ",
    "spread",
] as const;
