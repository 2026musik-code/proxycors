export async function onRequestGet(context: any) {
  const { request } = context;
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return new Response("URL parameter is required", { status: 400 });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      }
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "text/plain",
      }
    });
  } catch (error: any) {
    return new Response(`Error fetching URL: ${error.message}`, { status: 500 });
  }
}
