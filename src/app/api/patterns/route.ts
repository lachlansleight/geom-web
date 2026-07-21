import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

/**
 * Dev-only endpoint that persists per-pattern camera settings back into
 * patterns.json (currently just defaultZoom, auto-saved after mousewheel zoom).
 *
 * The value is replaced textually rather than re-serialising the whole file so
 * the existing hand-authored formatting is preserved. This relies on every
 * pattern's camera block containing exactly one "defaultZoom" entry, in
 * pattern order — validated below.
 */

export const runtime = "nodejs";

const PATTERNS_PATH = join(process.cwd(), "src/app/_realtime/geom/patterns/patterns.json");

export async function POST(request: Request) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
            { ok: false, error: "Pattern saving is only available in development" },
            { status: 403 }
        );
    }

    const body = await request.json();
    const { index, defaultZoom } = body ?? {};
    if (!Number.isInteger(index) || typeof defaultZoom !== "number" || !isFinite(defaultZoom)) {
        return NextResponse.json(
            { ok: false, error: "Expected { index: int, defaultZoom: number }" },
            { status: 400 }
        );
    }

    const text = readFileSync(PATTERNS_PATH, "utf8");
    const patterns = JSON.parse(text);
    if (!Array.isArray(patterns) || index < 0 || index >= patterns.length) {
        return NextResponse.json(
            { ok: false, error: `Pattern index ${index} out of range` },
            { status: 400 }
        );
    }

    let occurrence = 0;
    const updated = text.replace(/"defaultZoom":\s*-?[\d.eE+-]+/g, match =>
        occurrence++ === index ? `"defaultZoom": ${defaultZoom}` : match
    );
    if (occurrence !== patterns.length) {
        return NextResponse.json(
            {
                ok: false,
                error: `Found ${occurrence} "defaultZoom" entries for ${patterns.length} patterns — every camera block needs exactly one`,
            },
            { status: 500 }
        );
    }

    writeFileSync(PATTERNS_PATH, updated);
    return NextResponse.json({ ok: true, name: patterns[index].name, defaultZoom });
}
