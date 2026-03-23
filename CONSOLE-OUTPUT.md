This is the console output asked for:

```
Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools react-dom.development.js:38341:1
INITIALIZING GLOBAL APP Renderer.tsx:55:17
Global App instance is initialised - creating GeomEntity Renderer.tsx:120:17
GeomEntity canvas created with dimensions: 1659x730 GeomEntity.ts:230:17
GeomEntity initialized with WebGPU GeomEntity.ts:179:17
=== GEOM ENTITY INIT DEBUG === GeomEntity.ts:182:21
Slice count: 150 GeomEntity.ts:183:21
Cube count: 24 GeomEntity.ts:184:21
Slice buffer size: 19200 bytes GeomEntity.ts:185:21
Vertex buffer size: 11059200 bytes GeomEntity.ts:186:21
Presentation format: bgra8unorm GeomEntity.ts:187:21
Pipelines created: 
Object { setNow: true, transformPerSecond: true, offsetPerSecond: true, vertexGen: true, render: true }
GeomEntity.ts:188:21
Bind groups created: 
Object { setNow: true, transformPerSecond: true, offsetPerSecond: true, vertexGen: true, render: true }
GeomEntity.ts:195:21
GeomEntity initialized successfully Renderer.tsx:163:25
=== RENDER STATE DEBUG === GeomEntity.ts:901:17
Camera position: 
Object { x: 0, y: 0, z: 2 }
GeomEntity.ts:902:17
Camera rotation: 
Object { isEuler: true, _x: 0, _y: 0, _z: 0, _order: "XYZ", _onChangeCallback: onRotationChange() }
GeomEntity.ts:903:17
Canvas size: 1659 x 730 GeomEntity.ts:904:17
Current slice: 59 GeomEntity.ts:905:17
Total vertices to draw: 230400 GeomEntity.ts:906:17
Config: 
Object { sliceCount: 150, cubeCount: 24, radius: 2, hue: 0 }
```

But then, on repeat:

1. All the slices debug, with the following being an expansion of one:

```
Slice 4: 
    Object
        cubeCount: 0
        cubeSize: Array(3) [ 0, 0, 0 ]
        cubeSpin: Array(3) [ 0, 0, 0 ]
        exists: 0
        radiusCrunch: 0
        ringColor: Array(3) [ 0, 0, 0 ]
        ringRadius: 0
        ringSpread: 0
        setTime: 0
        transform: Array(4) [ (4) […], (4) […], (4) […], … ]
            0: Array(4) [ 0, 0, 0, … ]
            1: Array(4) [ 0, 0, 0, … ]
            2: Array(4) [ 0, 0, 0, … ]
            3: Array(4) [ 0, 0, 0, … ]
            length: 4
```

2. The render state debug runs again

3. When suddenly an error:
```
DOMException: Buffer mapping is already pending
    debugReadbackVertexBuffer webpack-internal:///(app-pages-browser)/./src/app/_realtime/geom/GeomEntity.ts:758
    update webpack-internal:///(app-pages-browser)/./src/app/_realtime/geom/GeomEntity.ts:470
    Renderer webpack-internal:///(app-pages-browser)/./src/app/_components/_realtime/Renderer.tsx:171
    Renderer webpack-internal:///(app-pages-browser)/./src/app/_components/_realtime/Renderer.tsx:170
    animate webpack-internal:///(app-pages-browser)/./src/app/_lib/hooks/useAnimationFrame.tsx:20
```

4. And a warning:
```
Uncaptured WebGPU error: Usage flags BufferUsages(COPY_DST | STORAGE) of Buffer with '' label do not contain required usage flags BufferUsages(COPY_SRC)
```