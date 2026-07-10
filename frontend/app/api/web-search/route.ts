export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8001";

export async function POST(request: Request) {
  const body = await request.json();

  const upstream = await fetch(`${BACKEND}/api/web-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.json().catch(() => ({ detail: "Backend error" }));
    return new Response(JSON.stringify(err), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pipe the SSE stream directly — no buffering
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
