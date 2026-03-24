# Web GEOM Implementation Notes

This document describes the WebGPU port of the Unity GEOM system, which renders procedural geometric tunnel/trail visualizations using GPU compute shaders.

## Overview

The GEOM system creates animated geometric patterns by:

1. Maintaining a **circular buffer of "slices"** on the GPU - each slice describes a ring of cubes
2. Every N frames (configurable via `sliceInterval`), the **current slice is set** with the object's transform and parameters
3. All other slices are **animated** (transformed, color-shifted, etc.) via compute shaders
4. Slices are **expanded into triangle geometry** by the vertex generation compute shader
5. The geometry is **rendered** using vertex pulling from a storage buffer

This creates a "temporal geometry" effect where the object leaves a trail of its past states.

## File Structure

```
src/app/_realtime/geom/
├── GeomContainerEntity.ts  # High-level controller with noise-based animation
├── GeomEntity.ts           # Core WebGPU orchestrator class
└── shaders/
    ├── sliceSetNow.wgsl              # Sets current slice parameters
    ├── sliceTransformPerSecond.wgsl  # Applies transform animation to slices
    ├── sliceOffsetPerSecond.wgsl     # Animates slice parameters (color, size, etc.)
    ├── vertexGeneration.wgsl         # Generates triangle geometry from slices
    └── geomRender.wgsl               # Vertex pulling + fragment shader
```

## Key Components

### GeomContainerEntity.ts

A high-level wrapper that controls `GeomEntity` with Perlin noise-based animation. This is the class instantiated in `Renderer.tsx`.

**Key responsibilities:**
- Creates and manages a `GeomEntity` instance
- Animates parameters over time using Perlin noise:
  - `radius`: varies between ~0.5 and 6.5
  - `cubeFill`: varies between ~0.3 and 0.9
  - Position: moves across screen based on noise
  - Rotation: continuous rotation over time
- Passes updated config to `GeomEntity` each frame

**Usage:**
```typescript
const geomContainer = new GeomContainerEntity({
    sliceCount: 1000,
    cubeCount: 12,
    // ... other config
});
await geomContainer.init();
// update() is called automatically by the render loop
```

### GeomEntity.ts

The core WebGPU class that extends `RealtimeEntity` and orchestrates the rendering pipeline.

**Key responsibilities:**
- WebGPU device and context initialization
- Buffer creation (slice buffer, vertex buffer, uniform buffers)
- Compute pipeline creation and dispatch
- Render pipeline with overlay canvas
- Debug readback system for diagnostics

**Important methods:**
- `init()` - Async initialization of all WebGPU resources
- `update(time, deltaTime)` - Called every frame, dispatches compute shaders and renders
- `createCanvas()` - Creates overlay canvas for WebGPU rendering (separate from Three.js)
- `dispatchCompute()` - Runs all compute shader passes in sequence
- `render()` - Renders the geometry using vertex pulling

**Key state variables:**
- `sliceInterval: 2` - Slices advance every N frames (default: 2)
- `holdRadiusAtZero: true` - First slice has radius 0 (prevents pop-in)
- `currentSlice` wraps at `sliceCount * 0.75` - Uses 75% of buffer capacity

**Configuration (`GeomConfig`):**
```typescript
interface GeomConfig {
    sliceCount: number;      // Number of slices in circular buffer (e.g., 1000)
    cubeCount: number;       // Cubes per ring (e.g., 12)
    radius: number;          // Ring radius
    spread: number;          // How spread out cubes are around ring
    cubeFill: number;        // Cube width relative to spacing
    cubeHeight: number;      // Cube height/depth
    cubeSpin: Vector3;       // Rotation applied to cubes (degrees)
    radiusCrunch: number;    // Multiplier to collapse radius
    hue/saturation/brightness: number;  // HSV color
    // Animation parameters (*PerSecond)
    translationPerSecond: Vector3;
    rotationPerSecond: Vector3;
    // ... etc
    metallic: number;        // Material metallic value (0-1)
    smoothness: number;      // Material smoothness (0-1)
    opacity: number;         // Material opacity (0-1)
}
```

### Compute Shader Pipeline

Each frame runs 4 compute passes in sequence:

| Pass | Shader | Workgroups | Purpose |
|------|--------|------------|---------|
| 1 | `sliceSetNow` | 1 | Set current slice to current transform/parameters |
| 2 | `sliceTransformPerSecond` | ceil(sliceCount/256) | Apply transform delta to all other slices |
| 3 | `sliceOffsetPerSecond` | ceil(sliceCount/256) | Animate slice parameters (color, size, spin) |
| 4 | `vertexGeneration` | sliceCount | Generate triangle geometry from slices |

**Slice advancement:** Controlled by `sliceInterval` (default: 2). The current slice only advances every N frames, meaning slices are written at half frame rate by default. The `currentSlice` counter wraps at 75% of `sliceCount` to avoid visual artifacts from buffer wraparound.

### GPU Buffer Layout

**Slice Buffer** (`CubeTunnelSlice`, 128 bytes per slice):
```
offset 0-63:   transform mat4x4       (64 bytes)
offset 64-79:  ringRadiusAndColor     vec4 (xyz=HSV color, w=radius)
offset 80-95:  cubeSize               vec4 (xyz=size, w=spread)
offset 96-111: cubeSpin               vec4 (xyz=spin radians, w=radiusCrunch)
offset 112-127: params                vec4 (x=cubeCount, y=exists, z=setTime, w=unused)
```

