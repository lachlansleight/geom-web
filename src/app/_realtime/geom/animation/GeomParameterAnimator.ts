import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import ParameterInterpolatorEntity, { InterpolatorConfig } from "./ParameterInterpolatorEntity";
import { GeomConfig } from "../GeomContainerEntity";

/**
 * Parameter definitions with sensible defaults tuned for good-looking results.
 *
 * Each entry creates one ParameterInterpolatorEntity as a child.
 * Frequency range 0.02-0.15 Hz = cycles of ~7-50 seconds.
 * Interpolation periods are staggered so parameters don't all shift in lockstep.
 */
const PARAMETER_DEFAULTS: InterpolatorConfig[] = [
    {
        name: "radius",
        interpolationPeriodMin: 5,
        interpolationPeriodMax: 20,
        shuffler: {
            muted: false,
            absoluteMin: 2,
            absoluteMax: 20,
            maxChangePerSecond: 2,
            minFrequency: 0.02,
            maxFrequency: 0.3,
            freezeChance: 0.2,
        },
    },
    {
        name: "cubeFill",
        interpolationPeriodMin: 5,
        interpolationPeriodMax: 15,
        shuffler: {
            muted: false,
            absoluteMin: 0.1,
            absoluteMax: 0.95,
            maxChangePerSecond: 0.5,
            minFrequency: 0.02,
            maxFrequency: 0.3,
            freezeChance: 0.25,
        },
    },
    {
        name: "cubeHeight",
        interpolationPeriodMin: 5,
        interpolationPeriodMax: 20,
        shuffler: {
            muted: true,
            absoluteMin: 0.2,
            absoluteMax: 2.5,
            maxChangePerSecond: 0.5,
            minFrequency: 0.02,
            maxFrequency: 0.3,
            freezeChance: 0.3,
        },
    },
    {
        name: "hue",
        interpolationPeriodMin: 5,
        interpolationPeriodMax: 22,
        shuffler: {
            muted: false,
            absoluteMin: 0,
            absoluteMax: 3,
            maxChangePerSecond: 0.1,
            minFrequency: 0.01,
            maxFrequency: 0.3,
            freezeChance: 0.15,
        },
    },
    {
        name: "positionX",
        interpolationPeriodMin: 5,
        interpolationPeriodMax: 15,
        shuffler: {
            muted: false,
            absoluteMin: -10,
            absoluteMax: 10,
            maxChangePerSecond: 3,
            minFrequency: 0.02,
            maxFrequency: 0.3,
            freezeChance: 0.25,
        },
    },
    {
        name: "positionY",
        interpolationPeriodMin: 5,
        interpolationPeriodMax: 15,
        shuffler: {
            muted: false,
            absoluteMin: -6,
            absoluteMax: 6,
            maxChangePerSecond: 3,
            minFrequency: 0.02,
            maxFrequency: 0.3,
            freezeChance: 0.25,
        },
    },
    {
        name: "rotationZ",
        interpolationPeriodMin: 3,
        interpolationPeriodMax: 10,
        shuffler: {
            muted: false,
            absoluteMin: -3,
            absoluteMax: 3,
            maxChangePerSecond: 2,
            minFrequency: 0.02,
            maxFrequency: 0.1,
            freezeChance: 0.2,
            isLoopable: true,
            sawtoothChance: 0.4,
        },
    },
    {
        name: "spread",
        interpolationPeriodMin: 20,
        interpolationPeriodMax: 20,
        shuffler: {
            muted: true,
            absoluteMin: 1.0,
            absoluteMax: 1.0,
            maxChangePerSecond: 0.3,
            minFrequency: 0.02,
            maxFrequency: 0.08,
            freezeChance: 0.35,
        },
    },
];

/**
 * Parent entity that orchestrates all parameter interpolators.
 *
 * Entity hierarchy (all empty Object3Ds for logical organisation):
 *   GeomParameterAnimator
 *     ├── Interpolator:radius
 *     ├── Interpolator:cubeFill
 *     ├── Interpolator:cubeHeight
 *     ├── Interpolator:hue
 *     ├── Interpolator:positionX
 *     ├── Interpolator:positionY
 *     ├── Interpolator:rotationZ
 *     └── Interpolator:spread
 *
 * Each frame it updates all interpolators, then exposes their values
 * via `applyToConfig()` for the GeomContainerEntity to consume.
 */
export default class GeomParameterAnimator extends RealtimeEntity {
    /** All interpolator children, keyed by parameter name */
    interpolators: Map<string, ParameterInterpolatorEntity> = new Map();

    /** Override configs (merged with defaults at construction) */
    private parameterConfigs: InterpolatorConfig[];

    constructor(configOverrides?: Partial<InterpolatorConfig>[]) {
        super();
        this.object3D.name = "GeomParameterAnimator";

        // Merge any overrides with defaults
        this.parameterConfigs = PARAMETER_DEFAULTS.map((defaultConfig, i) => {
            const override = configOverrides?.[i];
            if (!override) return defaultConfig;
            return {
                ...defaultConfig,
                ...override,
                shuffler: { ...defaultConfig.shuffler, ...override.shuffler },
            };
        });

        // Create one interpolator entity per parameter
        for (const config of this.parameterConfigs) {
            const interpolator = new ParameterInterpolatorEntity(config);
            interpolator.object3D.name = `${config.name}`;
            this.interpolators.set(config.name, interpolator);

            // Parent the interpolator's Object3D under ours for scene hierarchy
            this.object3D.add(interpolator.object3D);
        }
    }

    init(): void {
        // Register this animator in GlobalApp so it gets update() calls
        super.init();

        // Init children (they deliberately skip GlobalApp registration)
        this.interpolators.forEach(interpolator => {
            interpolator.init();
        });
    }

    update(time: number, deltaTime: number): void {
        // Update all child interpolators
        this.interpolators.forEach(interpolator => {
            interpolator.update(time, deltaTime);
        });
    }

    /** Read a specific parameter's current interpolated value */
    getValue(parameterName: string): number {
        return this.interpolators.get(parameterName)?.value ?? 0;
    }

    /** Update all interpolator configs at runtime (e.g. when switching patterns) */
    applyAnimatorConfigs(configs: { [name: string]: Partial<InterpolatorConfig> }): void {
        for (const [name, partialConfig] of Object.entries(configs)) {
            const interpolator = this.interpolators.get(name);
            if (!interpolator) continue;
            const merged: InterpolatorConfig = {
                ...interpolator.interpolatorConfig,
                ...partialConfig,
                shuffler: { ...interpolator.interpolatorConfig.shuffler, ...partialConfig.shuffler },
            };
            interpolator.updateConfig(merged);
        }
    }

    /**
     * Apply all animated parameter values to a GeomConfig and Object3D.
     * Call this from GeomContainerEntity.update() after updating the animator.
     */
    applyToConfig(config: GeomConfig, target3D: THREE.Object3D): void {
        config.radius = this.getValue("radius");
        config.cubeFill = this.getValue("cubeFill");
        config.cubeHeight = this.getValue("cubeHeight");
        config.spread = this.getValue("spread");

        // Hue wraps 0-1
        const rawHue = this.getValue("hue");
        config.hue = ((rawHue % 1) + 1) % 1;

        // Position and rotation apply to the 3D object, not the config
        target3D.position.x = this.getValue("positionX");
        target3D.position.y = this.getValue("positionY");
        target3D.rotation.z = this.getValue("rotationZ");
    }
}
