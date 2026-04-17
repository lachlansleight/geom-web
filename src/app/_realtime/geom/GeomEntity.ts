import * as THREE from "three";
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GlobalApp from "_realtime/engine/systems/GlobalApp";

// Import shader sources as strings
import sliceSetNowShader from "./shaders/sliceSetNow.wgsl";
import sliceTransformPerSecondShader from "./shaders/sliceTransformPerSecond.wgsl";
import sliceOffsetPerSecondShader from "./shaders/sliceOffsetPerSecond.wgsl";
import vertexGenerationShader from "./shaders/vertexGeneration.wgsl";
import particleForceShader from "./shaders/particleForce.wgsl";
import geomRenderShader from "./shaders/geomRender.wgsl";

// Struct sizes (in bytes) - must match WGSL
const SLICE_STRUCT_SIZE = 128; // 64 (mat4) + 4 + 12 + 12 + 12 + 4 + 4 + 4 + 4 + 4 + 4 = 128 (padded)
const VERTEX_STRUCT_SIZE = 48; // 12 + 12 + 12 + 8 + 4 = 48
const PARTICLE_STRUCT_SIZE = 32; // 2 × vec4<f32>
const TRIANGLES_PER_SLICE = 512; // 64 cubes × 4 faces × 2 tris

export interface GeomConfig {
    sliceCount: number;
    cubeCount: number;
    radius: number;
    spread: number;
    cubeFill: number;
    cubeHeight: number;
    cubeSpin: THREE.Vector3;
    radiusCrunch: number;
    hue: number;
    saturation: number;
    brightness: number;
    cubeRotateAmount: THREE.Vector3;
    endCrunchSlices: number;
    // Animation
    translationPerSecond: THREE.Vector3;
    rotationPerSecond: THREE.Vector3;
    scalingPerSecond: THREE.Vector3;
    radiusPerSecond: number;
    spreadPerSecond: number;
    huePerSecond: number;
    saturationPerSecond: number;
    brightnessPerSecond: number;
    cubeFillPerSecond: number;
    cubeHeightPerSecond: number;
    cubeSpinPerSecond: THREE.Vector3;
    // Rendering
    metallic: number;
    smoothness: number;
    opacity: number;
    // Dissolve (camera proximity)
    dissolveMin: number;
    dissolveMax: number;
    noiseScale: number;
    noiseStrength: number;
    dissolveForwardBias: number;
    // Particle force field
    particleNoiseScale: number;
    particleForceStrength: number;
    particleRampTime: number;
    particleDamping: number;
    particleNoiseTimeScale: number;
    // Canvas dimensions (passed from parent)
    initialWidth?: number;
    initialHeight?: number;
}

const DEFAULT_CONFIG: GeomConfig = {
    sliceCount: 200,
    cubeCount: 32,
    radius: 2.0,
    spread: 1.0,
    cubeFill: 0.5,
    cubeHeight: 1.0,
    cubeSpin: new THREE.Vector3(0, 0, 0),
    radiusCrunch: 1.0,
    hue: 0.0,
    saturation: 1.0,
    brightness: 1.0,
    cubeRotateAmount: new THREE.Vector3(0, 0, 1),
    endCrunchSlices: 3,
    translationPerSecond: new THREE.Vector3(0, 0, 0),
    rotationPerSecond: new THREE.Vector3(0, 0, 0),
    scalingPerSecond: new THREE.Vector3(1, 1, 1),
    radiusPerSecond: 0,
    spreadPerSecond: 0,
    huePerSecond: 0.1,
    saturationPerSecond: 0,
    brightnessPerSecond: 0,
    cubeFillPerSecond: 0,
    cubeHeightPerSecond: 0,
    cubeSpinPerSecond: new THREE.Vector3(0, 0, 0),
    metallic: 0.0,
    smoothness: 0.5,
    opacity: 1.0,
    dissolveMin: 2.0,
    dissolveMax: 5.0,
    noiseScale: 0.8,
    noiseStrength: 0.5,
    dissolveForwardBias: 0.7,
    particleNoiseScale: 0.5,
    particleForceStrength: 0.3,
    particleRampTime: 8.0,
    particleDamping: 0.0,
    particleNoiseTimeScale: 0.15,
};

export default class GeomEntity extends RealtimeEntity {
    config: GeomConfig;

    // WebGPU resources
    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private presentationFormat: GPUTextureFormat = "bgra8unorm";

    // Buffers
    private sliceBuffer: GPUBuffer | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private particleBuffer: GPUBuffer | null = null;

    // Compute pipelines
    private setNowPipeline: GPUComputePipeline | null = null;
    private transformPerSecondPipeline: GPUComputePipeline | null = null;
    private offsetPerSecondPipeline: GPUComputePipeline | null = null;
    private vertexGenPipeline: GPUComputePipeline | null = null;
    private particleForcePipeline: GPUComputePipeline | null = null;

    // Render pipeline
    private renderPipeline: GPURenderPipeline | null = null;
    private depthTexture: GPUTexture | null = null;

