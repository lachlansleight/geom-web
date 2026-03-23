// Vertex generation compute shader - generates triangle geometry from slices

// CubeTunnelSlice struct - 128 bytes, properly aligned
struct CubeTunnelSlice {
    transform: mat4x4<f32>,        // offset 0, 64 bytes
    ringRadiusAndColor: vec4<f32>, // offset 64: xyz=color(HSV), w=radius
    cubeSize: vec4<f32>,           // offset 80: xyz=size, w=spread
    cubeSpin: vec4<f32>,           // offset 96: xyz=spin, w=radiusCrunch
    params: vec4<f32>,             // offset 112: x=cubeCount, y=exists, z=setTime, w=unused
}

// Helper functions to access slice fields
fn getRadius(slice: CubeTunnelSlice) -> f32 { return slice.ringRadiusAndColor.w; }
fn getColor(slice: CubeTunnelSlice) -> vec3<f32> { return slice.ringRadiusAndColor.xyz; }
fn getSize(slice: CubeTunnelSlice) -> vec3<f32> { return slice.cubeSize.xyz; }
fn getSpread(slice: CubeTunnelSlice) -> f32 { return slice.cubeSize.w; }
fn getSpin(slice: CubeTunnelSlice) -> vec3<f32> { return slice.cubeSpin.xyz; }
fn getRadiusCrunch(slice: CubeTunnelSlice) -> f32 { return slice.cubeSpin.w; }
fn getCubeCount(slice: CubeTunnelSlice) -> f32 { return slice.params.x; }
fn getExists(slice: CubeTunnelSlice) -> f32 { return slice.params.y; }

struct GeomVertex {
    position: vec3<f32>,
    normal: vec3<f32>,
    color: vec3<f32>,
    uv: vec2<f32>,
    padding: f32,
}

// VertexGenUniforms - all vec4 for proper alignment (128 bytes)
struct VertexGenUniforms {
    cubeRotateAndCrunch: vec4<f32>,   // xyz=cubeRotateAmount, w=endCrunchSlices
    timeAndSlices: vec4<u32>,          // x=currentSlice, y=sliceCount, z=minShowSlice, w=maxShowSlice
    offsetParams: vec4<f32>,           // x=offsetFalloff, y=offsetRadius, z=time, w=unused
    offsetColor: vec4<f32>,            // xyz=offsetColor, w=unused
    offsetSize: vec4<f32>,             // xyz=offsetSize, w=unused
    offsetSpinAndSpread: vec4<f32>,    // xyz=offsetSpin, w=offsetSpread
}

@group(0) @binding(0) var<storage, read> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<storage, read_write> vertexBuffer: array<GeomVertex>;
@group(0) @binding(2) var<uniform> uniforms: VertexGenUniforms;

const PI: f32 = 3.1415926;
const TAU: f32 = 6.2831853;

// Default cube template (4 faces * 4 vertices)
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

const CUBE_UVS: array<vec2<f32>, 16> = array<vec2<f32>, 16>(
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0)
);

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

