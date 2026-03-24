# GEOM Parameter Animation System

This document explains how the Unity GEOM system animates its parameters over time to create organic, ever-changing geometric patterns. The goal is to port this system to the web app.

## The Big Picture

Every visual property of a GEOM object (radius, hue, position, cube fill, etc.) is controlled by a layered animation system:

```
Layer 3:  INTERPOLATOR      Lerps between two oscillator states over 10-30 seconds
              │               When it reaches one end, it randomises the other
              │               and reverses direction (ping-pong)
              │
Layer 2:  SHUFFLER           Randomises an oscillator's parameters
              │               (amplitude, center, frequency, phase)
              │               within bounds that "look good" for each parameter
              │
Layer 1:  OSCILLATOR         A synth-style LFO: sine wave with
                              frequency, amplitude, center, phase
```

The result: parameters drift smoothly between different oscillation behaviours, creating patterns that never repeat but always look intentional.

## Layer 1: The Oscillator

An oscillator is a simple waveform generator, like a synth LFO:

```
Parameters:
  Center     ──► The midpoint the wave oscillates around
  Amplitude  ──► How far above/below center it swings
  Period     ──► Time for one full cycle (seconds). Period = 1 / frequency
  Phase      ──► Offset into the cycle (0-1, normalised)

Output at time t:
  scaledTime = 2π × (t + Phase) / Period
  value = Center + Amplitude × sin(scaledTime)
```

```
    Amplitude
    ┌───┐
    │   │       ╭──────╮                  ╭──────╮
    │   │      ╱        ╲                ╱        ╲
────│───│─────╱──────────╲──────────────╱──────────╲────── Center
    │   │    ╱            ╲            ╱            ╲
    │   │   ╱              ╲          ╱              ╲
    └───┘  ╱                ╲────────╱                ╲───
           │◄──── Period ────►│
```

### Waveform Shapes

The system supports multiple shapes (though Sine is the primary one used):

| Shape    | Behaviour                                       |
|----------|-------------------------------------------------|
| Sine     | Smooth oscillation (most common)                |
| Triangle | Linear up then linear down                      |
| Sawtooth | Linear ramp, used for loopable params like rotation |
| Square   | Snaps between -Amplitude and +Amplitude         |
| Constant | No oscillation, just returns Center              |

### Lerping Between Oscillators

Two oscillators can be interpolated:

```typescript
function lerpOscillator(a: Oscillator, b: Oscillator, t: number): value {
    valueA = a.evaluate(time);
    valueB = b.evaluate(time);
    return lerp(valueA, valueB, t);
}
```

This is the core mechanism the interpolator uses.

## Layer 2: The Shuffler

A shuffler randomises an oscillator's parameters within bounds. Each GEOM parameter has its own shuffler with ranges tuned to produce good-looking results.

### What Gets Randomised

```
┌─────────────────────────────────────────────────────────────┐
│  SHUFFLER for a single parameter                            │
│                                                             │
│  AbsoluteMin ─────► Lower bound for center/amplitude        │
│  AbsoluteMax ─────► Upper bound for center/amplitude        │
│  MaxChangePerSecond ► Rate limiter (prevents flickering)    │
│  MinFrequency ────► Slowest oscillation (Hz)                │
│  MaxFrequency ────► Fastest oscillation (Hz)                │
│                                                             │
│  Shuffle():                                                 │
│    1. Pick random Amplitude (0 to half the total range)     │
│    2. Pick random Center (within bounds, respecting Amp)    │
│    3. Pick random Phase (0-1)                               │
│    4. Pick random Frequency (min to max Hz → Period)        │
│    5. Enforce MaxChangePerSecond (increase Period if needed) │
│    6. Chance to "freeze" (set to Constant shape)            │
└─────────────────────────────────────────────────────────────┘
```

### Rate Limiting (MaxChangePerSecond)

Prevents oscillators from changing too fast and looking chaotic:

```
For a sine wave:
  max rate of change = 2π × Amplitude × Frequency

If this exceeds MaxChangePerSecond:
  Frequency is capped to: MaxChangePerSecond / (2π × Amplitude)
```

Different waveform shapes have different derivative coefficients:
- Sine: 2π
- Triangle: 4
- Sawtooth: 2

### Freeze Chance

On each shuffle, there's a chance (default 30%) the oscillator "freezes":
- Shape set to Constant
- Random center value picked
- Amplitude set to 0
- The parameter holds steady until the next shuffle

This creates moments of stillness between movement — important for visual rhythm.

## Layer 3: The Interpolator (Ping-Pong)

This is where the magic happens. The interpolator manages two shuffled oscillators and smoothly transitions between them:

```
    Time ──────────────────────────────────────────────────►

    Oscillator A              Oscillator B              Oscillator A'
    (shuffled)                (shuffled)                (re-shuffled)
         │                        │                         │
         │    LERP A → B          │     LERP B → A'         │
         │◄──────────────────────►│◄────────────────────────►│
         │   10-30 seconds        │    10-30 seconds         │
         │                        │                          │
    t=0 ─┤────────────────────────┤──────────────────────────┤── t=0
         │      t increases       │       t decreases        │
         │        0 → 1           │         1 → 0            │
         │                        │                          │
         │  On arrival: shuffle B │  On arrival: shuffle A   │
         │  and reverse direction │  and reverse direction   │
```

### Step By Step

1. **Start**: Oscillator A and B are both shuffled randomly
2. **Lerp forward**: `t` increases from 0 to 1 over `InterpolationPeriod` seconds
3. **Output** = `lerp(A.evaluate(time), B.evaluate(time), ease(t))`
4. **Reach B** (t=1): Copy B's state into A, re-shuffle B with new random params
5. **Lerp backward**: `t` decreases from 1 to 0
6. **Reach A** (t=0): Copy A's state into B, re-shuffle A with new random params
7. **Repeat forever**

