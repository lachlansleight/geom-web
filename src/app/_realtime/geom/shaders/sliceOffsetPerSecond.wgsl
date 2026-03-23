// Offset slice parameters per second compute shader

struct CubeTunnelSlice {
    transform: mat4x4<f32>,
    ringRadius: f32,
    ringColor: vec3<f32>,
    cubeSize: vec3<f32>,
    cubeSpin: vec3<f32>,
    ringSpread: f32,
    radiusCrunch: f32,
    cubeCount: f32,
    exists: f32,
    setTime: f32,
    padding: f32,
}

struct OffsetPerSecondUniforms {
    deltaTime: f32,
    offsetRadiusPerSecond: f32,
    offsetSpreadPerSecond: f32,
    padding1: f32,
    offsetColorPerSecond: vec3<f32>,
    padding2: f32,
    offsetSizePerSecond: vec3<f32>,
    padding3: f32,
    offsetSpinPerSecond: vec3<f32>,
    currentSlice: u32,
    sliceCount: u32,
    padding4: vec3<f32>,
}

@group(0) @binding(0) var<storage, read_write> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<uniform> uniforms: OffsetPerSecondUniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let sliceId = globalId.x;

    if (sliceId >= uniforms.sliceCount) {
        return;
    }

    // Skip current slice
    if (sliceId == uniforms.currentSlice) {
        return;
    }

    var slice = sliceBuffer[sliceId];

    // Apply per-second offsets
    slice.ringRadius = max(0.0, slice.ringRadius + uniforms.deltaTime * uniforms.offsetRadiusPerSecond);
    slice.ringColor = slice.ringColor + uniforms.deltaTime * uniforms.offsetColorPerSecond;
    slice.cubeSize = vec3<f32>(
        max(0.0, slice.cubeSize.x + uniforms.deltaTime * uniforms.offsetSizePerSecond.x),
        max(0.0, slice.cubeSize.y + uniforms.deltaTime * uniforms.offsetSizePerSecond.y),
        max(0.0, slice.cubeSize.z + uniforms.deltaTime * uniforms.offsetSizePerSecond.z)
    );
    slice.cubeSpin = slice.cubeSpin + uniforms.deltaTime * uniforms.offsetSpinPerSecond;
    slice.ringSpread = slice.ringSpread + uniforms.deltaTime * uniforms.offsetSpreadPerSecond;

    sliceBuffer[sliceId] = slice;
}
