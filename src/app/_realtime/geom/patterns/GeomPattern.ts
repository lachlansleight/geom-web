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

export interface GeomPattern {
    name: string;

    camera: {
        orbitCenter: [number, number, number];
        lookAtAmount: number;
        radius: OscillatorDef;
        theta: OscillatorDef;
        phi: OscillatorDef;
    };

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
