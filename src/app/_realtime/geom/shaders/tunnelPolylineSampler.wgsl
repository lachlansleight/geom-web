// Samples the slice-tunnel floor at many world-Z planes (same straddle +
// analytical lowest-Y on each slice's tilted circle as floorProbe).

struct CubeTunnelSlice {
    transform: mat4x4<f32>,
    ringRadiusAndColor: vec4<f32>,
    cubeSize: vec4<f32>,
    cubeSpin: vec4<f32>,
    params: vec4<f32>,
}

struct TunnelPolylineUniforms {
    counts: vec4<u32>,   // x = sliceCount, z = zSampleCount
    z_range: vec4<f32>,  // x = zMin, y = zMax
}

@group(0) @binding(0) var<storage, read> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<storage, read_write> outBuffer: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> uniforms: TunnelPolylineUniforms;

fn ring_center(slice: CubeTunnelSlice) -> vec3<f32> {
    return (slice.transform * vec4<f32>(0.0, 0.0, 0.0, 1.0)).xyz;
}

fn ring_radius(slice: CubeTunnelSlice) -> f32 {
    return slice.ringRadiusAndColor.w * slice.cubeSpin.w;
}

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

fn floor_at_plane(target_z: f32, slice_count: u32) -> vec4<f32> {
    var best_below_delta: f32 = -1.0e30;
    var best_above_delta: f32 = 1.0e30;
    var best_below_idx: i32 = -1;
    var best_above_idx: i32 = -1;

    for (var i: u32 = 0u; i < slice_count; i = i + 1u) {
        let s = sliceBuffer[i];
        if (s.params.y < 0.5) {
            continue;
        }
        let z = ring_center(s).z;
        let delta = z - target_z;
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
        return vec4<f32>(0.0, 0.0, target_z, 0.0);
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
            t = clamp((target_z - z_a) / denom, 0.0, 1.0);
        }
    }

    let r_a = ring_radius(slice_a);
    let r_b = ring_radius(slice_b);
    let low_a = lowest_ring_point_xy(slice_a, r_a);
    let low_b = lowest_ring_point_xy(slice_b, r_b);

    let floor_x = mix(low_a.x, low_b.x, t);
    let floor_y = mix(low_a.y, low_b.y, t);

    return vec4<f32>(floor_x, floor_y, target_z, 1.0);
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    let z_count = uniforms.counts.z;
    if (i >= z_count) {
        return;
    }

    let denom = f32(max(z_count - 1u, 1u));
    let target_z = mix(uniforms.z_range.x, uniforms.z_range.y, f32(i) / denom);
    outBuffer[i] = floor_at_plane(target_z, uniforms.counts.x);
}
