// Transform slices per second compute shader

// CubeTunnelSlice struct - 128 bytes, properly aligned
struct CubeTunnelSlice {
    transform: mat4x4<f32>,        // offset 0, 64 bytes
    ringRadiusAndColor: vec4<f32>, // offset 64: xyz=color(HSV), w=radius
    cubeSize: vec4<f32>,           // offset 80: xyz=size, w=spread
    cubeSpin: vec4<f32>,           // offset 96: xyz=spin, w=radiusCrunch
    params: vec4<f32>,             // offset 112: x=cubeCount, y=exists, z=setTime, w=unused
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
