import tunnelPolylineSamplerShader from "./shaders/tunnelPolylineSampler.wgsl";

/** Number of Z planes from zMin through zMax (inclusive endpoints). */
export const TUNNEL_POLYLINE_Z_SAMPLES = 101;

const UNIFORM_SIZE = 32;
const OUT_BYTE_SIZE = TUNNEL_POLYLINE_Z_SAMPLES * 16;

/**
 * GPU multi-plane floor samples (same straddle + ring-floor logic as the
 * single-point floor probe), read back async for Three.js debug drawing.
 */
export default class TunnelPolylineService {
    private device: GPUDevice;
    private sliceBuffer: GPUBuffer;

    private pipeline: GPUComputePipeline | null = null;
    private bindGroup: GPUBindGroup | null = null;

    private uniformBuffer: GPUBuffer;
    private outBuffer: GPUBuffer;
    private stagingBuffer: GPUBuffer;
    private stagingBusy = false;

    /** Latest copy of `outBuffer` after map; length `TUNNEL_POLYLINE_Z_SAMPLES * 4` (xyzw per point). */
    private _latest: Float32Array | null = null;

    private _sliceCount: number;
    private _zMin = 0;
    private _zMax = 100;

    constructor(device: GPUDevice, sliceBuffer: GPUBuffer, sliceCount: number) {
        this.device = device;
        this.sliceBuffer = sliceBuffer;
        this._sliceCount = sliceCount;

        this.uniformBuffer = device.createBuffer({
            size: UNIFORM_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.outBuffer = device.createBuffer({
            size: OUT_BYTE_SIZE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        this.stagingBuffer = device.createBuffer({
            size: OUT_BYTE_SIZE,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        this.buildPipeline();
        this.writeUniforms();
    }

    get latest(): Float32Array | null {
        return this._latest;
    }

    setSliceCount(count: number): void {
        if (this._sliceCount === count) return;
        this._sliceCount = count;
        this.writeUniforms();
    }

    setZRange(zMin: number, zMax: number): void {
        if (this._zMin === zMin && this._zMax === zMax) return;
        this._zMin = zMin;
        this._zMax = zMax;
        this.writeUniforms();
    }

    dispatch(encoder: GPUCommandEncoder): void {
        if (!this.pipeline || !this.bindGroup) return;
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
    }

    kickReadback(): void {
        if (!this.pipeline) return;
        if (this.stagingBusy) return;

        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(this.outBuffer, 0, this.stagingBuffer, 0, OUT_BYTE_SIZE);
        this.device.queue.submit([encoder.finish()]);

        this.stagingBusy = true;
        this.stagingBuffer
            .mapAsync(GPUMapMode.READ, 0, OUT_BYTE_SIZE)
            .then(() => {
                const raw = this.stagingBuffer.getMappedRange(0, OUT_BYTE_SIZE);
                this._latest = new Float32Array(raw.slice(0));
                this.stagingBuffer.unmap();
            })
            .catch(err => {
                console.warn("TunnelPolyline readback failed", err);
            })
            .finally(() => {
                this.stagingBusy = false;
            });
    }

    destroy(): void {
        this.uniformBuffer.destroy();
        this.outBuffer.destroy();
        this.stagingBuffer.destroy();
    }

    private buildPipeline(): void {
        // eslint-disable-next-line @next/next/no-assign-module-variable
        const module = this.device.createShaderModule({ code: tunnelPolylineSamplerShader });
        this.pipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: { module, entryPoint: "main" },
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.sliceBuffer } },
                { binding: 1, resource: { buffer: this.outBuffer } },
                { binding: 2, resource: { buffer: this.uniformBuffer } },
            ],
        });
    }

    private writeUniforms(): void {
        const u32 = new Uint32Array([this._sliceCount >>> 0, 0, TUNNEL_POLYLINE_Z_SAMPLES, 0]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, u32);
        const f32 = new Float32Array([this._zMin, this._zMax, 0, 0]);
        this.device.queue.writeBuffer(this.uniformBuffer, 16, f32);
    }
}
