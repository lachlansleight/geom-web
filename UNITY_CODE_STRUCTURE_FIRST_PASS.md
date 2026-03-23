# Unity GEOM System - First Pass Analysis

This document provides an overview of the Unity compute shader rendering system for geometric tunnel/pattern visualization. The system renders recursive geometric patterns (rings of cubes forming tunnels/trails) with potentially millions of triangles using GPU compute shaders.

## High-Level Concept

The system creates animated geometric tunnels/trails by:
1. Maintaining a **circular buffer of "slices"** - each slice describes a ring of cubes at a point in time/space
2. Each frame, **one slice is "emitted"** with current parameters (position, rotation, color, etc.)
3. All other slices are **animated over time** (transformed, color-shifted, shrunk, etc.)
4. The slices are then **expanded into actual triangle geometry** on the GPU
5. The geometry is **rendered procedurally** without any mesh objects

This creates a "temporal geometry" effect where the object leaves a trail of its past states, forming tunnels, spirals, and other recursive patterns.

## Project Structure

```
unity-project-assets/Assets/
├── _GEOM/           # Original/stable version
│   ├── Scripts/
│   │   ├── GeomObject.cs        # Main orchestrator
│   │   ├── GeomObjectStepper.cs # Manual slice control
│   │   ├── GeomMover.cs         # Movement + auto-slicing
│   │   └── EntrySequence.cs     # Intro animation
│   ├── Resources/
│   │   ├── Shaders/
│   │   │   ├── Compute/
│   │   │   │   ├── Includes/GeomIncludes.hlsl      # Shared structs & functions
│   │   │   │   ├── SliceTransformations/           # Slice manipulation shaders
│   │   │   │   └── VertexTransformations/          # Geometry generation shaders
│   │   │   └── Rendering/
│   │   │       ├── GeomNew.shader         # Opaque PBR rendering
│   │   │       └── GeomTransparent.shader # Transparent rendering
│   │   └── Materials/
│   └── Prefabs/
│
├── _GEOM2025/       # Latest iteration (2025)
│   ├── GeomObject2.cs           # Updated main component
│   ├── IGeomControllable.cs     # Interface for parameter control
│   ├── GeomWrapper.cs           # Abstraction layer
│   ├── GeomVariableController.cs
│   ├── ThrongController.cs      # Multi-object management
│   └── [Various prefabs]
│
├── _GEOM2022/       # 2022 iteration (older)
│
├── Lunity/          # Utility library (extension methods, UI helpers, etc.)
└── SteamVR/         # VR support (separate concern)
```

## Core Data Structures

### CubeTunnelSlice (GPU struct)

Each slice in the circular buffer contains:

```hlsl
struct CubeTunnelSlice {
    float4x4 Transform;    // World transform matrix for this slice
    float RingRadius;      // Distance of cubes from center
    float3 RingColor;      // HSV color (Hue, Saturation, Value)
    float3 CubeSize;       // (Fill, Height, unused) - cube dimensions
    float3 CubeSpin;       // Euler rotation applied to cubes
    float RingSpread;      // How spread out cubes are around the ring
    float RadiusCrunch;    // Multiplier for radius (0-1 for collapse effect)
    float CubeCount;       // Number of cubes in this ring (1-64)
    float Exists;          // Whether this slice has been emitted yet
    float SetTime;         // When this slice was emitted
    float Padding;
};
```

### GeomVertex (GPU struct)

The final vertex data written to the vertex buffer:

```hlsl
struct GeomVertex {
    float3 Position;    // World position
    float3 Normal;      // Surface normal
    float3 Color;       // RGB color (converted from HSV)
    float2 Uv0;         // UV coordinates
    float Padding;
};
```

## Buffer Architecture

The system uses two main GPU buffers:

| Buffer | Size | Purpose |
|--------|------|---------|
| `_SliceBuffer` | `SliceCount * sizeof(CubeTunnelSlice)` | Circular buffer of slice parameters |
| `_VertexBuffer` | `SliceCount * 64 * 24 * sizeof(GeomVertex)` | Final triangle vertices |

**Vertex count calculation:**
- Up to **64 cubes per slice**
- Each cube has **4 faces** (no caps - they connect to adjacent slices)
- Each face has **6 vertices** (2 triangles)
- Total: `64 * 4 * 6 = 1,536 vertices per slice`
- With 200 slices: **307,200 vertices** (over 100k triangles)

## Compute Shader Pipeline

Each frame, the system runs multiple compute shader passes:

### Phase 1: Slice Transformations

These shaders modify the `_SliceBuffer`:

| Shader | Purpose | Thread Groups |
|--------|---------|---------------|
| `TransformSetNow.compute` | Sets current slice to current transform/parameters | 1 thread |
| `TransformPerSecond.compute` | Applies per-frame transform delta to all other slices | 256 threads × (SliceCount/256) |
| `OffsetPerSecond.compute` | Animates slice parameters (radius, color, size, spin) | 256 threads × (SliceCount/256) |
| `CubeShrinkWithDarkness.compute` | Shrinks cubes based on brightness (fade effect) | 256 threads × (SliceCount/256) |

### Phase 2: Vertex Generation

| Shader | Purpose | Thread Groups |
|--------|---------|---------------|
| `GeomVertex.compute` | Generates triangle geometry from slices | 64 threads × SliceCount |

The vertex shader is the most complex - it:
1. Reads current slice and previous slice
2. For each cube in the ring, generates 4 quad faces
3. Applies cube rotation, scaling, ring placement
4. Transforms vertices by slice matrices
5. Computes normals via cross product
6. Converts HSV to RGB
7. Handles edge cases (end crunching, visibility, fractional cube counts)