**Vertex Buffer** (`GeomVertex`, 48 bytes per vertex):
```
offset 0-11:  position  vec3
offset 12-23: normal    vec3
offset 24-35: color     vec3 (RGB)
offset 36-43: uv        vec2
offset 44-47: padding   f32
```

**Vertex count calculation:**
- Up to 64 cubes per slice
- 4 faces per cube (no caps - they connect to adjacent slices)
- 6 vertices per face (2 triangles)
- Total: `sliceCount * 64 * 24` vertices

## Notable Techniques

### WGSL Struct Alignment

WGSL has strict alignment rules for uniform/storage buffers:
- `vec3<f32>` has **16-byte alignment** (not 12!)
- This causes implicit padding that breaks naive struct layouts

**Solution:** Use `vec4` everywhere and pack multiple values:
```wgsl
// BAD - alignment issues
struct Bad {
    radius: f32,        // offset 0
    color: vec3<f32>,   // offset 16 (NOT 4!) due to vec3 alignment
}

// GOOD - explicit packing
struct Good {
    radiusAndColor: vec4<f32>,  // xyz=color, w=radius
}
```

### Overlay Canvas Approach

WebGPU renders to a separate canvas overlaid on the Three.js WebGL canvas:
- Position: fixed, full-screen, pointer-events: none
- Z-index above Three.js canvas
- Alpha blending with premultiplied alpha mode

This avoids conflicts between WebGL and WebGPU contexts.

### Vertex Pulling

Instead of traditional vertex buffers, we use **vertex pulling** from a storage buffer:
```wgsl
@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let vertex = vertexBuffer[vertexIndex];  // Read from storage buffer
    // ... transform and output
}
```

This allows compute shaders to write directly to the same buffer that rendering reads from.

### Debug Readback System

For debugging without visual confirmation, the system includes buffer readback:
```typescript
private async debugReadbackSliceBuffer(): Promise<void> {
    // Copy GPU buffer to staging buffer
    commandEncoder.copyBufferToBuffer(this.sliceBuffer, 0, this.debugStagingBuffer, 0, readSize);
    // Map and read
    await this.debugStagingBuffer.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(this.debugStagingBuffer.getMappedRange());
    // Log to console
}
```

Requires `GPUBufferUsage.COPY_SRC` on source buffers.

## Integration with Three.js

Both `GeomContainerEntity` and `GeomEntity` extend `RealtimeEntity` but don't add anything to the Three.js scene. Instead:

1. `GeomEntity` creates its own WebGPU canvas overlay
2. It reads camera matrices from `GlobalApp.instance.perspCam`
3. The `update(time, deltaTime)` method is called by the main render loop like any other entity
4. `GeomContainerEntity.update()` applies noise-based animation but doesn't call `GeomEntity.update()` - that's handled directly by the render loop iterating over `GlobalApp.instance.entities`

**Camera matrix usage:**
```typescript
const camera = GlobalApp.instance?.perspCam;
camera.updateMatrixWorld();
const viewMatrix = camera.matrixWorldInverse;
const projMatrix = camera.projectionMatrix;
const viewProjMatrix = new THREE.Matrix4().multiplyMatrices(projMatrix, viewMatrix);
```

## Configuration in Renderer.tsx

The `GeomContainerEntity` is instantiated in `Renderer.tsx`:
```typescript
const geomEntity = new GeomContainerEntity({
    sliceCount: 1000,
    cubeCount: 12,
    radius: 2.0,
    spread: 1.0,
    cubeFill: 0.3,
    cubeHeight: 1.0,
    radiusCrunch: 1.0,
    hue: 0.0,
    saturation: 0.4,
    brightness: 1.0,
    cubeRotateAmount: new THREE.Vector3(0, 0, 1),
    endCrunchSlices: 3,
    huePerSecond: 0.1,
    rotationPerSecond: new THREE.Vector3(5, 10, 10),
    translationPerSecond: new THREE.Vector3(0, 0, -5),
    metallic: 0.2,
    smoothness: 0.6,
    opacity: 1.0,
    initialWidth: screenDimensions.width,
    initialHeight: screenDimensions.height,
});
await geomEntity.init();
```

The camera is set to perspective mode with `cameraZ: 10` in the camera controls config.

Note: `GeomContainerEntity` will override `radius` and `cubeFill` with noise-based values at runtime.

## Known Limitations / Future Work

1. **No interactivity** - GeomEntity doesn't implement Hoverable/Clickable interfaces
2. **Fixed cube count** - Currently assumes max 64 cubes per slice (hardcoded in vertex buffer size)
3. **No VR features** - The Unity version has camera proximity shrink and dissolve effects for VR comfort
4. **Single material** - No texture support, just HSV colors with basic Blinn-Phong lighting
5. **Buffer wraparound** - Uses 75% of slice buffer to avoid visual artifacts at wrap point
6. **Culling disabled** - `cullMode: "none"` is set to debug gap issues (may want to re-enable for performance)

## Troubleshooting

**All slices show zeros:**
- Check uniform buffer alignment matches WGSL struct layout
- Verify compute shader dispatch is happening
- Check bind group creation succeeded

**Vertices all zero but slices valid:**
- Vertex generation shader issue
- Check `exists` flag is being set to 1.0

**Nothing renders but data looks correct:**
- Check camera matrices are valid
- Verify depth texture is being created
- Check render pipeline blend/depth settings

**"Buffer mapping already pending" error:**
- Debug readback calls overlapping - use the `debugReadbackPending` flag
