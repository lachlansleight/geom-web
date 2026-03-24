import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import Oscillator from "./Oscillator";
import OscillatorShuffler, { ShufflerConfig } from "./OscillatorShuffler";

export interface InterpolatorConfig {
    /** Human-readable name for this parameter */
    name: string;
    
    interpolationPeriodMin: number;
    /** Maximum time (seconds) during which to lerp from one oscillator state to the other */
    interpolationPeriodMax: number;
    /** Bounds and randomisation settings for the oscillators */
    shuffler: Partial<ShufflerConfig>;
}

function cubicInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * An "empty" entity that ping-pongs between two shuffled oscillators.
 *
 * Contains:
 *   - oscillatorFrom / oscillatorTo: the two oscillator endpoints
 *   - shuffler: randomises oscillator params within configured bounds
 *
 * Each frame it evaluates both oscillators, lerps between them with easing,
 * and exposes the result as `.value`. When it reaches one end, it reshuffles
 * the departed oscillator and reverses direction.
 *
 * This entity is NOT registered in GlobalApp — its parent drives its update().
 */
export default class ParameterInterpolatorEntity extends RealtimeEntity {
    /** The interpolated output value this frame */
    value: number = 0;

    /** Config for this interpolator (editable) */
    interpolatorConfig: InterpolatorConfig;

    /** The two oscillator endpoints */
    oscillatorFrom: Oscillator;
    oscillatorTo: Oscillator;

    /** Shuffler that randomises oscillator params */
    shuffler: OscillatorShuffler;

    /** Interpolation progress: 0 = fully "from", 1 = fully "to" */
    private _t: number = 0;
    private _directionUp: boolean = true;
    private _interpolationTime: number = 2;

    constructor(config: InterpolatorConfig) {
        super();
        this.interpolatorConfig = config;

        this.shuffler = new OscillatorShuffler(config.shuffler);
        this.oscillatorFrom = new Oscillator();
        this.oscillatorTo = new Oscillator();

        // Initial shuffle of both oscillators
        this.shuffler.shuffle(this.oscillatorFrom.params);
        this.shuffler.shuffle(this.oscillatorTo.params);

        // Start partway through so we don't all begin at the same point
        this._t = Math.random();
        this._directionUp = Math.random() > 0.5;
        this.randomiseInterpolationTime();

        this.object3D.name = `Interpolator:${config.name}`;
    }

    /**
     * Initialise without registering in GlobalApp.
     * The parent entity manages this entity's lifecycle and update calls.
     */
    init(): void {
        // Deliberately NOT calling super.init() — parent drives our updates
    }

    update(_time: number, deltaTime: number): void {
        // Advance both oscillators
        this.oscillatorFrom.update(deltaTime);
        this.oscillatorTo.update(deltaTime);

        // Get current values from both
        const valueFrom = this.oscillatorFrom.getValue();
        const valueTo = this.oscillatorTo.getValue();

        // Advance interpolation t
        const step = deltaTime / this._interpolationTime;
        if (this._directionUp) {
            this._t = Math.min(1, this._t + step);
        } else {
            this._t = Math.max(0, this._t - step);
        }

        // Apply cubic ease and lerp
        const easedT = cubicInOut(this._t);
        this.value = valueFrom + (valueTo - valueFrom) * easedT;

        // Check for direction reversal + reshuffle.
        // Key: shuffle the oscillator we're NOT reading from.
        // At t=1 we're fully reading "to", so "from" is invisible — safe to reshuffle.
        // At t=0 we're fully reading "from", so "to" is invisible — safe to reshuffle.
        if (this._t >= 1 && this._directionUp) {
            this.shuffler.shuffle(this.oscillatorFrom.params);
            this.oscillatorFrom.resetTime();
            this.randomiseInterpolationTime();
            console.log(`Shuffled ${this.interpolatorConfig.name} FROM (at t=1)`, this.oscillatorFrom.params);
            this._directionUp = false;
        } else if (this._t <= 0 && !this._directionUp) {
            this.shuffler.shuffle(this.oscillatorTo.params);
            this.oscillatorTo.resetTime();
            this.randomiseInterpolationTime();
            console.log(`Shuffled ${this.interpolatorConfig.name} TO (at t=0)`, this.oscillatorTo.params);
            this._directionUp = true;
        }
    }

    randomiseInterpolationTime(): void {
        this._interpolationTime = Math.random() * (this.interpolatorConfig.interpolationPeriodMax - this.interpolatorConfig.interpolationPeriodMin) + this.interpolatorConfig.interpolationPeriodMin;
    }

    /** Update shuffler config at runtime (e.g. when switching patterns).
     *  Reshuffles the inactive oscillator so the new bounds take effect on next transition. */
    updateConfig(config: InterpolatorConfig): void {
        this.interpolatorConfig = config;
        this.shuffler = new OscillatorShuffler(config.shuffler);

        // Reshuffle whichever oscillator is NOT currently being read
        if (this._directionUp) {
            // heading toward "to", so "from" side is safe
            if (this._t > 0.5) {
                this.shuffler.shuffle(this.oscillatorFrom.params);
                this.oscillatorFrom.resetTime();
            } else {
                this.shuffler.shuffle(this.oscillatorTo.params);
                this.oscillatorTo.resetTime();
            }
        } else {
            if (this._t < 0.5) {
                this.shuffler.shuffle(this.oscillatorTo.params);
                this.oscillatorTo.resetTime();
            } else {
                this.shuffler.shuffle(this.oscillatorFrom.params);
                this.oscillatorFrom.resetTime();
            }
        }
        this.randomiseInterpolationTime();
    }
}
