# Web App Code Structure

This document describes the architecture and code flow of the Next.js + Three.js web application template.

## Overview

This is a project template that sets up a fullscreen Three.js rendering context within a Next.js application. The core design ensures that Three.js resources are properly initialized and accessible throughout the React component hierarchy via a singleton pattern.

## Technology Stack

- **Next.js 14** - React framework with App Router
- **Three.js 0.166** - 3D graphics library
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **TypeScript 5.2** - Type safety
- **troika-three-text** - Text rendering in Three.js
- **socket.io-client** - Real-time communication (available but not actively used)

## Root Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts. Dev server runs on port 3030. |
| `tsconfig.json` | TypeScript config with `baseUrl: ./src/app` allowing clean imports like `"_lib/hooks/useAnimationFrame"` |
| `tailwind.config.js` | Tailwind setup with custom font families (Abyssinica, Aleo, JetBrains Mono) |
| `postcss.config.js` | PostCSS with Tailwind and Autoprefixer |
| `.eslintrc.json` | Extends `next/core-web-vitals` |

## Directory Structure

```
src/
├── app/
│   ├── _components/
│   │   ├── _realtime/       # Three.js integration components
│   │   │   ├── Renderer.tsx # Main rendering component
│   │   │   └── Overlay.tsx  # Fixed-position overlay utility
│   │   ├── controls/        # Reusable UI controls (Button, Slider, etc.)
│   │   └── layout/          # Layout components (Header)
│   │
│   ├── _lib/
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useAnimationFrame.tsx
│   │   │   ├── useDimensions.tsx
│   │   │   ├── useElementDimensions.tsx
│   │   │   ├── useInterval.ts
│   │   │   ├── useKeyboard.tsx
│   │   │   └── useSocket.tsx
│   │   └── types/           # TypeScript declarations for external libs
│   │
│   ├── _realtime/
│   │   └── engine/          # Three.js engine implementation
│   │       ├── systems/     # Global systems (GlobalApp singleton)
│   │       ├── entities/    # Entity base class and examples
│   │       ├── components/  # Entity component interfaces (Hoverable, Clickable)
│   │       ├── interaction/ # Input handling (mouse, keyboard)
│   │       ├── utils/       # Geometry helpers
│   │       └── cameraControls.ts
│   │
│   ├── api/example/         # Example API route
│   ├── page.tsx             # Main page
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Tailwind imports
│
└── public/img/              # Static assets
```

## Core Application Flow

### 1. Entry Point: `layout.tsx`

Sets up the HTML structure with:
- Google Fonts (Abyssinica SIL, Aleo, JetBrains Mono) as CSS variables
- Base styling with neutral background and white text
- Font variables applied to body for Tailwind's font utilities

### 2. Main Page: `page.tsx`

A client component that:
1. Reads URL search parameters (placeholder for async setup)
2. Shows a loading state until ready
3. Renders `<Header />` and `<Renderer />`

### 3. Three.js Initialization: `Renderer.tsx`

The heart of the Three.js integration. On mount, it:

1. **Creates the canvas** - A fullscreen `<canvas>` element with mouse event handlers
2. **Initializes Three.js** - Scene, cameras (orthographic + perspective), WebGLRenderer
3. **Creates GlobalApp singleton** - Stores all Three.js objects for global access
4. **Sets up interaction** - Creates `RealtimeInteractor` for mouse/keyboard input
5. **Starts render loop** - Uses `useAnimationFrame` to update entities and render each frame

Key hooks used:
- `useDimensions()` - Tracks window size for responsive canvas
- `useCameraControls()` - Pan/zoom with smooth lerping
- `useKeyboard()` - Global keyboard event handling
- `useAnimationFrame()` - 60fps render loop

### 4. GlobalApp Singleton: `systems/GlobalApp.ts`

A singleton class providing global access to Three.js objects:

```typescript
GlobalApp.instance.renderer  // THREE.WebGLRenderer
GlobalApp.instance.orthoCam  // THREE.OrthographicCamera
GlobalApp.instance.perspCam  // THREE.PerspectiveCamera
GlobalApp.instance.scene     // THREE.Scene
GlobalApp.instance.entities  // Record<string, RealtimeEntity>
```

This pattern allows any code in the application to access the Three.js context without prop drilling.

### 5. Entity System: `entities/realtimeEntity.ts`

Base class for all 3D objects in the scene:

```typescript
class RealtimeEntity {
    objectId: string;           // Unique UUID
    object3D: THREE.Object3D;   // The Three.js object

    init(data?: any) {}         // Called to register with GlobalApp
    update(deltaTime: number) {} // Called every frame
    destroy() {}                // Cleanup
}
```

Entities register themselves in `GlobalApp.instance.entities` and are automatically updated each frame by the render loop.

### 6. Component Interfaces: `components/`

