// Shared structs and utility functions for GEOM system

struct CubeTunnelSlice {
    transform: mat4x4<f32>,      // 64 bytes
    ringRadius: f32,             // 4 bytes
    ringColor: vec3<f32>,        // 12 bytes (HSV)
    cubeSize: vec3<f32>,         // 12 bytes (fill, height, unused)
    cubeSpin: vec3<f32>,         // 12 bytes (euler angles in radians)
    ringSpread: f32,             // 4 bytes
    radiusCrunch: f32,           // 4 bytes
    cubeCount: f32,              // 4 bytes
    exists: f32,                 // 4 bytes
    setTime: f32,                // 4 bytes
    padding: f32,                // 4 bytes
}

struct GeomVertex {
    position: vec3<f32>,         // 12 bytes
    normal: vec3<f32>,           // 12 bytes
    color: vec3<f32>,            // 12 bytes (RGB)
    uv: vec2<f32>,               // 8 bytes
    padding: f32,                // 4 bytes
}

struct SliceUniforms {
    time: f32,
    deltaTime: f32,
    currentSlice: u32,
    sliceCount: u32,
    minShowSlice: u32,
    maxShowSlice: u32,
    padding: vec2<f32>,
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

struct TransformPerSecondUniforms {
    transformPerSecond: mat4x4<f32>,
    currentSlice: u32,
    sliceCount: u32,
    padding: vec2<f32>,
}

struct OffsetPerSecondUniforms {
    deltaTime: f32,
    offsetRadiusPerSecond: f32,
    offsetColorPerSecond: vec3<f32>,
    offsetSizePerSecond: vec3<f32>,
    offsetSpinPerSecond: vec3<f32>,
    offsetSpreadPerSecond: f32,
    currentSlice: u32,
    sliceCount: u32,
    padding: vec2<f32>,
}

struct VertexGenUniforms {
    cubeRotateAmount: vec3<f32>,
    endCrunchSlices: f32,
    time: f32,
    currentSlice: u32,
    sliceCount: u32,
    minShowSlice: u32,
    maxShowSlice: u32,
    offsetFalloff: f32,
    offsetRadius: f32,
    offsetColor: vec3<f32>,
    offsetSize: vec3<f32>,
    offsetSpin: vec3<f32>,
    offsetSpread: f32,
    padding: vec2<f32>,
}

// Euler rotation (X -> Y -> Z order)
fn eulerRotate(input: vec3<f32>, eulers: vec3<f32>) -> vec3<f32> {
    let cx = cos(eulers.x);
    let sx = sin(eulers.x);
    let cy = cos(eulers.y);
    let sy = sin(eulers.y);
    let cz = cos(eulers.z);
    let sz = sin(eulers.z);

    let rotX = mat3x3<f32>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(0.0, cx, -sx),
        vec3<f32>(0.0, sx, cx)
    );
    let rotY = mat3x3<f32>(
        vec3<f32>(cy, 0.0, sy),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(-sy, 0.0, cy)
    );
    let rotZ = mat3x3<f32>(
        vec3<f32>(cz, -sz, 0.0),
        vec3<f32>(sz, cz, 0.0),
        vec3<f32>(0.0, 0.0, 1.0)
    );

    return rotX * rotY * rotZ * input;
}

// Reverse euler rotation (Z -> Y -> X order)
fn eulerRotateReverse(input: vec3<f32>, eulers: vec3<f32>) -> vec3<f32> {
    let cx = cos(eulers.x);
    let sx = sin(eulers.x);
    let cy = cos(eulers.y);
    let sy = sin(eulers.y);
    let cz = cos(eulers.z);
    let sz = sin(eulers.z);

    let rotX = mat3x3<f32>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(0.0, cx, -sx),
        vec3<f32>(0.0, sx, cx)
    );
    let rotY = mat3x3<f32>(
        vec3<f32>(cy, 0.0, sy),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(-sy, 0.0, cy)
    );
    let rotZ = mat3x3<f32>(
        vec3<f32>(cz, -sz, 0.0),
        vec3<f32>(sz, cz, 0.0),
        vec3<f32>(0.0, 0.0, 1.0)
    );

    return rotZ * rotY * rotX * input;
}

// HSV to RGB conversion
fn hsv2rgb(c: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(vec3<f32>(c.x, c.x, c.x) + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
}

const PI: f32 = 3.1415926;
const TAU: f32 = 6.2831853;

// Default cube template vertices (4 faces * 4 vertices)
// Face 0 (-X): indices 0-3
// Face 1 (+Y): indices 4-7
// Face 2 (+X): indices 8-11
// Face 3 (-Y): indices 12-15
const DEFAULT_CUBE: array<vec3<f32>, 16> = array<vec3<f32>, 16>(
    // -X face
    vec3<f32>(-1.0, 1.0, -1.0), vec3<f32>(-1.0, -1.0, -1.0),
    vec3<f32>(-1.0, -1.0, 1.0), vec3<f32>(-1.0, 1.0, 1.0),
    // +Y face
    vec3<f32>(1.0, 1.0, -1.0), vec3<f32>(-1.0, 1.0, -1.0),
    vec3<f32>(-1.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, 1.0),
    // +X face
    vec3<f32>(1.0, -1.0, -1.0), vec3<f32>(1.0, 1.0, -1.0),
    vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.0, -1.0, 1.0),
    // -Y face
    vec3<f32>(-1.0, -1.0, -1.0), vec3<f32>(1.0, -1.0, -1.0),
    vec3<f32>(1.0, -1.0, 1.0), vec3<f32>(-1.0, -1.0, 1.0)
);

// UV coordinates for cube faces
const CUBE_UVS: array<vec2<f32>, 16> = array<vec2<f32>, 16>(
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0)
);