### Easing

The `t` value is passed through cubic ease-in-out before lerping:

```
    eased(t) = t < 0.5
        ? 4 × t³
        : 1 - (-2t + 2)³ / 2

    This means:
    ─── Slow start ──── Fast middle ──── Slow end ───
```

The easing makes transitions feel natural rather than mechanical.

### What This Looks Like

Consider the `radius` parameter with InterpolationPeriod = 15 seconds:

```
Second 0:   Oscillator A: sine, center=3, amp=1, period=4s
            Oscillator B: sine, center=8, amp=2, period=7s
            Output ≈ A's value (t≈0)

Second 7:   Output = blend of A and B (t≈0.5)
            Radius smoothly drifts between two different oscillation styles

Second 15:  Output ≈ B's value (t≈1)
            → Shuffle A to new random params
            → Reverse: now lerping back toward A

Second 22:  Output = blend of B and new-A (t≈0.5)

Second 30:  Output ≈ new-A's value (t≈0)
            → Shuffle B to new random params
            → Reverse again
```

The radius is always oscillating, but the *character* of its oscillation drifts over time.

## Parameter Configuration

Each GEOM parameter has specific ranges and behaviours that produce good visuals:

### Parameters With Oscillators

| Parameter   | Range        | MaxChange/s | Notes                          |
|-------------|--------------|-------------|--------------------------------|
| PositionX   | (-30, 30)    | 10          | Object horizontal movement     |
| PositionY   | (-30, 30)    | 10          | Object vertical movement       |
| RotationZ   | (0, 360)     | 720         | Twist. Uses sawtooth for continuous spin |
| Scale       | varied       | varied      | Uniform scale                  |
| Radius      | (0, 20)      | 1           | Ring radius. Slow changes look best |
| CubeFill    | (0, 1)       | 1           | Cube width relative to spacing |
| CubeHeight  | varied       | varied      | Cube depth/height              |
| CubeSpin    | varied       | varied      | Per-cube rotation              |
| Hue         | unconstrained| —           | Wraps 0-1, free to drift       |

### Parameters Without Oscillators (Static or Manual)

| Parameter    | Default | Notes                         |
|--------------|---------|-------------------------------|
| Saturation   | 1.0     | Usually held constant         |
| Brightness   | 1.0     | Usually held constant         |
| Metallic     | 0.0     | Material property             |
| Smoothness   | 0.2     | Material property             |
| RadiusCrunch | —       | Collapse effect, usually manual |
| CubeCount    | —       | Usually fixed at init         |

### Per-Second Offsets

Some parameters also have a `PerSecond` value — a constant rate of change applied to all existing slices each frame. Most notable:

| Parameter       | Typical PerSecond | Effect                              |
|-----------------|-------------------|-------------------------------------|
| Hue             | 0.1               | Rainbow shift along the tunnel      |
| TranslationZ    | -5                | Slices move away from camera        |
| RotationX/Y/Z   | 5-10              | Tunnel twists over time             |

## Global Shuffle Parameters

When a full shuffle happens, these global parameters affect all oscillators:

```
ShuffleChance         = 1.0   (probability each param gets shuffled)
FreezeChance          = 0.3   (probability of freezing to constant)
SawtoothChance        = 0.5   (probability of sawtooth for loopable params)
GlobalMinFrequency    = 0 Hz  (slowest any oscillator can be)
GlobalMaxFrequency    = 0.2 Hz (fastest — one cycle per 5 seconds)
InterpolationPeriod   = 10-30s (time to lerp between states)
```

The low frequency range (0 to 0.2 Hz) is important — it means oscillations take 5+ seconds per cycle, which feels ambient rather than jittery.

## Hue: A Special Case

Hue is handled differently because it wraps around (0 and 1 are the same colour):

```
Before interpolation:
  hueA = abs(oscillatorA.value) % 1.0
  hueB = abs(oscillatorB.value) % 1.0

The hue oscillator is NOT range-constrained — it can drift freely.
The modulo wrap creates natural colour cycling.

Combined with HuePerSecond = 0.1 on existing slices,
the tunnel shows a rainbow gradient along its length.
```

## Architecture Summary (Unity)

```
GeomWrapper                          One per GEOM object
  │
  ├─ GeomVariableWrapper             One per parameter (radius, hue, fill, etc.)
  │   │
  │   ├─ OscillatorShufflerProvider
  │   │   │
  │   │   └─ Interpolator            Ping-pongs between two shuffled oscillators
  │   │       │
  │   │       ├─ Shuffler A ──► Oscillator A
  │   │       │
  │   │       └─ Shuffler B ──► Oscillator B
  │   │
  │   └─ (optional) AudioVariableProvider
  │
  └─► IGeomControllable.SetParameter(param, value)
      │
      └─► GeomObject2 (applies to compute shader uniforms)
```

## What We Need To Port

For the web implementation, we need:

1. **Oscillator class** — Evaluate sine/sawtooth/constant at time t
2. **Shuffler** — Randomise oscillator params within configured bounds
3. **Interpolator** — Ping-pong lerp between two oscillators, re-shuffle on arrival
4. **Parameter config** — The ranges/limits table for each GEOM parameter
5. **Controller** — Ties interpolators to GeomEntity config, runs each frame

We do NOT need to port:
- Audio system (no audio input on web for now)
- Unity MonoBehaviour/ScriptableObject patterns
- The provider chain abstraction (overkill for web — direct connection is fine)
- Offset system (simplify to just the base value)

The core loop is simple:
```
each frame:
  for each animated parameter:
    interpolator.update(deltaTime)
    value = interpolator.getValue(time)
    geomConfig[parameter] = value
```
