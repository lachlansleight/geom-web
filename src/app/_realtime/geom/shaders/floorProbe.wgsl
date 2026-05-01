// Floor probe compute shader.
//
// Finds slices whose ring-centre Z straddles cameraZ, lerps the analytical
// lowest-world-Y point on each slice's tilted circle (no discrete θ samples).
//
// Circle in slice-local XY: (r cos θ, r sin θ, 0). World point:
//   P(θ) = o + r (a cos θ + b sin θ)
// where a,b are transform columns 0,1 (xyz) and o is column 3 (ring centre).
//   Py(θ) = oy + r(ay cos θ + by sin θ)  →  min at oy − r·sqrt(ay²+by²)
// unless ay=by=0 (ring parallel to horizontal), then y is constant = oy.

struct CubeTunnelSlice {
    transform: mat4x4<f32>,
    ringRadiusAndColor: vec4<f32>,
    cubeSize: vec4<f32>,
    cubeSpin: vec4<f32>,
    params: vec4<f32>,
}

// 32 bytes: row0 f32 (cameraZ), row1 u32 (sliceCount)
struct FloorProbeUniforms {
    line0: vec4<f32>,  // x = cameraZ
    line1: vec4<u32>,  // x = sliceCount
}

@group(0) @binding(0) var<storage, read> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<storage, read_write> probeBuffer: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> uniforms: FloorProbeUniforms;

fn ring_center(slice: CubeTunnelSlice) -> vec3<f32> {
    return (slice.transform * vec4<f32>(0.0, 0.0, 0.0, 1.0)).xyz;
}

fn ring_radius(slice: CubeTunnelSlice) -> f32 {
    return slice.ringRadiusAndColor.w * slice.cubeSpin.w;
}

// Lowest world-Y on the tilted circle; returns (world_x_at_that_point, world_y_min).
fn lowest_ring_point_xy(slice: CubeTunnelSlice, r: f32) -> vec2<f32> {
    let a = slice.transform[0].xyz;
    let b = slice.transform[1].xyz;
    let o = slice.transform[3].xyz;
    let denom = sqrt(a.y * a.y + b.y * b.y);
    if (denom < 1.0e-8) {
        let p = o + r * a;
        return vec2<f32>(p.x, p.y);
    }
    let p = o - r * (a * a.y + b * b.y) / denom;
    return vec2<f32>(p.x, p.y);
}

@compute @workgroup_size(1)
fn main() {
    let camera_z = uniforms.line0.x;
    let count = uniforms.line1.x;

    var best_below_delta: f32 = -1.0e30;
    var best_above_delta: f32 = 1.0e30;
    var best_below_idx: i32 = -1;
    var best_above_idx: i32 = -1;

    for (var i: u32 = 0u; i < count; i = i + 1u) {
        let s = sliceBuffer[i];
        if (s.params.y < 0.5) {
            continue;
        }
        let z = ring_center(s).z;
        let delta = z - camera_z;
        if (delta <= 0.0 && delta > best_below_delta) {
            best_below_delta = delta;
            best_below_idx = i32(i);
        }
        if (delta >= 0.0 && delta < best_above_delta) {
            best_above_delta = delta;
            best_above_idx = i32(i);
        }
    }

    if (best_below_idx < 0 && best_above_idx < 0) {
        probeBuffer[0] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        return;
    }

    var idx_a = best_below_idx;
    var idx_b = best_above_idx;
    if (idx_a < 0) { idx_a = idx_b; }
    if (idx_b < 0) { idx_b = idx_a; }

    let slice_a = sliceBuffer[u32(idx_a)];
    let slice_b = sliceBuffer[u32(idx_b)];

    let z_a = ring_center(slice_a).z;
    let z_b = ring_center(slice_b).z;

    var t: f32 = 0.0;
    if (idx_a != idx_b) {
        let denom = z_b - z_a;
        if (abs(denom) > 1.0e-6) {
            t = clamp((camera_z - z_a) / denom, 0.0, 1.0);
        }
    }

    let r_a = ring_radius(slice_a);
    let r_b = ring_radius(slice_b);
    let low_a = lowest_ring_point_xy(slice_a, r_a);
    let low_b = lowest_ring_point_xy(slice_b, r_b);

    let floor_x = mix(low_a.x, low_b.x, t);
    let floor_y = mix(low_a.y, low_b.y, t);
    let ring_z = mix(z_a, z_b, t);

    probeBuffer[0] = vec4<f32>(floor_x, floor_y, ring_z, 1.0);
}
