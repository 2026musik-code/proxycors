export async function onRequestGet(context: any) {
  const { request } = context;
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: "URL parameter is required" }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    // Cloudflare native fetch
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      }
    });

    return new Response(JSON.stringify({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type") || "Unknown",
      method: "GET"
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      status: 0,
      statusText: error.message,
      contentType: "Unknown",
      method: "GET"
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}
