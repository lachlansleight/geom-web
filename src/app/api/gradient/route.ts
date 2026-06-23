import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

/** Hue 0–360, saturation & lightness 0–100 */
export type HslTriplet = readonly [h: number, s: number, l: number];

const WIDTH = 1200;
const HEIGHT = 800;

function hslToCss([h, s, l]: HslTriplet): string {
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function randomHsl(): HslTriplet {
    return [Math.random() * 360, Math.random() * 100, Math.random() * 100];
}

/**
 * Three gradient stops. Replace `randomHsl()` with fixed triplets, e.g.:
 * `[120, 70, 45]` for H, S%, L%.
 */
function generateGradient(): readonly [HslTriplet, HslTriplet, HslTriplet] {
    const stop0: HslTriplet = randomHsl();
    const stop1: HslTriplet = randomHsl();
    const stop2: HslTriplet = randomHsl();
    return [stop0, stop1, stop2];
}

function renderGradientPng(stops: readonly [HslTriplet, HslTriplet, HslTriplet]): Buffer {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    g.addColorStop(0, hslToCss(stops[0]));
    g.addColorStop(0.5, hslToCss(stops[1]));
    g.addColorStop(1, hslToCss(stops[2]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return canvas.toBuffer("image/png");
}

export const runtime = "nodejs";

export async function GET() {
    const stops = generateGradient();
    const png = renderGradientPng(stops);
    const filename = `gradient-${Date.now()}.png`;
    const outPath = join(process.cwd(), filename);
    writeFileSync(outPath, png);

    return NextResponse.json({
        ok: true,
        path: outPath,
        filename,
        stops: {
            "0%": [...stops[0]],
            "50%": [...stops[1]],
            "100%": [...stops[2]],
        },
    });
}
