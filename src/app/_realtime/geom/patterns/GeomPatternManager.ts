import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GeomContainerEntity from "../GeomContainerEntity";
import CameraOrbitEntity from "_realtime/camera/CameraOrbitEntity";
import type { GeomPattern } from "./GeomPattern";
import type { InterpolatorConfig } from "../animation/ParameterInterpolatorEntity";
import patternsJson from "./patterns.json";

/**
 * Manages switching between GeomPatterns.
 * Holds references to the camera orbit and geom container entities,
 * and applies pattern configs when switching.
 *
 * Use left/right arrow keys to switch patterns.
 */
export default class GeomPatternManager extends RealtimeEntity {
    patterns: GeomPattern[];
    currentIndex: number = 0;

    private cameraOrbit: CameraOrbitEntity;
    private geomContainer: GeomContainerEntity;

    constructor(
        cameraOrbit: CameraOrbitEntity,
        geomContainer: GeomContainerEntity,
    ) {
        super();
        this.object3D.name = "GeomPatternManager";
        this.cameraOrbit = cameraOrbit;
        this.geomContainer = geomContainer;

        this.patterns = patternsJson as unknown as GeomPattern[];
    }

    init(): void {
        super.init();
        // Apply the first pattern
        if (this.patterns.length > 0) {
            this.applyPattern(0);
        }
    }

    update(_time: number, _deltaTime: number): void {
        // Nothing per-frame — pattern switching is event-driven
    }

    nextPattern(): void {
        if (this.patterns.length === 0) return;
        this.applyPattern((this.currentIndex + 1) % this.patterns.length);
    }

    previousPattern(): void {
        if (this.patterns.length === 0) return;
        this.applyPattern((this.currentIndex - 1 + this.patterns.length) % this.patterns.length);
    }

    applyPattern(index: number): void {
        this.currentIndex = index;
        const pattern = this.patterns[index];
        console.log(`Applying pattern: "${pattern.name}" (${index + 1}/${this.patterns.length})`);

        this.applyCameraConfig(pattern);
        this.applyGeomConfig(pattern);
        this.applyAnimatorConfigs(pattern);
    }

    private applyCameraConfig(pattern: GeomPattern): void {
        const cam = pattern.camera;
        this.cameraOrbit.applyConfig({
            orbitCenter: new THREE.Vector3(...cam.orbitCenter),
            lookAtAmount: cam.lookAtAmount,
            radius: cam.radius,
            theta: cam.theta,
            phi: cam.phi,
        });
    }

    private applyGeomConfig(pattern: GeomPattern): void {
        const g = pattern.geom;
        const config = this.geomContainer.config;

        if (g.sliceCount !== undefined) config.sliceCount = g.sliceCount;
        if (g.cubeCount !== undefined) config.cubeCount = g.cubeCount;
        if (g.saturation !== undefined) config.saturation = g.saturation;
        if (g.brightness !== undefined) config.brightness = g.brightness;
        if (g.metallic !== undefined) config.metallic = g.metallic;
        if (g.smoothness !== undefined) config.smoothness = g.smoothness;
        if (g.opacity !== undefined) config.opacity = g.opacity;
        if (g.huePerSecond !== undefined) config.huePerSecond = g.huePerSecond;
        if (g.saturationPerSecond !== undefined) config.saturationPerSecond = g.saturationPerSecond;
        if (g.brightnessPerSecond !== undefined) config.brightnessPerSecond = g.brightnessPerSecond;
        if (g.cubeFillPerSecond !== undefined) config.cubeFillPerSecond = g.cubeFillPerSecond;
        if (g.cubeHeightPerSecond !== undefined) config.cubeHeightPerSecond = g.cubeHeightPerSecond;
        if (g.dissolveMin !== undefined) config.dissolveMin = g.dissolveMin;
        if (g.dissolveMax !== undefined) config.dissolveMax = g.dissolveMax;
        if (g.noiseScale !== undefined) config.noiseScale = g.noiseScale;
        if (g.noiseStrength !== undefined) config.noiseStrength = g.noiseStrength;
        if (g.dissolveForwardBias !== undefined) config.dissolveForwardBias = g.dissolveForwardBias;
        if (g.endCrunchSlices !== undefined) config.endCrunchSlices = g.endCrunchSlices;

        if (g.translationPerSecond) {
            config.translationPerSecond.set(...g.translationPerSecond);
        }
        if (g.rotationPerSecond) {
            config.rotationPerSecond.set(...g.rotationPerSecond);
        }
        if (g.scalingPerSecond) {
            config.scalingPerSecond.set(...g.scalingPerSecond);
        }
        if (g.cubeRotateAmount) {
            config.cubeRotateAmount.set(...g.cubeRotateAmount);
        }
        if (g.cubeSpinPerSecond) {
            config.cubeSpinPerSecond.set(...g.cubeSpinPerSecond);
        }
    }

    private applyAnimatorConfigs(pattern: GeomPattern): void {
        const configs: { [name: string]: Partial<InterpolatorConfig> } = {};
        for (const [name, def] of Object.entries(pattern.animators)) {
            configs[name] = {
                interpolationPeriodMin: def.interpolationPeriodMin,
                interpolationPeriodMax: def.interpolationPeriodMax,
                shuffler: def.shuffler,
            };
        }
        this.geomContainer.animator.applyAnimatorConfigs(configs);
    }
}
