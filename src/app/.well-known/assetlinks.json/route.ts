// Digital Asset Links: lets the Android app (Trusted Web Activity) open this site full screen,
// without the browser bar. ANDROID_CERT_SHA256 lists the signing certificate fingerprints,
// comma separated: the upload key and, after the first upload, the Play App Signing key.
export const dynamic = "force-dynamic";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE || "com.amorimer.auracronos";
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const body = fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints } }]
    : [];
  return Response.json(body, { headers: { "cache-control": "public, max-age=300" } });
}
