// Per-triangle particle force compute shader
// Treats each triangle as a particle with persistent state (offset + velocity),
// integrates a 3D-noise force field ramped by time-since-slice-set.
// Runs after vertexGeneration — reads base positions, writes displaced positions back.

struct CubeTunnelSlice {
    transform: mat4x4<f32>,
    ringRadiusAndColor: vec4<f32>,
    cubeSize: vec4<f32>,
    cubeSpin: vec4<f32>,
    params: vec4<f32>,  // x=cubeCount, y=exists, z=setTime, w=unused
}

struct GeomVertex {
    position: vec3<f32>,
    normal: vec3<f32>,
    color: vec3<f32>,
    uv: vec2<f32>,
    padding: f32,
}

// 32 bytes per particle.
// offset.xyz = cumulative world-space displacement; offset.w = reserved
// velocity.xyz = velocity; velocity.w = last-seen setTime (for self-healing reset)
struct Particle {
    offset: vec4<f32>,
    velocity: vec4<f32>,
}

struct ParticleForceUniforms {
    timeParams: vec4<f32>,   // x=time, y=dt, z=rampTime, w=forceStrength
    noiseParams: vec4<f32>,  // x=noiseScale, y=damping, z=noiseTimeScale, w=unused
}

@group(0) @binding(0) var<storage, read> sliceBuffer: array<CubeTunnelSlice>;
@group(0) @binding(1) var<storage, read_write> vertexBuffer: array<GeomVertex>;
@group(0) @binding(2) var<storage, read_write> particleBuffer: array<Particle>;
@group(0) @binding(3) var<uniform> uniforms: ParticleForceUniforms;

// 64 cubes per slice × 4 faces × 2 tris = 512 triangles per slice.
// Triangles are laid out consecutively in the vertex buffer as verts (3*T, 3*T+1, 3*T+2).
const TRIS_PER_SLICE: u32 = 512u;

fn hash13(p: vec3<f32>) -> f32 {
    var q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
    q = q + dot(q, q.yxz + 33.33);
    return fract((q.x + q.y) * q.z);
}

fn valueNoise3D(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);

    let c000 = hash13(i);
    let c100 = hash13(i + vec3<f32>(1.0, 0.0, 0.0));
    let c010 = hash13(i + vec3<f32>(0.0, 1.0, 0.0));
    let c110 = hash13(i + vec3<f32>(1.0, 1.0, 0.0));
    let c001 = hash13(i + vec3<f32>(0.0, 0.0, 1.0));
    let c101 = hash13(i + vec3<f32>(1.0, 0.0, 1.0));
    let c011 = hash13(i + vec3<f32>(0.0, 1.0, 1.0));
    let c111 = hash13(i + vec3<f32>(1.0, 1.0, 1.0));

    let x00 = mix(c000, c100, u.x);
    let x10 = mix(c010, c110, u.x);
    let x01 = mix(c001, c101, u.x);
    let x11 = mix(c011, c111, u.x);
    let y0 = mix(x00, x10, u.y);
    let y1 = mix(x01, x11, u.y);
    return mix(y0, y1, u.z) * 2.0 - 1.0;
}

// Three decorrelated noise samples form a vector field.
fn noiseVec3(p: vec3<f32>, t: f32) -> vec3<f32> {
    return vec3<f32>(
        valueNoise3D(p + vec3<f32>(0.0, 0.0, t)),
        valueNoise3D(p + vec3<f32>(71.3, 19.1, t)),
        valueNoise3D(p + vec3<f32>(137.7, 53.4, t))
    );
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let triIdx = globalId.x;
    let sliceCount = arrayLength(&sliceBuffer);

    let sliceId = triIdx / TRIS_PER_SLICE;
    if (sliceId >= sliceCount) {
        return;
    }

    let slice = sliceBuffer[sliceId];
    let setTime = slice.params.z;

    let time          = uniforms.timeParams.x;
    let dt            = uniforms.timeParams.y;
    let rampTime      = uniforms.timeParams.z;
    let forceStrength = uniforms.timeParams.w;
    let noiseScale    = uniforms.noiseParams.x;
    let damping       = uniforms.noiseParams.y;
    let noiseTimeScale = uniforms.noiseParams.z;

    var particle = particleBuffer[triIdx];

    // Self-healing reset: if this slice has been re-set since we last touched it,
    // zero our accumulated offset/velocity and adopt the new setTime.
    if (particle.velocity.w != setTime) {
        particle.offset = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        particle.velocity = vec4<f32>(0.0, 0.0, 0.0, setTime);
    }

    // Slices that have never been setNow'd (setTime == 0) stay at rest.
    // Also prevents the whole buffer from drifting at startup.
    if (setTime <= 0.0) {
        particleBuffer[triIdx] = particle;
        return;
    }

    let timeSinceSet = time - setTime;
    let intensity = smoothstep(0.0, max(rampTime, 0.0001), timeSinceSet);

    let v0Idx = triIdx * 3u;
    let v1Idx = v0Idx + 1u;
    let v2Idx = v0Idx + 2u;

    let basePos0 = vertexBuffer[v0Idx].position;
    let basePos1 = vertexBuffer[v1Idx].position;
    let basePos2 = vertexBuffer[v2Idx].position;
    let centroidBase = (basePos0 + basePos1 + basePos2) / 3.0;
    let samplePos = centroidBase + particle.offset.xyz;

    let force = noiseVec3(samplePos * noiseScale, time * noiseTimeScale) * forceStrength;

    var newVelocity = particle.velocity.xyz + force * intensity * dt;
    // Exponential damping — frame-rate independent.
    newVelocity = newVelocity * exp(-damping * dt);
    let newOffset = particle.offset.xyz + newVelocity * dt;

    particle.offset = vec4<f32>(newOffset, 0.0);
    particle.velocity = vec4<f32>(newVelocity, setTime);
    particleBuffer[triIdx] = particle;

    // Translate all three verts by the same offset so normals stay valid.
    var v0 = vertexBuffer[v0Idx];
    v0.position = basePos0 + newOffset;
    vertexBuffer[v0Idx] = v0;

    var v1 = vertexBuffer[v1Idx];
    v1.position = basePos1 + newOffset;
    vertexBuffer[v1Idx] = v1;

    var v2 = vertexBuffer[v2Idx];
    v2.position = basePos2 + newOffset;
    vertexBuffer[v2Idx] = v2;
}