TypeScript interfaces for entity capabilities:

**Hoverable** (`hoverable.ts`):
```typescript
interface Hoverable {
    isHoverable: true;
    isHovered: boolean;
    hover(): void;
    unhover(): void;
}
```

**Clickable** (`clickable.ts`):
```typescript
interface Clickable {
    isClickable: true;
    leftClickDown(): void;
    middleClickDown(): void;
    rightClickDown(): void;
    leftClickUp(): void;
    middleClickUp(): void;
    rightClickUp(): void;
}
```

Entities implement these interfaces to receive interaction events. Type guards (`objectIsHoverable`, `objectIsClickable`) enable safe runtime checks.

### 7. Interaction System: `interaction/`

**RealtimeInteractor** (`interactor.ts`):
- Manages a `THREE.Raycaster` for mouse picking
- Maintains a `hoverStack` of entities under the cursor
- Delegates events to handler functions

**mouseHandling.ts**:
- `handleMouseMove` - Updates raycast, manages hover state
- `handleMouseDown/Up` - Dispatches click events to Clickable entities
- `handleWheelEvent` - Zoom (ctrl+scroll or mouse wheel) or pan (trackpad scroll)

**keyHandling.ts**:
- Debug controls: Arrow keys rotate camera, 0 resets
- Tracks shift key state
- Logs keypresses for debugging

### 8. Camera Controls: `cameraControls.ts`

A hook that provides smooth camera manipulation:

```typescript
const cameraControls = useCameraControls({
    panSensitivity: 0.0015,
    zoomSensitivity: 3,
    zoomBounds: { min: 0.1, max: 25 },
    isOrtho: true,
});

cameraControls.offsetPosition(dx, dy, dz);
cameraControls.offsetZoom(delta, targetX, targetY);
```

Features:
- Optional lerping for smooth movement
- Zoom-toward-cursor behavior
- Syncs orthographic and perspective cameras

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAnimationFrame` | Runs callback on every `requestAnimationFrame`, provides `time` and `delta` |
| `useDimensions` | Returns `{ width, height }` of window, updates on resize |
| `useElementDimensions` | Returns position and size of a ref'd element using ResizeObserver |
| `useKeyboard` | Attaches keydown/keyup listeners, calls callback for each event |
| `useInterval` | Runs callback at specified interval, properly handles cleanup |
| `useSocket` | Creates and manages a socket.io connection |

## UI Components

Located in `_components/controls/`:

- **Button** - Basic styled button
- **Checkbox / CheckboxField** - Checkbox input with label
- **Toggle / ToggleField** - Toggle switch
- **Slider / SliderField** - Draggable slider with optional interval callbacks
- **TextField / TextAreaField / TextIntField** - Text inputs
- **SelectField** - Dropdown select
- **Foldout** - Collapsible section

## How to Add a New Entity

1. Create a class extending `RealtimeEntity`:

```typescript
import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";
import GlobalApp from "_realtime/engine/systems/GlobalApp";
import * as THREE from "three";

class MyEntity extends RealtimeEntity {
    init() {
        super.init();

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        mesh.userData.entity = this;  // Required for raycasting!
        this.object3D.add(mesh);

        GlobalApp.instance.scene.add(this.object3D);
    }

    update(deltaTime: number) {
        this.object3D.rotation.y += deltaTime;
    }
}
```

2. Instantiate and initialize it (e.g., in a `useEffect` in Renderer.tsx):

```typescript
useEffect(() => {
    if (!hasGlobalAppInstance) return;

    const entity = new MyEntity();
    entity.init();
}, [hasGlobalAppInstance]);
```

## How to Make an Entity Interactive

Implement the `Hoverable` and/or `Clickable` interfaces:

```typescript
class InteractiveEntity extends RealtimeEntity implements Hoverable, Clickable {
    isHoverable: true = true;
    isHovered = false;
    isClickable: true = true;

    hover() { /* highlight effect */ }
    unhover() { /* remove highlight */ }

    leftClickDown() { /* handle click */ }
    leftClickUp() {}
    middleClickDown() {}
    middleClickUp() {}
    rightClickDown() {}
    rightClickUp() {}
}
```

**Important**: The mesh's `userData.entity` must reference the entity for raycasting to work.

## Render Loop Summary

Each frame:
1. `useAnimationFrame` triggers with `{ time, delta }`
2. All entities in `GlobalApp.instance.entities` have `.update(delta)` called
3. Camera controls apply any pending position/zoom changes
4. Scene is rendered with the active camera (ortho or perspective)

## Notes

- The template defaults to orthographic projection but supports switching to perspective
- Debug camera rotation is available via arrow keys (switches to perspective mode)
- Press `0` to reset camera rotation and return to orthographic mode
- There's a commented-out three-inspect integration for debugging 3D scenes
- The API example route at `/api/example` echoes back POST body as JSON