    // Uniform buffers
    private setNowUniformBuffer: GPUBuffer | null = null;
    private transformPerSecondUniformBuffer: GPUBuffer | null = null;
    private offsetPerSecondUniformBuffer: GPUBuffer | null = null;
    private vertexGenUniformBuffer: GPUBuffer | null = null;
    private particleForceUniformBuffer: GPUBuffer | null = null;
    private renderUniformBuffer: GPUBuffer | null = null;

    // Bind groups
    private setNowBindGroup: GPUBindGroup | null = null;
    private transformPerSecondBindGroup: GPUBindGroup | null = null;
    private offsetPerSecondBindGroup: GPUBindGroup | null = null;
    private vertexGenBindGroup: GPUBindGroup | null = null;
    private particleForceBindGroup: GPUBindGroup | null = null;
    private renderBindGroup: GPUBindGroup | null = null;

    // State
    private currentSlice: number = 0;
    private isInitialized: boolean = false;
    private time: number = 0;
    private autoSlice: boolean = true;
    private sliceInterval: number = 2;
    private frameCount: number = 0;
    private holdRadiusAtZero: boolean = true;

    // Debug
    private debugMode: boolean = true;
    private debugFrameInterval: number = 120; // Log every N frames
    private debugStagingBuffer: GPUBuffer | null = null;
    private debugReadbackPending: boolean = false;

    constructor(config: Partial<GeomConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    async init(): Promise<void> {
        super.init();

        // Check WebGPU support
        if (!navigator.gpu) {
            console.error("WebGPU not supported in this browser");
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.error("Failed to get WebGPU adapter");
            return;
        }

        this.device = await adapter.requestDevice();
        if (!this.device) {
            console.error("Failed to get WebGPU device");
            return;
        }

        // Create overlay canvas for WebGPU rendering
        this.createCanvas();
        if (!this.canvas || !this.context) {
            console.error("Failed to create WebGPU canvas");
            return;
        }

        // Create buffers
        this.createBuffers();

        // Create pipelines
        await this.createComputePipelines();
        await this.createRenderPipeline();

        // Create bind groups
        this.createBindGroups();

        // Initialize slice buffer with empty slices
        this.initializeSliceBuffer();

        this.isInitialized = true;
        console.log("GeomEntity initialized with WebGPU");

        if (this.debugMode) {
            console.log("=== GEOM ENTITY INIT DEBUG ===");
            console.log("Slice count:", this.config.sliceCount);
            console.log("Cube count:", this.config.cubeCount);
            console.log("Slice buffer size:", this.config.sliceCount * SLICE_STRUCT_SIZE, "bytes");
            console.log("Vertex buffer size:", this.config.sliceCount * 64 * 24 * VERTEX_STRUCT_SIZE, "bytes");
            console.log("Presentation format:", this.presentationFormat);
            console.log("Pipelines created:", {
                setNow: !!this.setNowPipeline,
                transformPerSecond: !!this.transformPerSecondPipeline,
                offsetPerSecond: !!this.offsetPerSecondPipeline,
                vertexGen: !!this.vertexGenPipeline,
                render: !!this.renderPipeline,
            });
            console.log("Bind groups created:", {
                setNow: !!this.setNowBindGroup,
                transformPerSecond: !!this.transformPerSecondBindGroup,
                offsetPerSecond: !!this.offsetPerSecondBindGroup,
                vertexGen: !!this.vertexGenBindGroup,
                render: !!this.renderBindGroup,
            });
        }
    }

    private createCanvas(): void {
        // Create a canvas that overlays the Three.js canvas
        this.canvas = document.createElement("canvas");
        this.canvas.style.position = "fixed";
        this.canvas.style.top = "0";
        this.canvas.style.left = "0";
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.pointerEvents = "none";
        this.canvas.style.zIndex = "1";

        // Get dimensions - prefer config values, then window, then fallback
        const width =
            this.config.initialWidth ||
            window.innerWidth ||
            document.documentElement.clientWidth ||
            800;
        const height =
            this.config.initialHeight ||
            window.innerHeight ||
            document.documentElement.clientHeight ||
            600;
        this.canvas.width = width;
        this.canvas.height = height;

        console.log(`GeomEntity canvas created with dimensions: ${width}x${height}`);

        document.body.appendChild(this.canvas);

        this.context = this.canvas.getContext("webgpu");
        if (!this.context || !this.device) return;

        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: "premultiplied",
        });

        // Handle resize
        const handleResize = () => {
            if (this.canvas && this.context && this.device) {
                const newWidth = window.innerWidth || document.documentElement.clientWidth || 800;
                const newHeight = window.innerHeight || document.documentElement.clientHeight || 600;
                if (newWidth > 0 && newHeight > 0) {
                    this.canvas.width = newWidth;
                    this.canvas.height = newHeight;
                    this.recreateDepthTexture();
                }
            }
        };

        window.addEventListener("resize", handleResize);

