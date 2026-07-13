// Screen-space bloom post-processing passes.
// Every pass draws a single fullscreen triangle (draw(3), no vertex buffer).
//
// brightPassMain: extracts HDR pixels above a luminance threshold (soft knee)
//   from the full-res scene into a half-res texture.
// blurMain: one Kawase blur step; ping-ponged between two half-res textures
//   with a growing per-pass offset to widen the glow cheaply.
// compositeMain: scene + blurred bloom -> canvas (premultiplied alpha).

struct BloomParams {
    params: vec4<f32>, // x=threshold, y=softKnee, z=intensity, w=blurOffset(texels)
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var srcTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> bloom: BloomParams;
@group(0) @binding(3) var bloomTex: texture_2d<f32>; // composite pass only

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn fullscreenVertex(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    let corner = vec2<f32>(f32((vertexIndex << 1u) & 2u), f32(vertexIndex & 2u));
    out.position = vec4<f32>(corner * 2.0 - 1.0, 0.0, 1.0);
    out.uv = vec2<f32>(corner.x, 1.0 - corner.y);
    return out;
}

@fragment
fn brightPassMain(in: VertexOutput) -> @location(0) vec4<f32> {
    let scene = textureSample(srcTex, texSampler, in.uv);
    let luma = dot(scene.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Soft-knee threshold (quadratic below threshold, linear above) so pixels
    // hovering near the threshold don't flicker in and out of the bloom.
    let threshold = bloom.params.x;
    let knee = max(bloom.params.y, 0.0001);
    let soft = clamp(luma - threshold + knee, 0.0, 2.0 * knee);
    let softContribution = soft * soft / (4.0 * knee);
    let contribution = max(softContribution, luma - threshold) / max(luma, 0.0001);

    return vec4<f32>(scene.rgb * contribution, 0.0);
}

@fragment
fn blurMain(in: VertexOutput) -> @location(0) vec4<f32> {
    let texel = 1.0 / vec2<f32>(textureDimensions(srcTex));
    let o = bloom.params.w * texel;
    var c = textureSample(srcTex, texSampler, in.uv + vec2<f32>(o.x, o.y));
    c += textureSample(srcTex, texSampler, in.uv + vec2<f32>(-o.x, o.y));
    c += textureSample(srcTex, texSampler, in.uv + vec2<f32>(o.x, -o.y));
    c += textureSample(srcTex, texSampler, in.uv + vec2<f32>(-o.x, -o.y));
    return c * 0.25;
}

@fragment
fn compositeMain(in: VertexOutput) -> @location(0) vec4<f32> {
    let scene = textureSample(srcTex, texSampler, in.uv);
    let glow = textureSample(bloomTex, texSampler, in.uv).rgb * bloom.params.z;

    // The canvas is composited premultiplied over the Three.js canvas below,
    // so lift alpha with the glow — otherwise bloom outside the geometry's
    // own alpha would be invisible.
    let glowAlpha = max(glow.r, max(glow.g, glow.b));
    let alpha = clamp(scene.a + glowAlpha, 0.0, 1.0);
    return vec4<f32>(scene.rgb + glow, alpha);
}
