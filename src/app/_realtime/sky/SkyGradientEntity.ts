import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GlobalApp from "_realtime/engine/systems/GlobalApp";

const vertexShader = /* glsl */ `
varying vec3 vDirection;

void main() {
    vDirection = normalize(position);
    // Remove translation from view matrix so sky stays centered on camera
    vec4 pos = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
    // Set z = w so the sky is always at max depth
    gl_Position = pos.xyww;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 colorTop;
uniform vec3 colorBottom;
uniform float time;

varying vec3 vDirection;

// Screenspace dither to prevent colour banding (from Lunity/GradientSkybox)
vec3 screenSpaceDither(vec2 screenPos, float t) {
    vec3 d = vec3(dot(vec2(171.0, 231.0), screenPos + t));
    d = fract(d / vec3(103.0, 71.0, 97.0)) - 0.5;
    return d / 255.0;
}

void main() {
    // Use Y component of view direction for gradient (0 at horizon, 1 at top, -1 at bottom)
    float t = vDirection.y * 0.5 + 0.5; // remap -1..1 to 0..1

    vec3 color = mix(colorBottom, colorTop, t);

    // Apply dither
    color += screenSpaceDither(gl_FragCoord.xy, time);

    gl_FragColor = vec4(color, 1.0);
}
`;

export interface SkyGradientConfig {
    colorTop: THREE.Color;
    colorBottom: THREE.Color;
}

const DEFAULT_CONFIG: SkyGradientConfig = {
    colorTop: new THREE.Color(20 / 255, 20 / 255, 25 / 255),
    colorBottom: new THREE.Color(0, 0, 0),
};

export default class SkyGradientEntity extends RealtimeEntity {
    config: SkyGradientConfig;
    private material: THREE.ShaderMaterial;

    constructor(config?: Partial<SkyGradientConfig>) {
        super();
        this.config = {
            colorTop: config?.colorTop ?? DEFAULT_CONFIG.colorTop.clone(),
            colorBottom: config?.colorBottom ?? DEFAULT_CONFIG.colorBottom.clone(),
        };
        this.object3D.name = "SkyGradient";

        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                colorTop: { value: this.config.colorTop },
                colorBottom: { value: this.config.colorBottom },
                time: { value: 0 },
            },
            side: THREE.BackSide,
            depthWrite: false,
        });

        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.frustumCulled = false;
        mesh.renderOrder = -1000;
        this.object3D.add(mesh);
    }

    init(): void {
        super.init();
        // Remove the solid background colour so our gradient shows through
        GlobalApp.instance.scene.background = null;
        GlobalApp.instance.scene.add(this.object3D);
    }

    update(time: number, _deltaTime: number): void {
        this.material.uniforms.time.value = time;
    }
}
