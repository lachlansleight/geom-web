// Set current slice parameters compute shader

// CubeTunnelSlice struct - 128 bytes, properly aligned
// All vec4 to avoid alignment issues
struct CubeTunnelSlice {
    transform: mat4x4<f32>,        // offset 0, 64 bytes
    ringRadiusAndColor: vec4<f32>, // offset 64: xyz=color(HSV), w=radius
    cubeSize: vec4<f32>,           // offset 80: xyz=size, w=spread
    cubeSpin: vec4<f32>,           // offset 96: xyz=spin, w=radiusCrunch
    params: vec4<f32>,             // offset 112: x=cubeCount, y=exists, z=setTime, w=unused
}

// NOTE: In WGSL uniform buffers, vec3 has 16-byte alignment!
// We use vec4 to make alignment explicit and match TypeScript layout
struct SetNowUniforms {
    currentTransform: mat4x4<f32>,   // offset 0, size 64
    currentRingColor: vec4<f32>,     // offset 64 (xyz = HSV, w = ringRadius)
    currentCubeSize: vec4<f32>,      // offset 80 (xy = fill/height, zw = unused)
    currentCubeSpin: vec4<f32>,      // offset 96 (xyz = spin, w = spread)
    params: vec4<f32>,               // offset 112 (x = radiusCrunch, y = cubeCount, z = time, w = unused)
    currentSlice: u32,               // offset 128
}

@group(0) @binding(0) var<storage, read_write> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<uniform> uniforms: SetNowUniforms;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let sliceId = uniforms.currentSlice;

    var slice: CubeTunnelSlice;

    slice.transform = uniforms.currentTransform;
    slice.ringRadiusAndColor = uniforms.currentRingColor; // xyz=HSV, w=radius
    slice.cubeSize = uniforms.currentCubeSize;             // xyz=size, w=spread
    slice.cubeSpin = uniforms.currentCubeSpin;             // xyz=spin, w=radiusCrunch
    slice.params = vec4<f32>(uniforms.params.y, 1.0, uniforms.params.z, 0.0); // x=cubeCount, y=exists, z=setTime

    sliceBuffer[sliceId] = slice;
}
