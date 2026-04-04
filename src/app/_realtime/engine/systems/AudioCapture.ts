/**
 * Singleton that captures system audio via getDisplayMedia and exposes
 * real-time volume averages and meta variables, ported from Lunity's
 * AudioAverageSet.cs.
 *
 * Usage:
 *   AudioCapture.instance.momentary   // raw per-frame level 0-1
 *   AudioCapture.instance.halfSecond  // 0.5s rolling average
 *   AudioCapture.instance.second      // 1s rolling average
 *   AudioCapture.instance.fiveSecond  // 5s rolling average
 *   AudioCapture.instance.tenSecond   // 10s rolling average
 *   AudioCapture.instance.thirtySecond // 30s rolling average
 *   AudioCapture.instance.flicker     // momentary vs fiveSecond
 *   AudioCapture.instance.pulse       // halfSecond vs fiveSecond
 *   AudioCapture.instance.vibe        // fiveSecond vs thirtySecond
 */

class TimeAverager {
    private samples: Float32Array;
    private index = 0;
    private full = false;
    value = 0;

    constructor(count: number) {
        this.samples = new Float32Array(count);
    }

    update(sample: number): number {
        this.samples[this.index] = sample;
        this.index++;
        if (this.index >= this.samples.length) {
            this.full = true;
            this.index = 0;
        }

        let sum = 0;
        const count = this.full ? this.samples.length : this.index;
        for (let i = 0; i < count; i++) {
            sum += this.samples[i];
        }

        this.value = sum / count;
        return this.value;
    }

    reset(): void {
        this.samples.fill(0);
        this.index = 0;
        this.full = false;
        this.value = 0;
    }
}

class TimeLimitFinder {
    private samples: Float32Array;
    private index = 0;
    private full = false;
    private isMin = false;
    value = 0;

    constructor(count: number, mode: "min" | "max") {
        this.samples = new Float32Array(count);
        this.isMin = mode === "min";
    }

    update(sample: number): number {
        this.samples[this.index] = sample;
        this.index++;
        if (this.index >= this.samples.length) {
            this.full = true;
            this.index = 0;
        }

        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < this.samples.length; i++) {
            if (this.samples[i] < min) min = this.samples[i];
            if (this.samples[i] > max) max = this.samples[i];
        }

        this.value = this.isMin ? min : max;
        return this.value;
    }

    reset(): void {
        this.samples.fill(0);
        this.index = 0;
        this.full = false;
        this.value = 0;
    }
}

export default class AudioCapture {
    private static _instance: AudioCapture;

    static get instance(): AudioCapture {
        if (!AudioCapture._instance) {
            AudioCapture._instance = new AudioCapture();
        }
        return AudioCapture._instance;
    }

    /** Whether audio capture is currently active. */
    active = false;

    // --- Averages (all 0-1) ---
    /** Raw per-frame volume level. */
    momentary = 0;
    /** ~0.5 second rolling average. */
    halfSecond = 0;
    /** ~1 second rolling average. */
    second = 0;
    /** ~5 second rolling average. */
    fiveSecond = 0;
    /** ~10 second rolling average. */
    tenSecond = 0;
    /** ~30 second rolling average. */
    thirtySecond = 0;

    // --- Meta Variables (all 0-1) ---
    /** Momentary spikes relative to the 5s average. High = sudden loud moment. */
    flicker = 0;
    /** Half-second energy relative to 5s average. High = short burst of energy. */
    pulse = 0;
    /** 5-second energy relative to 30s average. High = sustained loud section. */
    vibe = 0;

    /** @deprecated Use `momentary` instead. */
    get level(): number {
        return this.momentary;
    }

    // Sample counts assume ~60 fps (matching the Unity version)
    private avgHalfSecond = new TimeAverager(30);
    private avgSecond = new TimeAverager(60);
    private avgFiveSecond = new TimeAverager(300);
    private avgTenSecond = new TimeAverager(600);
    private avgThirtySecond = new TimeAverager(1800);
    private minHalfSecond = new TimeLimitFinder(30, "min");
    private minSecond = new TimeLimitFinder(60, "min");
    private minFiveSecond = new TimeLimitFinder(300, "min");
    private minTenSecond = new TimeLimitFinder(600, "min");
    private minThirtySecond = new TimeLimitFinder(1800, "min");
    private maxHalfSecond = new TimeLimitFinder(30, "max");
    private maxSecond = new TimeLimitFinder(60, "max");
    private maxFiveSecond = new TimeLimitFinder(300, "max");
    private maxTenSecond = new TimeLimitFinder(600, "max");
    private maxThirtySecond = new TimeLimitFinder(1800, "max");

