export enum OscillatorShape {
    Sine = "sine",
    Sawtooth = "sawtooth",
    Constant = "constant",
}

export interface OscillatorParams {
    shape: OscillatorShape;
    center: number;
    amplitude: number;
    period: number; // seconds per cycle
    phase: number; // 0-1 normalised
}

const DEFAULT_PARAMS: OscillatorParams = {
    shape: OscillatorShape.Sine,
    center: 0,
    amplitude: 1,
    period: 5,
    phase: 0,
};

export default class Oscillator {
    params: OscillatorParams;
    private _normalizedTime: number = 0; // in periods (0 = start, 1 = one full cycle)

    constructor(params?: Partial<OscillatorParams>) {
        this.params = { ...DEFAULT_PARAMS, ...params };
    }

    update(deltaTime: number): void {
        if (this.params.period > 0) {
            this._normalizedTime += deltaTime / this.params.period;
        }
    }

    getValue(): number {
        const { shape, center, amplitude, phase } = this.params;
        const t = this._normalizedTime + phase;

        switch (shape) {
            case OscillatorShape.Sine: {
                return center + amplitude * Math.sin(t * Math.PI * 2);
            }
            case OscillatorShape.Sawtooth: {
                // Linear ramp from -amplitude to +amplitude over one period
                const frac = ((t % 1) + 1) % 1; // always positive 0-1
                return center + amplitude * (frac * 2 - 1);
            }
            case OscillatorShape.Constant: {
                return center;
            }
        }
    }

    /** Copy another oscillator's full state (params + internal time) */
    copyFrom(other: Oscillator): void {
        this.params = { ...other.params };
        this._normalizedTime = other._normalizedTime;
    }

    resetTime(): void {
        this._normalizedTime = 0;
    }
}