        // Also trigger resize once on next frame to catch any late dimension updates
        requestAnimationFrame(() => {
            handleResize();
        });
    }

    private recreateDepthTexture(): void {
        if (!this.device || !this.canvas) return;

        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    private createBuffers(): void {
        if (!this.device) return;

        const sliceCount = this.config.sliceCount;
        const maxCubesPerSlice = 64;
        const verticesPerCube = 24;

        // Slice buffer
        this.sliceBuffer = this.device.createBuffer({
            size: sliceCount * SLICE_STRUCT_SIZE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        // Vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: sliceCount * maxCubesPerSlice * verticesPerCube * VERTEX_STRUCT_SIZE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        // Particle state buffer (one particle per triangle)
        this.particleBuffer = this.device.createBuffer({
            size: sliceCount * TRIANGLES_PER_SLICE * PARTICLE_STRUCT_SIZE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Uniform buffers
        this.setNowUniformBuffer = this.device.createBuffer({
            size: 256, // Padded size
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.transformPerSecondUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.offsetPerSecondUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.vertexGenUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.particleForceUniformBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.renderUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Depth texture
        this.recreateDepthTexture();

        // Debug staging buffer for reading back data
        if (this.debugMode) {
            const maxReadbackSize = Math.max(
                sliceCount * SLICE_STRUCT_SIZE,
                sliceCount * maxCubesPerSlice * verticesPerCube * VERTEX_STRUCT_SIZE
            );
            this.debugStagingBuffer = this.device.createBuffer({
                size: maxReadbackSize,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
            });
        }
    }

    private async createComputePipelines(): Promise<void> {
        if (!this.device) return;

        // SetNow pipeline
        const setNowModule = this.device.createShaderModule({
            code: sliceSetNowShader,
        });
        this.setNowPipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: setNowModule,
                entryPoint: "main",
            },
        });

        // TransformPerSecond pipeline
        const transformModule = this.device.createShaderModule({
            code: sliceTransformPerSecondShader,
        });
        this.transformPerSecondPipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: transformModule,
                entryPoint: "main",
            },
        });

        // OffsetPerSecond pipeline
        const offsetModule = this.device.createShaderModule({
            code: sliceOffsetPerSecondShader,
        });
        this.offsetPerSecondPipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: offsetModule,
                entryPoint: "main",
            },
        });

        // VertexGeneration pipeline
        const vertexGenModule = this.device.createShaderModule({
            code: vertexGenerationShader,
        });
        this.vertexGenPipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: vertexGenModule,
                entryPoint: "main",
            },
        });

        // ParticleForce pipeline
        const particleForceModule = this.device.createShaderModule({
            code: particleForceShader,
        });
        this.particleForcePipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: particleForceModule,
                entryPoint: "main",
            },
        });
    }

    private async createRenderPipeline(): Promise<void> {
        if (!this.device) return;

        const renderModule = this.device.createShaderModule({
            code: geomRenderShader,
        });

        this.renderPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: renderModule,
                entryPoint: "vertexMain",
            },
            fragment: {
                module: renderModule,
                entryPoint: "fragmentMain",
                targets: [
                    {
                        format: this.presentationFormat,
                        blend: {
                            color: {
                                srcFactor: "src-alpha" as GPUBlendFactor,
                                dstFactor: "one-minus-src-alpha" as GPUBlendFactor,
                                operation: "add" as GPUBlendOperation,
                            },
                            alpha: {
                                srcFactor: "one" as GPUBlendFactor,
                                dstFactor: "one-minus-src-alpha" as GPUBlendFactor,
                                operation: "add" as GPUBlendOperation,
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: "triangle-list" as GPUPrimitiveTopology,
                cullMode: "none" as GPUCullMode, // Disable culling to debug gap issue
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less" as GPUCompareFunction,
                format: "depth24plus" as GPUTextureFormat,
            },
        });
    }

    private createBindGroups(): void {
        if (!this.device || !this.sliceBuffer || !this.vertexBuffer) return;

        // SetNow bind group
        if (this.setNowPipeline && this.setNowUniformBuffer) {
            this.setNowBindGroup = this.device.createBindGroup({
                layout: this.setNowPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.sliceBuffer } },
                    { binding: 1, resource: { buffer: this.setNowUniformBuffer } },
                ],
            });
        }

        // TransformPerSecond bind group
        if (this.transformPerSecondPipeline && this.transformPerSecondUniformBuffer) {
            this.transformPerSecondBindGroup = this.device.createBindGroup({
                layout: this.transformPerSecondPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.sliceBuffer } },
                    { binding: 1, resource: { buffer: this.transformPerSecondUniformBuffer } },
                ],
            });
        }

        // OffsetPerSecond bind group
        if (this.offsetPerSecondPipeline && this.offsetPerSecondUniformBuffer) {
            this.offsetPerSecondBindGroup = this.device.createBindGroup({
                layout: this.offsetPerSecondPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.sliceBuffer } },
                    { binding: 1, resource: { buffer: this.offsetPerSecondUniformBuffer } },
                ],
            });
        }

        // VertexGen bind group
        if (this.vertexGenPipeline && this.vertexGenUniformBuffer) {
            this.vertexGenBindGroup = this.device.createBindGroup({
                layout: this.vertexGenPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.sliceBuffer } },
                    { binding: 1, resource: { buffer: this.vertexBuffer } },
                    { binding: 2, resource: { buffer: this.vertexGenUniformBuffer } },
                ],
            });
        }

        // ParticleForce bind group
        if (
            this.particleForcePipeline &&
            this.particleForceUniformBuffer &&
            this.particleBuffer
        ) {
            this.particleForceBindGroup = this.device.createBindGroup({
                layout: this.particleForcePipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.sliceBuffer } },
                    { binding: 1, resource: { buffer: this.vertexBuffer } },
                    { binding: 2, resource: { buffer: this.particleBuffer } },
                    { binding: 3, resource: { buffer: this.particleForceUniformBuffer } },
                ],
            });
        }

        // Render bind group
        if (this.renderPipeline && this.renderUniformBuffer) {
            this.renderBindGroup = this.device.createBindGroup({
                layout: this.renderPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.vertexBuffer } },
                    { binding: 1, resource: { buffer: this.renderUniformBuffer } },
                ],
            });
        }
    }

    private initializeSliceBuffer(): void {
        if (!this.device || !this.sliceBuffer) return;

        const sliceCount = this.config.sliceCount;
        const sliceData = new Float32Array(sliceCount * (SLICE_STRUCT_SIZE / 4));

        // New struct layout (128 bytes = 32 floats per slice):
        // offset 0-15: transform mat4x4 (16 floats)
        // offset 16-19: ringRadiusAndColor vec4 (xyz=HSV, w=radius)
        // offset 20-23: cubeSize vec4 (xyz=size, w=spread)
        // offset 24-27: cubeSpin vec4 (xyz=spin, w=radiusCrunch)
        // offset 28-31: params vec4 (x=cubeCount, y=exists, z=setTime, w=unused)

        for (let i = 0; i < sliceCount; i++) {
            const offset = i * (SLICE_STRUCT_SIZE / 4);
            // Identity transform
            sliceData[offset + 0] = 1;
            sliceData[offset + 5] = 1;
            sliceData[offset + 10] = 1;
            sliceData[offset + 15] = 1;
            // ringRadiusAndColor: xyz=HSV(0,1,1), w=radius(0)
            sliceData[offset + 16] = 0; // hue
            sliceData[offset + 17] = 1; // saturation
            sliceData[offset + 18] = 1; // brightness
            sliceData[offset + 19] = 0; // radius
            // cubeSize: xyz=size(1,1,1), w=spread(1)
            sliceData[offset + 20] = 1;
            sliceData[offset + 21] = 1;
            sliceData[offset + 22] = 1;
            sliceData[offset + 23] = 1; // spread
            // cubeSpin: xyz=spin(0,0,0), w=radiusCrunch(1)
            sliceData[offset + 24] = 0;
            sliceData[offset + 25] = 0;
            sliceData[offset + 26] = 0;
            sliceData[offset + 27] = 1; // radiusCrunch
            // params: x=cubeCount, y=exists, z=setTime, w=unused
            sliceData[offset + 28] = this.config.cubeCount;
            sliceData[offset + 29] = 1; // exists = 1 (pre-fill buffer to avoid gap)
            sliceData[offset + 30] = 0; // setTime
            sliceData[offset + 31] = 0; // unused
        }

        this.device.queue.writeBuffer(this.sliceBuffer, 0, sliceData);
    }

    update(time: number, deltaTime: number): void {
        if (!this.isInitialized || !this.device) return;

        this.time = time;
        this.frameCount++;

        // Update uniforms and dispatch compute shaders
        this.updateSetNowUniforms(deltaTime);
        this.updateTransformPerSecondUniforms(deltaTime);
        this.updateOffsetPerSecondUniforms(deltaTime);
        this.updateVertexGenUniforms();
        this.updateParticleForceUniforms(deltaTime);

        // Dispatch compute shaders
        this.dispatchCompute();

        // Render
        this.render();

        // Debug logging
        // if (this.debugMode && this.frameCount % this.debugFrameInterval === 0 && !this.debugReadbackPending) {
        //     this.debugLogRenderState();
        //     this.debugReadbackPending = true;
        //     this.debugReadbackAll().catch(console.error).finally(() => {
        //         this.debugReadbackPending = false;
        //     });
        // }
        // console.log(this.currentSlice);

        // Auto-slice
        if (this.autoSlice && this.frameCount % this.sliceInterval === 0) {
            this.currentSlice = (this.currentSlice + 1) % Math.floor(this.config.sliceCount * 0.75);
            this.holdRadiusAtZero = false;
        }
    }

    private updateSetNowUniforms(deltaTime: number): void {
        if (!this.device || !this.setNowUniformBuffer) return;

        // Build current transform matrix
        const position = this.object3D.position;
        const rotation = this.object3D.quaternion;
        const scale = this.object3D.scale;

        const matrix = new THREE.Matrix4();
        matrix.compose(position, rotation, scale);

        // Layout matches WGSL SetNowUniforms struct with vec4 for alignment:
        // offset 0: mat4x4 currentTransform (16 floats = 64 bytes)
        // offset 16: currentRingColor vec4 (xyz = HSV, w = ringRadius)
        // offset 20: currentCubeSize vec4 (xyz = size, w = spread)
        // offset 24: currentCubeSpin vec4 (xyz = spin, w = radiusCrunch)
        // offset 28: params vec4 (x = unused, y = cubeCount, z = time, w = unused)
        // offset 32: currentSlice u32

        const data = new Float32Array(36); // 33 floats needed, round up to 36

        // mat4x4 (16 floats)
        matrix.toArray(data, 0);

        // currentRingColor vec4 (offset 16): xyz=HSV, w=radius
        data[16] = this.config.hue;
        data[17] = this.config.saturation;
        data[18] = this.config.brightness;
        data[19] = this.holdRadiusAtZero ? 0 : this.config.radius;

        // currentCubeSize vec4 (offset 20): xyz=size, w=spread
        data[20] = this.config.cubeFill;
        data[21] = this.config.cubeHeight;
        data[22] = 1.0; // z size (unused but set to 1)
        data[23] = this.config.spread;

        // currentCubeSpin vec4 (offset 24): xyz=spin(radians), w=radiusCrunch
        data[24] = (this.config.cubeSpin.x * Math.PI) / 180;
        data[25] = (this.config.cubeSpin.y * Math.PI) / 180;
        data[26] = (this.config.cubeSpin.z * Math.PI) / 180;
        data[27] = this.config.radiusCrunch;

        // params vec4 (offset 28): x=unused, y=cubeCount, z=time, w=unused
        data[28] = 0; // unused (but shader reads params.y for cubeCount)
        data[29] = this.config.cubeCount;
        data[30] = this.time;
        data[31] = 0;

        // currentSlice u32 (offset 32)
        const uint32View = new Uint32Array(data.buffer);
        uint32View[32] = this.currentSlice;

        this.device.queue.writeBuffer(this.setNowUniformBuffer, 0, data);

        // Debug: log uniform data on first few frames
        if (this.debugMode && this.frameCount <= 3) {
            console.log("=== SET NOW UNIFORMS (frame " + this.frameCount + ") ===");
            console.log("currentSlice:", this.currentSlice);
            console.log("radius:", data[19]);
            console.log("color (HSV):", [data[16], data[17], data[18]]);
            console.log("cubeSize:", [data[20], data[21]]);
            console.log("spread:", data[23]);
            console.log("radiusCrunch:", data[27]);
            console.log("cubeCount:", data[29]);
            console.log("time:", data[30]);
        }
    }

    private updateTransformPerSecondUniforms(deltaTime: number): void {
        if (!this.device || !this.transformPerSecondUniformBuffer) return;

        // Build per-second transform matrix
        const translation = this.config.translationPerSecond.clone().multiplyScalar(deltaTime);
        const rotationEuler = this.config.rotationPerSecond
            .clone()
            .multiplyScalar((deltaTime * Math.PI) / 180);
        const scaling = new THREE.Vector3(
            Math.pow(this.config.scalingPerSecond.x, deltaTime),
            Math.pow(this.config.scalingPerSecond.y, deltaTime),
            Math.pow(this.config.scalingPerSecond.z, deltaTime)
        );

        const matrix = new THREE.Matrix4();
        const quat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(rotationEuler.x, rotationEuler.y, rotationEuler.z)
        );
        matrix.compose(translation, quat, scaling);

        const data = new Float32Array(32);
        matrix.toArray(data, 0);
        const uint32View = new Uint32Array(data.buffer);
        uint32View[16] = this.currentSlice;
        uint32View[17] = this.config.sliceCount;

        this.device.queue.writeBuffer(this.transformPerSecondUniformBuffer, 0, data);
    }

    private updateOffsetPerSecondUniforms(deltaTime: number): void {
        if (!this.device || !this.offsetPerSecondUniformBuffer) return;

        const data = new Float32Array(32);
        data[0] = deltaTime;
        data[1] = this.config.radiusPerSecond;
        data[2] = this.config.spreadPerSecond;
        data[3] = 0; // padding
        data[4] = this.config.huePerSecond;
        data[5] = this.config.saturationPerSecond;
        data[6] = this.config.brightnessPerSecond;
        data[7] = 0; // padding
        data[8] = this.config.cubeFillPerSecond;
        data[9] = this.config.cubeHeightPerSecond;
        data[10] = 0;
        data[11] = 0; // padding
        data[12] = this.config.cubeSpinPerSecond.x;
        data[13] = this.config.cubeSpinPerSecond.y;
        data[14] = this.config.cubeSpinPerSecond.z;

        const uint32View = new Uint32Array(data.buffer);
        uint32View[15] = this.currentSlice;
        uint32View[16] = this.config.sliceCount;

        this.device.queue.writeBuffer(this.offsetPerSecondUniformBuffer, 0, data);
    }

    private updateVertexGenUniforms(): void {
        if (!this.device || !this.vertexGenUniformBuffer) return;

        // New layout (6 vec4s = 24 floats = 96 bytes):
        // cubeRotateAndCrunch: vec4 (xyz=cubeRotateAmount, w=endCrunchSlices)
        // timeAndSlices: vec4<u32> (x=currentSlice, y=sliceCount, z=minShowSlice, w=maxShowSlice)
        // offsetParams: vec4 (x=offsetFalloff, y=offsetRadius, z=time, w=unused)
        // offsetColor: vec4 (xyz=offsetColor, w=unused)
        // offsetSize: vec4 (xyz=offsetSize, w=unused)
        // offsetSpinAndSpread: vec4 (xyz=offsetSpin, w=offsetSpread)

        const data = new Float32Array(24);

        // cubeRotateAndCrunch (offset 0)
        data[0] = this.config.cubeRotateAmount.x;
        data[1] = this.config.cubeRotateAmount.y;
        data[2] = this.config.cubeRotateAmount.z;
        data[3] = this.config.endCrunchSlices;

        // timeAndSlices (offset 4) - written as u32
        const uint32View = new Uint32Array(data.buffer);
        uint32View[4] = this.currentSlice;
        uint32View[5] = this.config.sliceCount;
        uint32View[6] = 0; // minShowSlice
        uint32View[7] = Math.floor(this.config.sliceCount * 0.75); // weird hack

        // offsetParams (offset 8)
        data[8] = 0; // offsetFalloff
        data[9] = 0; // offsetRadius
        data[10] = this.time;
        data[11] = 0; // unused

        // offsetColor (offset 12)
        data[12] = 0;
        data[13] = 0;
        data[14] = 0;
        data[15] = 0;

        // offsetSize (offset 16)
        data[16] = 0;
        data[17] = 0;
        data[18] = 0;
        data[19] = 0;

        // offsetSpinAndSpread (offset 20)
        data[20] = 0;
        data[21] = 0;
        data[22] = 0;
        data[23] = 0; // offsetSpread

        this.device.queue.writeBuffer(this.vertexGenUniformBuffer, 0, data);
    }

    private updateParticleForceUniforms(deltaTime: number): void {
        if (!this.device || !this.particleForceUniformBuffer) return;

        // 2 × vec4<f32> = 8 floats. Pad to 16 for buffer alignment.
        const data = new Float32Array(16);

        // timeParams: x=time, y=dt, z=rampTime, w=forceStrength
        data[0] = this.time;
        data[1] = deltaTime;
        data[2] = this.config.particleRampTime;
        data[3] = this.config.particleForceStrength;

        // noiseParams: x=noiseScale, y=damping, z=noiseTimeScale, w=unused
        data[4] = this.config.particleNoiseScale;
        data[5] = this.config.particleDamping;
        data[6] = this.config.particleNoiseTimeScale;
        data[7] = 0;

        this.device.queue.writeBuffer(this.particleForceUniformBuffer, 0, data);
    }

    private dispatchCompute(): void {
        if (!this.device) return;

        const commandEncoder = this.device.createCommandEncoder();

        // SetNow - single thread
        if (this.setNowPipeline && this.setNowBindGroup) {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.setNowPipeline);
            pass.setBindGroup(0, this.setNowBindGroup);
            pass.dispatchWorkgroups(1);
            pass.end();
        }

        // TransformPerSecond - 256 threads per workgroup
        if (this.transformPerSecondPipeline && this.transformPerSecondBindGroup) {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.transformPerSecondPipeline);
            pass.setBindGroup(0, this.transformPerSecondBindGroup);
            pass.dispatchWorkgroups(Math.ceil(this.config.sliceCount / 256));
            pass.end();
        }

        // OffsetPerSecond
        if (this.offsetPerSecondPipeline && this.offsetPerSecondBindGroup) {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.offsetPerSecondPipeline);
            pass.setBindGroup(0, this.offsetPerSecondBindGroup);
            pass.dispatchWorkgroups(Math.ceil(this.config.sliceCount / 256));
            pass.end();
        }

        // VertexGeneration - 64 threads per workgroup, one workgroup per slice
        if (this.vertexGenPipeline && this.vertexGenBindGroup) {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.vertexGenPipeline);
            pass.setBindGroup(0, this.vertexGenBindGroup);
            pass.dispatchWorkgroups(this.config.sliceCount);
            pass.end();
        }

        // ParticleForce - one invocation per triangle, 64 per workgroup
        if (this.particleForcePipeline && this.particleForceBindGroup) {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.particleForcePipeline);
            pass.setBindGroup(0, this.particleForceBindGroup);
            const totalTriangles = this.config.sliceCount * TRIANGLES_PER_SLICE;
            pass.dispatchWorkgroups(Math.ceil(totalTriangles / 64));
            pass.end();
        }

        this.device.queue.submit([commandEncoder.finish()]);
    }

    private render(): void {
        if (
            !this.device ||
            !this.context ||
            !this.renderPipeline ||
            !this.renderBindGroup ||
            !this.depthTexture ||
            !this.renderUniformBuffer
        )
            return;

        // Get camera matrices from Three.js
        const camera = GlobalApp.instance?.perspCam;
        if (!camera) return;

        camera.updateMatrixWorld();
        const viewMatrix = camera.matrixWorldInverse;
        const projMatrix = camera.projectionMatrix;
        const viewProjMatrix = new THREE.Matrix4().multiplyMatrices(projMatrix, viewMatrix);

        // Update render uniforms
        // Layout: viewProjection (16) + cameraAndTime (4) + materialParams (4) + dissolveParams (4) + cameraForward (4) = 32 floats = 128 bytes
        const renderData = new Float32Array(32);
        viewProjMatrix.toArray(renderData, 0);
        // cameraAndTime: xyz=cameraPosition, w=time
        renderData[16] = camera.position.x;
        renderData[17] = camera.position.y;
        renderData[18] = camera.position.z;
        renderData[19] = this.time;
        // materialParams: x=metallic, y=smoothness, z=opacity, w=dissolveForwardBias
        renderData[20] = this.config.metallic;
        renderData[21] = this.config.smoothness;
        renderData[22] = this.config.opacity;
        renderData[23] = this.config.dissolveForwardBias;
        // dissolveParams: x=dissolveMin, y=dissolveMax, z=noiseScale, w=noiseStrength
        renderData[24] = this.config.dissolveMin;
        renderData[25] = this.config.dissolveMax;
        renderData[26] = this.config.noiseScale;
        renderData[27] = this.config.noiseStrength;
        // cameraForward: xyz=forward direction, w=unused
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        renderData[28] = fwd.x;
        renderData[29] = fwd.y;
        renderData[30] = fwd.z;
        renderData[31] = 0;

        this.device.queue.writeBuffer(this.renderUniformBuffer, 0, renderData);

        // Get current texture
        const textureView = this.context.getCurrentTexture().createView();

        const commandEncoder = this.device.createCommandEncoder();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    loadOp: "clear" as GPULoadOp,
                    storeOp: "store" as GPUStoreOp,
                },
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: "clear" as GPULoadOp,
                depthStoreOp: "store" as GPUStoreOp,
            },
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.renderBindGroup);

        // Draw all vertices
        const vertexCount = this.config.sliceCount * 64 * 24;
        renderPass.draw(vertexCount);

        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    private async debugReadbackAll(): Promise<void> {
        await this.debugReadbackSliceBuffer();
        await this.debugReadbackVertexBuffer();
    }

    private async debugReadbackSliceBuffer(): Promise<void> {
        if (!this.device || !this.sliceBuffer || !this.debugStagingBuffer) return;

        const commandEncoder = this.device.createCommandEncoder();
        // Copy the entire slice buffer for debugging
        const readSize = this.config.sliceCount * SLICE_STRUCT_SIZE;
        commandEncoder.copyBufferToBuffer(this.sliceBuffer, 0, this.debugStagingBuffer, 0, readSize);
        this.device.queue.submit([commandEncoder.finish()]);

        await this.debugStagingBuffer.mapAsync(GPUMapMode.READ, 0, readSize);
        const data = new Float32Array(this.debugStagingBuffer.getMappedRange(0, readSize).slice(0));
        this.debugStagingBuffer.unmap();

        console.log("=== SLICE BUFFER DEBUG ===");
        console.log("Current slice:", this.currentSlice, "of", this.config.sliceCount);

        // Check slices around the current slice (where the gap might be)
        const checkSlices = [
            0, 1, 2,  // Start of buffer
            this.currentSlice - 2, this.currentSlice - 1, this.currentSlice,  // Around current
            this.currentSlice + 1, this.currentSlice + 2,  // After current (oldest)
            this.config.sliceCount - 2, this.config.sliceCount - 1,  // End of buffer
        ].filter(i => i >= 0 && i < this.config.sliceCount);

        for (const i of checkSlices) {
            const offset = i * (SLICE_STRUCT_SIZE / 4);
            console.log(`Slice ${i}:`, {
                radius: data[offset + 19]?.toFixed(2),
                exists: data[offset + 29],
                cubeCount: data[offset + 28],
                transform_w: data[offset + 15]?.toFixed(2), // Should be 1 for valid matrix
            });
        }

        // Count how many slices have exists=1 and valid radius
        let existsCount = 0;
        let validRadiusCount = 0;
        for (let i = 0; i < this.config.sliceCount; i++) {
            const offset = i * (SLICE_STRUCT_SIZE / 4);
            if (data[offset + 29] >= 0.5) existsCount++;
            if (data[offset + 19] > 0.1) validRadiusCount++;
        }
        console.log(`Slices with exists=1: ${existsCount}/${this.config.sliceCount}`);
        console.log(`Slices with valid radius: ${validRadiusCount}/${this.config.sliceCount}`);
    }

    private async debugReadbackVertexBuffer(): Promise<void> {
        if (!this.device || !this.vertexBuffer || !this.debugStagingBuffer) return;

        // Check vertices from different slices to find where the gap is
        const slicesToCheck = [
            0, 1,  // Start
            Math.floor(this.config.sliceCount * 0.25),  // 25%
            Math.floor(this.config.sliceCount * 0.5),   // 50%
            Math.floor(this.config.sliceCount * 0.75),  // 75%
            this.currentSlice > 0 ? this.currentSlice - 1 : 0,
            this.currentSlice,
            (this.currentSlice + 1) % this.config.sliceCount,
            this.config.sliceCount - 1,  // End
        ];

        console.log("=== VERTEX BUFFER DEBUG (checking multiple slices) ===");

        let validSlices = 0;
        let zeroSlices = 0;

        for (const sliceId of slicesToCheck) {
            // Vertex index for slice S, cube 0, vertex 0: (S * 64 + 0) * 24 + 0
            const vertexIndex = sliceId * 64 * 24;
            const byteOffset = vertexIndex * VERTEX_STRUCT_SIZE;
            const readSize = VERTEX_STRUCT_SIZE * 6; // Read first 6 vertices of this slice

            const commandEncoder = this.device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(this.vertexBuffer, byteOffset, this.debugStagingBuffer, 0, readSize);
            this.device.queue.submit([commandEncoder.finish()]);

            await this.debugStagingBuffer.mapAsync(GPUMapMode.READ, 0, readSize);
            const data = new Float32Array(this.debugStagingBuffer.getMappedRange(0, readSize).slice(0));
            this.debugStagingBuffer.unmap();

            const pos = [data[0], data[1], data[2]];
            const isZero = Math.abs(pos[0]) < 0.001 && Math.abs(pos[1]) < 0.001 && Math.abs(pos[2]) < 0.001;

            if (isZero) zeroSlices++;
            else validSlices++;

            console.log(`Slice ${sliceId}: pos=[${pos.map(v => v.toFixed(2)).join(', ')}] ${isZero ? '⚠️ ZERO' : '✓'}`);
        }

        console.log(`Summary: ${validSlices} valid, ${zeroSlices} zero positions out of ${slicesToCheck.length} checked`);

        // Also check transform matrices for the zero slices
        console.log("=== CHECKING TRANSFORMS FOR PROBLEM SLICES ===");
        const sliceData = await this.readSliceBuffer();
        if (sliceData) {
            for (const sliceId of slicesToCheck) {
                const offset = sliceId * (SLICE_STRUCT_SIZE / 4);
                const transformDiag = [sliceData[offset + 0], sliceData[offset + 5], sliceData[offset + 10], sliceData[offset + 15]];
                const isIdentityish = transformDiag.every(v => Math.abs(v - 1) < 0.0001 || Math.abs(v) < 0.0001);
                const hasNaN = transformDiag.some(v => isNaN(v));
                const hasInf = transformDiag.some(v => !isFinite(v));
                console.log(`Slice ${sliceId} transform diag: [${transformDiag.map(v => v.toFixed(3)).join(', ')}] ${hasNaN ? '⚠️ NaN!' : ''} ${hasInf ? '⚠️ Inf!' : ''}`);
            }
        }
    }

    private async readSliceBuffer(): Promise<Float32Array | null> {
        if (!this.device || !this.sliceBuffer || !this.debugStagingBuffer) return null;

        const readSize = this.config.sliceCount * SLICE_STRUCT_SIZE;
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.sliceBuffer, 0, this.debugStagingBuffer, 0, readSize);
        this.device.queue.submit([commandEncoder.finish()]);

        await this.debugStagingBuffer.mapAsync(GPUMapMode.READ, 0, readSize);
        const data = new Float32Array(this.debugStagingBuffer.getMappedRange(0, readSize).slice(0));
        this.debugStagingBuffer.unmap();
        return data;
    }

    private debugLogRenderState(): void {
        const camera = GlobalApp.instance?.perspCam;
        if (!camera) {
            console.warn("DEBUG: No perspective camera available!");
            return;
        }

        console.log("=== RENDER STATE DEBUG ===");
        console.log("Camera position:", camera.position);
        console.log("Camera rotation:", camera.rotation);
        console.log("Canvas size:", this.canvas?.width, "x", this.canvas?.height);
        console.log("Current slice:", this.currentSlice);
        console.log("Total vertices to draw:", this.config.sliceCount * 64 * 24);
        console.log("Config:", {
            sliceCount: this.config.sliceCount,
            cubeCount: this.config.cubeCount,
            radius: this.config.radius,
            hue: this.config.hue,
        });
    }

    destroy(): void {
        // Clean up WebGPU resources
        this.sliceBuffer?.destroy();
        this.vertexBuffer?.destroy();
        this.particleBuffer?.destroy();
        this.setNowUniformBuffer?.destroy();
        this.transformPerSecondUniformBuffer?.destroy();
        this.offsetPerSecondUniformBuffer?.destroy();
        this.vertexGenUniformBuffer?.destroy();
        this.particleForceUniformBuffer?.destroy();
        this.renderUniformBuffer?.destroy();
        this.depthTexture?.destroy();
        this.debugStagingBuffer?.destroy();

        // Remove canvas
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        super.destroy();
    }
}
