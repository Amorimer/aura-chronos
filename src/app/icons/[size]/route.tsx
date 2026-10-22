import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512, 1024];

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const maskable = raw.endsWith("m");
  const size = parseInt(raw, 10);
  if (!SIZES.includes(size)) return new Response("not found", { status: 404 });
  const pad = maskable ? size * 0.2 : size * 0.12;
  const inner = size - pad * 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0f6b5f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: inner, height: inner, display: "flex", flexDirection: "column", justifyContent: "center", gap: inner * 0.09 }}>
          {[0.86, 0.62, 0.74].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: inner * 0.08 }}>
              <div style={{ width: inner * 0.13, height: inner * 0.13, borderRadius: inner, background: i === 0 ? "#f6c560" : "#f6f4ef" }} />
              <div style={{ width: inner * w * 0.78, height: inner * 0.1, borderRadius: inner, background: "#f6f4ef", opacity: i === 0 ? 1 : 0.75 }} />
            </div>
          ))}
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
