import floorProbeShader from "_realtime/geom/shaders/floorProbe.wgsl";

export interface FloorProbeSample {
    x: number;
    y: number;
    ringZ: number;
    exists: boolean;
}

const PROBE_BYTE_SIZE = 16; // single vec4<f32>

/**
 * Owns the GPU-side floor probe pipeline and async readback for a slice ring.
 *
 * Each frame the geom entity calls:
 *   1. setCameraZ() / setSliceCount() to update uniforms
 *   2. dispatch(encoder) inside its main command encoder
 *   3. kickReadback() after submit() to start the async copy + map
 *
 * The latest readback is exposed via `latest`. Until the first readback
 * resolves it is `null`. There is a ~1 frame delay between dispatch and
 * the value being available, which is fine for smooth camera following.
 */
export default class FloorProbeService {
    private device: GPUDevice;
    private sliceBuffer: GPUBuffer;

    private pipeline: GPUComputePipeline | null = null;
    private bindGroup: GPUBindGroup | null = null;

    private uniformBuffer: GPUBuffer;
    private probeBuffer: GPUBuffer;
    private stagingBuffer: GPUBuffer;
    private stagingBusy: boolean = false;

    private _latest: FloorProbeSample | null = null;
    private _cameraZ: number = 60;
    private _sliceCount: number = 0;

    constructor(device: GPUDevice, sliceBuffer: GPUBuffer, sliceCount: number) {
        this.device = device;
        this.sliceBuffer = sliceBuffer;
        this._sliceCount = sliceCount;

        this.uniformBuffer = device.createBuffer({
            size: 32, // two vec4 rows (f32 cameraZ + u32 sliceCount)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.probeBuffer = device.createBuffer({
            size: PROBE_BYTE_SIZE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        this.stagingBuffer = device.createBuffer({
            size: PROBE_BYTE_SIZE,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        this.buildPipeline();
        this.writeUniforms();
    }

    get latest(): FloorProbeSample | null {
        return this._latest;
    }

    setCameraZ(z: number): void {
        if (this._cameraZ === z) return;
        this._cameraZ = z;
        this.writeUniforms();
    }

    setSliceCount(count: number): void {
        if (this._sliceCount === count) return;
        this._sliceCount = count;
        this.writeUniforms();
    }

    /** Encode the probe compute pass into the supplied command encoder. */
    dispatch(encoder: GPUCommandEncoder): void {
        if (!this.pipeline || !this.bindGroup) return;
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
    }

    /**
     * Copy the probe buffer into the staging buffer and queue an async map.
     * Should be called once per frame, after the encoder containing dispatch()
     * has been submitted (we issue our own copy command here).
     */
    kickReadback(): void {
        if (!this.pipeline) return;
        if (this.stagingBusy) return; // skip frames where a readback is still in flight

        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(this.probeBuffer, 0, this.stagingBuffer, 0, PROBE_BYTE_SIZE);
        this.device.queue.submit([encoder.finish()]);

        this.stagingBusy = true;
        this.stagingBuffer
            .mapAsync(GPUMapMode.READ, 0, PROBE_BYTE_SIZE)
            .then(() => {
                const view = new Float32Array(
                    this.stagingBuffer.getMappedRange(0, PROBE_BYTE_SIZE).slice(0)
                );
                this.stagingBuffer.unmap();
                this._latest = {
                    x: view[0],
                    y: view[1],
                    ringZ: view[2],
                    exists: view[3] > 0.5,
                };
            })
            .catch(err => {
                console.warn("FloorProbe readback failed", err);
            })
            .finally(() => {
                this.stagingBusy = false;
            });
    }

    destroy(): void {
        this.uniformBuffer.destroy();
        this.probeBuffer.destroy();
        this.stagingBuffer.destroy();
    }

    private buildPipeline(): void {
        // eslint-disable-next-line @next/next/no-assign-module-variable
        const module = this.device.createShaderModule({ code: floorProbeShader });
        this.pipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: { module, entryPoint: "main" },
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.sliceBuffer } },
                { binding: 1, resource: { buffer: this.probeBuffer } },
                { binding: 2, resource: { buffer: this.uniformBuffer } },
            ],
        });
    }

    private writeUniforms(): void {
        const data = new ArrayBuffer(32);
        const f = new Float32Array(data);
        f[0] = this._cameraZ;
        const u = new Uint32Array(data, 16, 4);
        u[0] = this._sliceCount >>> 0;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
    }
}
