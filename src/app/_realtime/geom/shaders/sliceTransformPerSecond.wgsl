// Transform slices per second compute shader

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

struct TransformPerSecondUniforms {
    transformPerSecond: mat4x4<f32>,
    currentSlice: u32,
    sliceCount: u32,
    padding: vec2<f32>,
}

@group(0) @binding(0) var<storage, read_write> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<uniform> uniforms: TransformPerSecondUniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let sliceId = globalId.x;

    if (sliceId >= uniforms.sliceCount) {
        return;
    }

    // Skip current slice - it's being set by SetNow
    if (sliceId == uniforms.currentSlice) {
        return;
    }

    var slice = sliceBuffer[sliceId];

    // Apply per-second transform to all other slices
    slice.transform = uniforms.transformPerSecond * slice.transform;

    sliceBuffer[sliceId] = slice;
}
