// Set current slice parameters compute shader

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

struct SetNowUniforms {
    currentTransform: mat4x4<f32>,
    currentRingRadius: f32,
    currentRingColor: vec3<f32>,
    currentCubeSize: vec3<f32>,
    currentCubeSpin: vec3<f32>,
    currentRingSpread: f32,
    currentRadiusCrunch: f32,
    currentCubeCount: f32,
    time: f32,
    currentSlice: u32,
    padding: vec3<f32>,
}

@group(0) @binding(0) var<storage, read_write> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<uniform> uniforms: SetNowUniforms;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let sliceId = uniforms.currentSlice;

    var slice = sliceBuffer[sliceId];

    slice.transform = uniforms.currentTransform;
    slice.ringRadius = uniforms.currentRingRadius;
    slice.ringColor = uniforms.currentRingColor;
    slice.cubeSize = uniforms.currentCubeSize;
    slice.cubeSpin = uniforms.currentCubeSpin;
    slice.ringSpread = uniforms.currentRingSpread;
    slice.radiusCrunch = uniforms.currentRadiusCrunch;
    slice.cubeCount = uniforms.currentCubeCount;
    slice.exists = 1.0;
    slice.setTime = uniforms.time;

    sliceBuffer[sliceId] = slice;
}