    private maxSeenVolume = 0.0000001;

    private audioCtx: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private stream: MediaStream | null = null;
    private dataArray: Uint8Array | null = null;
    private rafId: number | null = null;

    private constructor() {}

    async start(): Promise<boolean> {
        if (this.active) return true;

        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            // Check we actually got an audio track
            const audioTracks = this.stream.getAudioTracks();
            if (audioTracks.length === 0) {
                this.cleanupStream();
                return false;
            }

            // We don't need the video track
            this.stream.getVideoTracks().forEach((t) => t.stop());

            this.audioCtx = new AudioContext();
            this.source = this.audioCtx.createMediaStreamSource(this.stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            this.source.connect(this.analyser);

            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.active = true;
            this.resetAverages();
            this.pump();

            // Auto-stop if the user ends sharing via the browser UI
            audioTracks[0].addEventListener("ended", () => this.stop());

            return true;
        } catch {
            this.cleanup();
            return false;
        }
    }

    stop(): void {
        this.cleanup();
        this.resetAverages();
        this.active = false;
    }

    /** Reads frequency data, normalizes against max seen volume (like AudioData.cs). */
    private pump = (): void => {
        if (!this.active || !this.analyser || !this.dataArray) return;

        // Use frequency-domain data (like Unity's BarData), not time-domain waveform
        this.analyser.getByteFrequencyData(this.dataArray);

        // Average all frequency bins (0-255 each)
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        const rawAvg = sum / this.dataArray.length / 255;

        // Auto-normalize against loudest value seen so far (from AudioData.cs)
        if (rawAvg > this.maxSeenVolume) this.maxSeenVolume = rawAvg;
        this.momentary = rawAvg / this.maxSeenVolume;

        // Update rolling averages
        this.halfSecond = this.avgHalfSecond.update(this.momentary);
        this.second = this.avgSecond.update(this.momentary);
        this.fiveSecond = this.avgFiveSecond.update(this.momentary);
        this.tenSecond = this.avgTenSecond.update(this.momentary);
        this.thirtySecond = this.avgThirtySecond.update(this.momentary);

        this.minFiveSecond.update(this.momentary);
        this.maxFiveSecond.update(this.momentary);
        this.minSecond.update(this.momentary);
        this.maxSecond.update(this.momentary);
        this.minTenSecond.update(this.momentary);
        this.maxTenSecond.update(this.momentary);
        this.minThirtySecond.update(this.momentary);
        this.maxThirtySecond.update(this.momentary);

        // Update meta variables
        this.flicker = AudioCapture.getWithinLimits(this.momentary, this.minFiveSecond.value, this.maxFiveSecond.value);
        this.pulse = AudioCapture.getWithinLimits(this.halfSecond, this.minFiveSecond.value, this.maxFiveSecond.value);
        this.vibe = AudioCapture.getWithinLimits(this.fiveSecond, this.minThirtySecond.value, this.maxThirtySecond.value);

        this.rafId = requestAnimationFrame(this.pump);
    };

    private static getProportion(peakValue: number, baseValue: number): number {
        const total = peakValue + baseValue;
        if (total === 0) return 0.5;
        return peakValue / (total + 0.00001);
    }

    private static getWithinLimits(currentValue: number, minValue: number, maxValue: number): number {
        return Math.max(0, Math.min(1, (currentValue - minValue) / (maxValue - minValue)));
    }

    private resetAverages(): void {
        this.momentary = 0;
        this.halfSecond = 0;
        this.second = 0;
        this.fiveSecond = 0;
        this.tenSecond = 0;
        this.thirtySecond = 0;
        this.flicker = 0;
        this.pulse = 0;
        this.vibe = 0;
        this.avgHalfSecond.reset();
        this.avgSecond.reset();
        this.avgFiveSecond.reset();
        this.avgTenSecond.reset();
        this.avgThirtySecond.reset();
        this.maxSeenVolume = 0.0000001;
    }

    private cleanupStream(): void {
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
    }

    private cleanup(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.source?.disconnect();
        this.source = null;
        this.analyser = null;
        this.dataArray = null;
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }
        this.cleanupStream();
    }
}