fn hsv2rgb(c: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(vec3<f32>(c.x, c.x, c.x) + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
}

fn transformPoint(m: mat4x4<f32>, p: vec3<f32>) -> vec3<f32> {
    let result = m * vec4<f32>(p, 1.0);
    return result.xyz;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>, @builtin(workgroup_id) groupId: vec3<u32>) {
    let sliceId = groupId.x;
    let cubeId = globalId.x % 64u;

    if (sliceId >= uniforms.timeAndSlices.y) {
        return;
    }

    let slice = sliceBuffer[sliceId];

    // Determine last slice ID (wrapping)
    var lastSliceId = sliceId;
    if (sliceId == 0u) {
        lastSliceId = uniforms.timeAndSlices.w - 1u;
    } else {
        lastSliceId = sliceId - 1u;
    }

    // Handle wrap-around at current slice boundary
    if (sliceId == uniforms.timeAndSlices.x + 1u || (sliceId == 0u && uniforms.timeAndSlices.x == uniforms.timeAndSlices.y - 1u)) {
        lastSliceId = sliceId;
    }

    let lastSlice = sliceBuffer[lastSliceId];

    // Calculate slice offsets for effects
    var sliceOffset: u32;
    if (sliceId > uniforms.timeAndSlices.x) {
        sliceOffset = uniforms.timeAndSlices.x + (uniforms.timeAndSlices.y - sliceId);
    } else {
        sliceOffset = uniforms.timeAndSlices.x - sliceId;
    }
    let slicePositionFactor = f32(sliceOffset) / f32(uniforms.timeAndSlices.y);
    let offsetFactor = mix(1.0, slicePositionFactor, uniforms.offsetParams.x);

    var lastSliceOffset: u32;
    if (lastSliceId > uniforms.timeAndSlices.x) {
        lastSliceOffset = uniforms.timeAndSlices.x + (uniforms.timeAndSlices.y - lastSliceId);
    } else {
        lastSliceOffset = uniforms.timeAndSlices.x - lastSliceId;
    }
    let lastOffsetFactor = mix(1.0, f32(lastSliceOffset) / f32(uniforms.timeAndSlices.y), uniforms.offsetParams.x);

    // Apply momentary offsets using helper functions
    let lastRadius = getRadius(lastSlice) + uniforms.offsetParams.y * lastOffsetFactor;
    let lastColor = getColor(lastSlice) + uniforms.offsetColor.xyz * lastOffsetFactor;
    var lastSize = getSize(lastSlice) + uniforms.offsetSize.xyz * lastOffsetFactor;
    let lastSpin = getSpin(lastSlice) + uniforms.offsetSpinAndSpread.xyz * lastOffsetFactor;
    let lastSpread = getSpread(lastSlice) + uniforms.offsetSpinAndSpread.w * lastOffsetFactor;

    let thisRadius = getRadius(slice) + uniforms.offsetParams.y * offsetFactor;
    let thisColor = getColor(slice) + uniforms.offsetColor.xyz * offsetFactor;
    var thisSize = getSize(slice) + uniforms.offsetSize.xyz * offsetFactor;
    let thisSpin = getSpin(slice) + uniforms.offsetSpinAndSpread.xyz * offsetFactor;
    let thisSpread = getSpread(slice) + uniforms.offsetSpinAndSpread.w * offsetFactor;

    // End crunch - shrink slices near the current slice
    let offsetToCurrent = abs(i32(sliceId) - i32(uniforms.timeAndSlices.x));
    let offsetToLast = abs(i32(lastSliceId) - i32(uniforms.timeAndSlices.x));
    let halfSliceCount = i32(uniforms.timeAndSlices.w) / 2;
    var adjustedOffsetToCurrent = offsetToCurrent;
    var adjustedOffsetToLast = offsetToLast;
    if (adjustedOffsetToCurrent > halfSliceCount) {
        adjustedOffsetToCurrent = i32(uniforms.timeAndSlices.w) - adjustedOffsetToCurrent;
    }
    if (adjustedOffsetToLast > halfSliceCount) {
        adjustedOffsetToLast = i32(uniforms.timeAndSlices.w) - adjustedOffsetToLast;
    }

    if (uniforms.cubeRotateAndCrunch.w > 0.5) {
        let currentOffset = saturate(f32(adjustedOffsetToCurrent) / uniforms.cubeRotateAndCrunch.w);
        let lastOffsetCrunch = saturate(f32(adjustedOffsetToLast) / uniforms.cubeRotateAndCrunch.w);
        thisSize = thisSize * currentOffset;
        lastSize = lastSize * lastOffsetCrunch;
    }

    // Crunch at tunnel ends
    if (sliceId == 0u && uniforms.timeAndSlices.x == uniforms.timeAndSlices.w - 1u) {
        thisSize = vec3<f32>(0.01, 0.01, 0.01);
    }
    if (sliceId == uniforms.timeAndSlices.x) {
        thisSize = vec3<f32>(0.01, 0.01, 0.01);
    }

    // Visibility range
    // if (sliceOffset <= uniforms.timeAndSlices.z || sliceOffset >= uniforms.timeAndSlices.w) {
    //     thisSize = vec3<f32>(0.01, 0.01, 0.01);
    // }
    // if (lastSliceOffset <= uniforms.timeAndSlices.z || lastSliceOffset >= uniforms.timeAndSlices.w) {
    //     lastSize = vec3<f32>(0.01, 0.01, 0.01);
    // }

    // Check if slices exist
    if (getExists(slice) < 0.5 || getExists(lastSlice) < 0.5) {
        thisSize = vec3<f32>(0.0, 0.0, 0.0);
        lastSize = vec3<f32>(0.0, 0.0, 0.0);
    }

    let thisCubeCount = u32(ceil(getCubeCount(slice)));
    let lastCubeCount = u32(ceil(getCubeCount(lastSlice)));

    // Skip cubes beyond count
    if (cubeId >= thisCubeCount) {
        let startVertexId = (sliceId * 64u + cubeId) * 24u;
        for (var i = 0u; i < 24u; i = i + 1u) {
            var vert = vertexBuffer[startVertexId + i];
            vert.position = vec3<f32>(0.0, 0.0, 0.0);
            vert.normal = vec3<f32>(0.0, 0.0, 0.0);
            vert.color = vec3<f32>(0.0, 0.0, 0.0);
            vertexBuffer[startVertexId + i] = vert;
        }
        return;
    }

    // Calculate cube positions in ring
    let cubeT = f32(cubeId) / getCubeCount(slice);
    let lastCubeT = f32(cubeId) / getCubeCount(lastSlice);

    let lastCubeWidth = TAU * lastRadius * getRadiusCrunch(lastSlice) / max(4.0, f32(lastCubeCount));
    let cubeWidth = TAU * thisRadius * getRadiusCrunch(slice) / max(4.0, f32(thisCubeCount));
    let cubeRotateBase = cubeT * TAU * thisSpread;
    let lastCubeRotateBase = lastCubeT * TAU * lastSpread;

    let cubeRotate = cubeRotateBase * uniforms.cubeRotateAndCrunch.xyz;
    let lastCubeRotate = lastCubeRotateBase * uniforms.cubeRotateAndCrunch.xyz;

    var lastCubeScaleX = 0.5 * lastCubeWidth * lastSize.x;
    var lastCubeScaleY = lastCubeScaleX * lastSize.y;
    var cubeScaleX = 0.5 * cubeWidth * thisSize.x;
    var cubeScaleY = cubeScaleX * thisSize.y;

    // Apply radius crunch
    let lastRadiusCrunched = lastRadius * getRadiusCrunch(lastSlice);
    let thisRadiusCrunched = thisRadius * getRadiusCrunch(slice);

    let offsetA = lastRadiusCrunched * vec3<f32>(cos(lastCubeRotateBase), sin(lastCubeRotateBase), 0.0);
    let offsetB = thisRadiusCrunched * vec3<f32>(cos(cubeRotateBase), sin(cubeRotateBase), 0.0);

    // Build cube vertices
    var cube: array<vec3<f32>, 16>;
    for (var i = 0u; i < 4u; i = i + 1u) {
        // Scale cubes (Z becomes 0)
        cube[i * 4u + 0u] = DEFAULT_CUBE[i * 4u + 0u] * vec3<f32>(lastCubeScaleY, lastCubeScaleX, 0.0);
        cube[i * 4u + 1u] = DEFAULT_CUBE[i * 4u + 1u] * vec3<f32>(lastCubeScaleY, lastCubeScaleX, 0.0);
        cube[i * 4u + 2u] = DEFAULT_CUBE[i * 4u + 2u] * vec3<f32>(cubeScaleY, cubeScaleX, 0.0);
        cube[i * 4u + 3u] = DEFAULT_CUBE[i * 4u + 3u] * vec3<f32>(cubeScaleY, cubeScaleX, 0.0);

        // Spin cubes
        cube[i * 4u + 0u] = eulerRotateReverse(cube[i * 4u + 0u], lastSpin + lastCubeRotate);
        cube[i * 4u + 1u] = eulerRotateReverse(cube[i * 4u + 1u], lastSpin + lastCubeRotate);
        cube[i * 4u + 2u] = eulerRotateReverse(cube[i * 4u + 2u], thisSpin + cubeRotate);
        cube[i * 4u + 3u] = eulerRotateReverse(cube[i * 4u + 3u], thisSpin + cubeRotate);

        // Place in ring
        cube[i * 4u + 0u] = cube[i * 4u + 0u] + offsetA;
        cube[i * 4u + 1u] = cube[i * 4u + 1u] + offsetA;
        cube[i * 4u + 2u] = cube[i * 4u + 2u] + offsetB;
        cube[i * 4u + 3u] = cube[i * 4u + 3u] + offsetB;
    }

    // Transform by slice matrices
    for (var i = 0u; i < 4u; i = i + 1u) {
        cube[i * 4u + 0u] = transformPoint(lastSlice.transform, cube[i * 4u + 0u]);
        cube[i * 4u + 1u] = transformPoint(lastSlice.transform, cube[i * 4u + 1u]);
        cube[i * 4u + 2u] = transformPoint(slice.transform, cube[i * 4u + 2u]);
        cube[i * 4u + 3u] = transformPoint(slice.transform, cube[i * 4u + 3u]);
    }

    // Generate vertices for 4 faces
    let colorRgb = hsv2rgb(thisColor);
    let lastColorRgb = hsv2rgb(lastColor);

    let startVertexId = (sliceId * 64u + cubeId) * 24u;

    for (var face = 0u; face < 4u; face = face + 1u) {
        let baseIdx = face * 4u;

        // Calculate normal
        let edge1 = cube[baseIdx + 1u] - cube[baseIdx + 0u];
        let edge2 = cube[baseIdx + 3u] - cube[baseIdx + 0u];
        let normal = normalize(cross(edge1, edge2));

        // Write 6 vertices per face (2 triangles)
        let faceVertexBase = startVertexId + face * 6u;

        // Triangle 1: vertices 1, 2, 3
        var vert0 = vertexBuffer[faceVertexBase + 0u];
        vert0.position = cube[baseIdx + 1u];
        vert0.normal = normal;
        vert0.color = lastColorRgb;
        vert0.uv = CUBE_UVS[baseIdx + 1u];
        vertexBuffer[faceVertexBase + 0u] = vert0;

        var vert1 = vertexBuffer[faceVertexBase + 1u];
        vert1.position = cube[baseIdx + 2u];
        vert1.normal = normal;
        vert1.color = colorRgb;
        vert1.uv = CUBE_UVS[baseIdx + 2u];
        vertexBuffer[faceVertexBase + 1u] = vert1;

        var vert2 = vertexBuffer[faceVertexBase + 2u];
        vert2.position = cube[baseIdx + 3u];
        vert2.normal = normal;
        vert2.color = colorRgb;
        vert2.uv = CUBE_UVS[baseIdx + 3u];
        vertexBuffer[faceVertexBase + 2u] = vert2;

        // Triangle 2: vertices 3, 0, 1
        var vert3 = vertexBuffer[faceVertexBase + 3u];
        vert3.position = cube[baseIdx + 3u];
        vert3.normal = normal;
        vert3.color = colorRgb;
        vert3.uv = CUBE_UVS[baseIdx + 3u];
        vertexBuffer[faceVertexBase + 3u] = vert3;

        var vert4 = vertexBuffer[faceVertexBase + 4u];
        vert4.position = cube[baseIdx + 0u];
        vert4.normal = normal;
        vert4.color = lastColorRgb;
        vert4.uv = CUBE_UVS[baseIdx + 0u];
        vertexBuffer[faceVertexBase + 4u] = vert4;

        var vert5 = vertexBuffer[faceVertexBase + 5u];
        vert5.position = cube[baseIdx + 1u];
        vert5.normal = normal;
        vert5.color = lastColorRgb;
        vert5.uv = CUBE_UVS[baseIdx + 1u];
        vertexBuffer[faceVertexBase + 5u] = vert5;
    }
}