## Rendering

The system uses **procedural rendering** - no mesh objects:

```csharp
Graphics.DrawProcedural(
    _renderMaterial,
    new Bounds(Vector3.zero, Vector3.one * 10000f),
    MeshTopology.Triangles,
    _vertexBuffer.count  // Total vertex count
);
```

The vertex shader in `GeomNew.shader` reads directly from `_VertexBuffer`:

```hlsl
void vert(inout appdata v, out Input o) {
    GeomVertex CurrentVertex = _VertexBuffer[v.vid];
    v.vertex.xyz = CurrentVertex.Position;
    v.color = float4(CurrentVertex.Color, 1.0);
    v.normal = CurrentVertex.Normal;
}
```

**Key rendering features:**
- **Opaque mode**: Standard PBR with metallic/smoothness
- **Transparent mode**: Alpha blending with edge lines
- **Distance dissolve**: Noise-based dissolve near camera (VR comfort)
- **Camera proximity shrink**: Cubes shrink when too close to camera

## The "Slice" Paradigm

The core innovation is treating geometry as temporal:

```
Time →
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│  0  │  1  │  2  │  3  │  4  │  5  │  6  │  7  │  ← Slice indices
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                              ↑
                        Current slice
                        (most recent)
```

Each frame:
1. `_currentSlice` is set with current parameters (position, rotation, color, etc.)
2. `_currentSlice` is incremented (wraps at `SliceCount`)
3. All other slices are transformed by `TransformPerSecond` matrix
4. All slices are animated (color shift, shrink, spin changes)
5. The oldest slice (at `_currentSlice + 1`) is "overwritten" next frame

This creates continuous tunnel/trail effects as the object moves through space.

## Key Parameters

### Per-Slice Parameters (set at emission)

| Parameter | Description |
|-----------|-------------|
| `Radius` | Distance of cube ring from center |
| `CubeCount` | Number of cubes in the ring (1-64) |
| `CubeFill` | Width of each cube relative to spacing |
| `CubeHeight` | Height/depth of each cube |
| `CubeSpin` | Rotation applied to individual cubes |
| `Spread` | How much cubes spread around the ring |
| `RadiusCrunch` | Multiplier to collapse radius (0 = center) |
| `Hue/Saturation/Brightness` | HSV color |

### Animation Parameters (applied per-second)

- `TranslationPerSecond`, `RotationPerSecond`, `ScalingPerSecond` - Transform animation
- `RadiusPerSecond`, `SpreadPerSecond`, etc. - Parameter animation
- `ShrinkByDarkness` - Cubes shrink based on brightness (creates fade-out effect)

### Rendering Parameters

- `Metallic`, `Smoothness` - PBR properties
- `Opacity`, `LineOpacity`, `LineThickness` - Transparency mode
- `DissolveDistanceMin/Max`, `NoiseScale/Strength` - Camera dissolve
- `EndCrunchSlices` - Number of slices to "crunch" at tunnel ends

## Utility Functions (GeomIncludes.hlsl)

```hlsl
// Euler rotation (X→Y→Z order)
float3 eulerRotate(float3 input, float3 eulers);
float3 eulerRotateReverse(float3 input, float3 eulers);

// Color conversion
float3 hsv2rgb(float3 c);

// Hash-based random
uint Hash(uint s);
float Random(uint seed);
```

## Version Differences

### _GEOM (Original)
- Basic implementation
- Simpler parameter set
- Working but less configurable

### _GEOM2025 (Latest)
- `GeomObject2.cs` - Updated main component
- Camera dissolve distance for VR comfort
- Palette support for color modes
- `IGeomControllable` interface for external control
- `GeomWrapper` abstraction layer
- `ThrongController` for managing multiple objects
- Various "provider" scripts for parameter automation

## WebGPU Porting Considerations

### Direct Port Requirements

1. **Compute Shaders → WebGPU Compute**
   - HLSL → WGSL translation
   - Same buffer binding patterns
   - Thread group sizes should work (256, 64)

2. **Structured Buffers**
   - `RWStructuredBuffer` → WebGPU storage buffers
   - Same struct layouts (watch for alignment)

3. **Procedural Drawing**
   - `DrawProcedural` → `draw()` with vertex pulling
   - Vertex shader reads from storage buffer via `vertex_index`

4. **Surface Shader → Fragment Shader**
   - Unity's surface shader abstraction must be manually converted
   - PBR lighting needs manual implementation or library

### Potential Simplifications

1. **Single Compute Pass**: Could merge slice transforms into one shader
2. **Indirect Drawing**: Could compute vertex counts dynamically
3. **Instancing**: Could instance cube geometry instead of generating all vertices

### Challenges

1. **Matrix Operations**: Unity's `Matrix4x4` multiplication order may differ
2. **Coordinate Systems**: Unity is left-handed, WebGPU/Three.js is right-handed
3. **HSV→RGB**: Standard conversion, easy to port
4. **Noise Functions**: SimplexNoise needs porting

## Files Critical for WebGPU Port

| Priority | File | Reason |
|----------|------|--------|
| 1 | `GeomIncludes.hlsl` | Core structs and functions |
| 2 | `GeomVertex.compute` | Main geometry generation logic |
| 3 | `TransformSetNow.compute` | Slice emission |
| 4 | `TransformPerSecond.compute` | Slice animation |
| 5 | `OffsetPerSecond.compute` | Parameter animation |
| 6 | `GeomNew.shader` | Rendering (vertex pulling, PBR) |
| 7 | `GeomObject2.cs` | Orchestration logic (buffer setup, dispatch) |
