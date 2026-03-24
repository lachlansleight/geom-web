import { OscillatorParams, OscillatorShape } from "./Oscillator";

export interface ShufflerConfig {
    /** Whether the parameter keeps the value always in the center of absoluteMin and absoluteMax */
    muted: boolean;
    /** Lower bound for the oscillator's reachable values */
    absoluteMin: number;
    /** Upper bound for the oscillator's reachable values */
    absoluteMax: number;
    /** Maximum rate of change in units/second (prevents jittery motion) */
    maxChangePerSecond: number;
    /** Slowest oscillation in Hz (cycles per second) */
    minFrequency: number;
    /** Fastest oscillation in Hz */
    maxFrequency: number;
    /** Probability (0-1) of freezing to a constant value on shuffle */
    freezeChance: number;
    /** Whether this parameter wraps (e.g. rotation, hue) */
    isLoopable: boolean;
    /** Probability (0-1) of using sawtooth for loopable params */
    sawtoothChance: number;
}

export const DEFAULT_SHUFFLER_CONFIG: ShufflerConfig = {
    muted: false,
    absoluteMin: 0,
    absoluteMax: 1,
    maxChangePerSecond: 1,
    minFrequency: 0.02,
    maxFrequency: 0.15,
    freezeChance: 0.3,
    isLoopable: false,
    sawtoothChance: 0.5,
};

export default class OscillatorShuffler {
    config: ShufflerConfig;

    constructor(config: Partial<ShufflerConfig> = {}) {
        this.config = { ...DEFAULT_SHUFFLER_CONFIG, ...config };
    }

    /** Randomise the target oscillator's params within this shuffler's bounds */
    shuffle(target: OscillatorParams): void {
        const { absoluteMin, absoluteMax, freezeChance, isLoopable, sawtoothChance } = this.config;

        // Chance to freeze (hold constant)
        if (Math.random() < freezeChance || this.config.muted) {
            target.shape = OscillatorShape.Constant;
            if(this.config.muted) {
                target.center = (absoluteMin + absoluteMax) / 2;
            } else {
                target.center = randomRange(absoluteMin, absoluteMax);
            }
            target.amplitude = 0;
            target.phase = 0;
            target.period = 1; // doesn't matter for constant
            return;
        }

        // Pick waveform shape
        if (isLoopable && Math.random() < sawtoothChance) {
            target.shape = OscillatorShape.Sawtooth;
        } else {
            target.shape = OscillatorShape.Sine;
        }

        // Randomise amplitude (0 to half the total range)
        const range = absoluteMax - absoluteMin;
        target.amplitude = Math.random() * range * 0.5;

        // Randomise center (keeping oscillation within bounds)
        const minCenter = absoluteMin + target.amplitude;
        const maxCenter = absoluteMax - target.amplitude;
        target.center = randomRange(minCenter, maxCenter);

        // Randomise phase
        target.phase = Math.random();

        // Randomise frequency (Hz) and convert to period
        const { minFrequency, maxFrequency } = this.config;
        const freq = randomRange(minFrequency, maxFrequency);
        target.period = freq > 0 ? 1 / freq : 100;

        // Enforce max change per second
        this.enforceMaxChangeRate(target);
    }

    private enforceMaxChangeRate(target: OscillatorParams): void {
        const { maxChangePerSecond } = this.config;
        if (target.amplitude <= 0 || maxChangePerSecond <= 0) return;

        // Max derivative coefficient per waveform shape
        const coefficient =
            target.shape === OscillatorShape.Sine
                ? Math.PI * 2
                : target.shape === OscillatorShape.Sawtooth
                  ? 2
                  : 4; // triangle

        // Max instantaneous rate = coefficient * amplitude * frequency
        const maxAllowedFreq = maxChangePerSecond / (coefficient * target.amplitude);
        const currentFreq = 1 / target.period;

        if (currentFreq > maxAllowedFreq) {
            target.period = 1 / maxAllowedFreq;
        }
    }
}

function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}
