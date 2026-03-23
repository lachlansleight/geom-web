# Geom on the Web

Readme to come. 

## Overview: The Slice-Based Tunnel

The system creates tunnels/trails by connecting rings of cubes across time/space:

```
                        Direction of travel / time
                              ───────────────►

    Slice N-2          Slice N-1          Slice N (current)
        │                  │                   │
        ▼                  ▼                   ▼
      ╭───╮              ╭───╮               ╭───╮
     ╱     ╲            ╱     ╲             ╱     ╲
    │   ○   │──────────│   ○   │───────────│   ○   │
     ╲     ╱            ╲     ╱             ╲     ╱
      ╰───╯              ╰───╯               ╰───╯
        │                  │                   │
        │    Cube faces    │    Cube faces     │
        │    connect       │    connect        │
        │    slices        │    slices         │
        ▼                  ▼                   ▼

    ════════════════════════════════════════════════
                    CIRCULAR BUFFER
    ════════════════════════════════════════════════

    Index:  [ 0 | 1 | 2 | ... | N-2 | N-1 | N ]
                                      ▲     ▲
                                      │     └── Current slice
                                      └── Previous slice
                                          (connects to current)
```

## The Ring of Cubes (Top-Down View)

Looking down the tunnel axis (Z), each slice contains a ring of cubes:

```
                         +Y
                          │
                          │
              ┌───┐       │       ┌───┐
             ╱cube╲      │      ╱cube╲
            │  2   │◄────┼────►│  1   │
             ╲     ╱      │      ╲     ╱
              └───┘       │       └───┘
                 ╲        │        ╱
                  ╲       │       ╱        Radius
                   ╲      │      ╱           │
        ┌───┐       ╲     │     ╱       ┌───┼
       ╱cube╲        ╲    │    ╱       ╱cube╲
 ─────│  3   │────────●───┴───────────│  0   │───── +X
       ╲     ╱        ╱    │    ╲       ╲     ╱
        └───┘       ╱     │     ╲       └───┘
                   ╱      │      ╲
                  ╱       │       ╲
                 ╱        │        ╲
              ┌───┐       │       ┌───┐
             ╱cube╲      │      ╱cube╲
            │  4   │◄────┼────►│  7   │
             ╲     ╱      │      ╲     ╱
              └───┘       │       └───┘
                          │
                          │
                         -Y

    CubeCount = 8 in this example
    Each cube positioned at angle: (cubeIndex / CubeCount) * 2π * Spread

## Complete Rendering Example

```
    EXAMPLE: 8 CUBES, 4 SLICES, ROTATING SPIRAL
    ════════════════════════════════════════════

    Parameters:
      SliceCount = 4
      CubeCount = 8
      RotationPerSecond.Z = 45°
      RadiusPerSecond = 0.1

    Result (3D view):

                            ╱╲
                           ╱  ╲
                          ╱    ╲
                    ┌────╱──────╲────┐
                   ╱│   ╱        ╲   │╲
                  ╱ │  ╱   ╱╲     ╲  │ ╲
                 ╱  │ ╱   ╱  ╲     ╲ │  ╲
                ╱   │╱   ╱    ╲     ╲│   ╲
               │    │   ╱ ┌────╲─────│    │
               │    │  ╱  │     ╲    │    │
               │    │ ╱   │      ╲   │    │
               │    │╱    │       ╲  │    │
               │    │     │  ●     ╲ │    │     ● = camera
               │    │╲    │       ╱  │    │
               │    │ ╲   │      ╱   │    │
               │    │  ╲  │     ╱    │    │
               │    │   ╲ └────╱─────│    │
                ╲   │╲   ╲    ╱     ╱│   ╱
                 ╲  │ ╲   ╲  ╱     ╱ │  ╱
                  ╲ │  ╲   ╲╱     ╱  │ ╱
                   ╲│   ╲        ╱   │╱
                    └────╲──────╱────┘
                          ╲    ╱
                           ╲  ╱
                            ╲╱

    Each "ring" is one slice, twisted relative to the previous.
    Inner rings are older slices (smaller due to RadiusPerSecond < 0
    or just from perspective).
```