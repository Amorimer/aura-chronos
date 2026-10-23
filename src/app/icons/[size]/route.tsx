import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512, 1024];

// Aura Chronos mark: a glowing ring (the aura) around clock hands (chronos).
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const maskable = raw.endsWith("m");
  const size = parseInt(raw, 10);
  if (!SIZES.includes(size)) return new Response("not found", { status: 404 });
  const ring = size * (maskable ? 0.52 : 0.66);
  const stroke = Math.max(3, size * 0.05);
  const c = size / 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", position: "relative",
        background: "radial-gradient(circle at 50% 45%, #1d3a4f 0%, #0e1726 70%)" }}>
        <div style={{ position: "absolute", left: c - ring / 2 - stroke, top: c - ring / 2 - stroke, width: ring + stroke * 2, height: ring + stroke * 2,
          borderRadius: size, background: "radial-gradient(circle, rgba(92,194,177,0) 55%, rgba(92,194,177,0.35) 72%, rgba(92,194,177,0) 100%)" }} />
        <div style={{ position: "absolute", left: c - ring / 2, top: c - ring / 2, width: ring, height: ring, borderRadius: size,
          border: `${stroke}px solid #5cc2b1` }} />
        <div style={{ position: "absolute", left: c - stroke / 2, top: c - ring * 0.3, width: stroke, height: ring * 0.3, borderRadius: stroke, background: "#f6f4ef" }} />
        <div style={{ position: "absolute", left: c, top: c - stroke / 2, width: ring * 0.22, height: stroke, borderRadius: stroke, background: "#f6c560" }} />
        <div style={{ position: "absolute", left: c - stroke * 0.9, top: c - stroke * 0.9, width: stroke * 1.8, height: stroke * 1.8, borderRadius: size, background: "#f6f4ef" }} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
