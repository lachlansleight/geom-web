// GEOM rendering shader - vertex pulling from storage buffer

struct GeomVertex {
    position: vec3<f32>,
    normal: vec3<f32>,
    color: vec3<f32>,
    uv: vec2<f32>,
    padding: f32,
}

struct RenderUniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    time: f32,
    metallic: f32,
    smoothness: f32,
    opacity: f32,
    padding: f32,
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

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Simple lighting calculation
    let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
    let viewDir = normalize(uniforms.cameraPosition - input.worldPos);
    let halfDir = normalize(lightDir + viewDir);

    // Lambertian diffuse
    let NdotL = max(dot(input.normal, lightDir), 0.0);

    // Blinn-Phong specular
    let NdotH = max(dot(input.normal, halfDir), 0.0);
    let shininess = mix(4.0, 128.0, uniforms.smoothness);
    let specular = pow(NdotH, shininess) * uniforms.smoothness;

    // Ambient
    let ambient = 0.15;

    // Combine lighting
    let diffuse = NdotL * 0.7;
    let lighting = ambient + diffuse + specular * 0.5;

    // Apply metallic - metallic surfaces tint specular with base color
    var finalColor = input.color * lighting;
    if (uniforms.metallic > 0.0) {
        let metallicSpecular = specular * input.color * uniforms.metallic;
        finalColor = finalColor + metallicSpecular;
    }

    return vec4<f32>(finalColor, uniforms.opacity);
}
