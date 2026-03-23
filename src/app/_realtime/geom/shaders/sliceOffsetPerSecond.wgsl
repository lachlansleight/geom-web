// Offset slice parameters per second compute shader

// CubeTunnelSlice struct - 128 bytes, properly aligned
struct CubeTunnelSlice {
    transform: mat4x4<f32>,        // offset 0, 64 bytes
    ringRadiusAndColor: vec4<f32>, // offset 64: xyz=color(HSV), w=radius
    cubeSize: vec4<f32>,           // offset 80: xyz=size, w=spread
    cubeSpin: vec4<f32>,           // offset 96: xyz=spin, w=radiusCrunch
    params: vec4<f32>,             // offset 112: x=cubeCount, y=exists, z=setTime, w=unused
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

    // Apply per-second offsets using new struct layout:
    // ringRadiusAndColor: xyz=color(HSV), w=radius
    // cubeSize: xyz=size, w=spread
    // cubeSpin: xyz=spin, w=radiusCrunch

    // Update radius (w component)
    slice.ringRadiusAndColor.w = max(0.0, slice.ringRadiusAndColor.w + uniforms.deltaTime * uniforms.offsetRadiusPerSecond);
    // Update color (xyz components)
    slice.ringRadiusAndColor = vec4<f32>(
        slice.ringRadiusAndColor.xyz + uniforms.deltaTime * uniforms.offsetColorPerSecond,
        slice.ringRadiusAndColor.w
    );
    // Update size (xyz) and spread (w)
    slice.cubeSize = vec4<f32>(
        max(0.0, slice.cubeSize.x + uniforms.deltaTime * uniforms.offsetSizePerSecond.x),
        max(0.0, slice.cubeSize.y + uniforms.deltaTime * uniforms.offsetSizePerSecond.y),
        max(0.0, slice.cubeSize.z + uniforms.deltaTime * uniforms.offsetSizePerSecond.z),
        slice.cubeSize.w + uniforms.deltaTime * uniforms.offsetSpreadPerSecond
    );
    // Update spin (xyz), radiusCrunch (w) stays the same
    slice.cubeSpin = vec4<f32>(
        slice.cubeSpin.xyz + uniforms.deltaTime * uniforms.offsetSpinPerSecond,
        slice.cubeSpin.w
    );

    sliceBuffer[sliceId] = slice;
}
