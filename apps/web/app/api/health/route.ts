export async function GET() {
  return Response.json({ status: "ok", service: "strikepath-web", version: "0.1.0" });
}
