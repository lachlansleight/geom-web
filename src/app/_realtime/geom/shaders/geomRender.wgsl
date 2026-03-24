// GEOM rendering shader - vertex pulling from storage buffer

struct GeomVertex {
    position: vec3<f32>,
    normal: vec3<f32>,
    color: vec3<f32>,
    uv: vec2<f32>,
    padding: f32,
}

// RenderUniforms - 128 bytes, properly aligned
struct RenderUniforms {
    viewProjection: mat4x4<f32>,   // offset 0, 64 bytes
    cameraAndTime: vec4<f32>,      // offset 64: xyz=cameraPosition, w=time
    materialParams: vec4<f32>,      // offset 80: x=metallic, y=smoothness, z=opacity, w=dissolveForwardBias
    dissolveParams: vec4<f32>,      // offset 96: x=dissolveMin, y=dissolveMax, z=noiseScale, w=noiseStrength
    cameraForward: vec4<f32>,      // offset 112: xyz=forward direction, w=unused
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) uv: vec2<f32>,
}

@group(0) @binding(0) var<storage, read> vertexBuffer: array<GeomVertex>;
@group(0) @binding(1) var<uniform> uniforms: RenderUniforms;

// ============================================================
// Simplex 3D noise (Ashima Arts / Stefan Gustavson)
// Ported to WGSL from GLSL
// ============================================================

fn mod289_3(x: vec3<f32>) -> vec3<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_4(x: vec4<f32>) -> vec4<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4<f32>) -> vec4<f32> {
    return mod289_4(((x * 34.0) + 10.0) * x);
}

fn taylorInvSqrt(r: vec4<f32>) -> vec4<f32> {
    return 1.79284291400159 - 0.85373472095314 * r;
}

fn snoise(v: vec3<f32>) -> f32 {
    let C = vec2<f32>(1.0 / 6.0, 1.0 / 3.0);
    let D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

    // First corner
    var i = floor(v + dot(v, vec3<f32>(C.y, C.y, C.y)));
    let x0 = v - i + dot(i, vec3<f32>(C.x, C.x, C.x));

    // Other corners
    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min(g.xyz, l.zxy);
    let i2 = max(g.xyz, l.zxy);

    let x1 = x0 - i1 + vec3<f32>(C.x, C.x, C.x);
    let x2 = x0 - i2 + vec3<f32>(C.y, C.y, C.y);
    let x3 = x0 - D.yyy;

    // Permutations
    i = mod289_3(i);
    let p = permute(permute(permute(
        i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a square, mapped onto an octahedron
    let n_ = 0.142857142857; // 1.0/7.0
    let ns = n_ * D.wyz - D.xzx;

    let j = p - 49.0 * floor(p * ns.z * ns.z);

    let x_ = floor(j * ns.z);
    let y_ = floor(j - 7.0 * x_);

    let x = x_ * ns.x + vec4<f32>(ns.y, ns.y, ns.y, ns.y);
    let y = y_ * ns.x + vec4<f32>(ns.y, ns.y, ns.y, ns.y);
    let h = 1.0 - abs(x) - abs(y);

    let b0 = vec4<f32>(x.xy, y.xy);
    let b1 = vec4<f32>(x.zw, y.zw);

    let s0 = floor(b0) * 2.0 + 1.0;
    let s1 = floor(b1) * 2.0 + 1.0;
    let sh = -step(h, vec4<f32>(0.0, 0.0, 0.0, 0.0));

    let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    let a1 = b1.xzyw + s1.xzyw * sh.zzww;

    var p0 = vec3<f32>(a0.xy, h.x);
    var p1 = vec3<f32>(a0.zw, h.y);
    var p2 = vec3<f32>(a1.xy, h.z);
    var p3 = vec3<f32>(a1.zw, h.w);

    // Normalise gradients
    let norm = taylorInvSqrt(vec4<f32>(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix contributions from the four corners
    var m = max(vec4<f32>(0.6, 0.6, 0.6, 0.6) - vec4<f32>(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4<f32>(0.0, 0.0, 0.0, 0.0));
    m = m * m;
    return 42.0 * dot(m * m, vec4<f32>(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ============================================================
// Vertex shader
// ============================================================

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let vertex = vertexBuffer[vertexIndex];

    var output: VertexOutput;
    output.worldPos = vertex.position;
    output.position = uniforms.viewProjection * vec4<f32>(vertex.position, 1.0);
    output.normal = vertex.normal;
    output.color = vertex.color;
    output.uv = vertex.uv;

    return output;
}

// ============================================================
// Fragment shader
// ============================================================

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let cameraPos = uniforms.cameraAndTime.xyz;

    // --- Distance-based dissolve with forward bias ---
    let dissolveMinBase = uniforms.dissolveParams.x;
    let dissolveMaxBase = uniforms.dissolveParams.y;
    let noiseScale = uniforms.dissolveParams.z;
    let noiseStrength = uniforms.dissolveParams.w;
    let forwardBias = uniforms.materialParams.w; // 0 = uniform, 1 = no dissolve at sides

    let dist = distance(cameraPos, input.worldPos);

    // How much is this fragment in front of the camera vs to the side?
    let toFragment = normalize(input.worldPos - cameraPos);
    let cameraFwd = normalize(uniforms.cameraForward.xyz);
    let forwardness = max(dot(toFragment, cameraFwd), 0.0);

    // Scale dissolve distances: at forwardness=1 (ahead) use full range,
    // at forwardness=0 (side) scale down toward zero based on forwardBias
    let sideScale = 1.0 - forwardBias * (1.0 - forwardness);
    let dissolveMin = dissolveMinBase * sideScale;
    let dissolveMax = dissolveMaxBase * sideScale;

    // 3-octave FBM simplex noise for organic dissolve pattern
    let noise1 = snoise(input.worldPos * noiseScale);
    let noise2 = snoise(input.worldPos * noiseScale * 2.0) * 0.5;
    let noise3 = snoise(input.worldPos * noiseScale * 4.0) * 0.25;
    let noiseSum = (noise1 + noise2 + noise3) / 1.75;

    let noisyDist = dist + noiseSum * (noiseStrength * (dissolveMaxBase - dissolveMinBase));

    // Remap to 0-1 based on dissolve range
    var distT: f32;
    if (noisyDist < dissolveMin) {
        distT = 0.0;
    } else if (noisyDist > dissolveMax) {
        distT = 1.0;
    } else {
        distT = (noisyDist - dissolveMin) / (dissolveMax - dissolveMin);
    }

    // Alpha clip: discard fragments in the dissolve zone (close to camera)
    if (distT < 0.5) {
        discard;
    }

    // --- Lighting ---
    let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
    let viewDir = normalize(cameraPos - input.worldPos);
    let halfDir = normalize(lightDir + viewDir);

    // Material params
    let metallic = uniforms.materialParams.x;
    let smoothness = uniforms.materialParams.y;
    let opacity = uniforms.materialParams.z;

    // Lambertian diffuse
    let NdotL = max(dot(input.normal, lightDir), 0.0);

    // Blinn-Phong specular
    let NdotH = max(dot(input.normal, halfDir), 0.0);
    let shininess = mix(4.0, 128.0, smoothness);
    let specular = pow(NdotH, shininess) * smoothness;

    // Ambient
    let ambient = 0.15;

    // Combine lighting
    let diffuse = NdotL * 0.7;
    let lighting = ambient + diffuse + specular * 0.5;

    // Apply metallic - metallic surfaces tint specular with base color
    var finalColor = input.color * lighting;
    if (metallic > 0.0) {
        let metallicSpecular = specular * input.color * metallic;
        finalColor = finalColor + metallicSpecular;
    }

    return vec4<f32>(finalColor, opacity);
}
