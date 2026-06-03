import { Hono } from "hono";
import puppeteer from "@cloudflare/puppeteer";
import * as cheerio from "cheerio";

type Bindings = {
  MYBROWSER: any; // Binding for Cloudflare Browser Rendering API
  GEMINI_API_KEY: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/check", async (c) => {
  const targetUrl = c.req.query('url');
  if (!targetUrl) return c.json({ error: "URL required" }, 400);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    return c.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type") || "Unknown"
    });
  } catch (e: any) {
    return c.json({ ok: false, status: 0, statusText: e.message });
  }
});

app.post("/api/ai-analyze", async (c) => {
  const apiKey = c.req.header("x-gemini-key") || c.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ error: "GEMINI API KEY is missing. Please setup your key via the Settings menu." }, 400);
  }

  try {
    const body = await c.req.json();
    const { metadata, seo, stats, headings } = body;
    
    const prompt = `You are an expert SEO and Web Performance Analyst.
Review the following extracted website data and provide a concise, structured SEO & Content analysis.
Format your response in Markdown. Include:
1. **Overall Score** (Out of 100)
2. **Strengths** (What they did right)
3. **Weaknesses** (Critical issues)
4. **Actionable Recommendations** (How to fix the issues)

Website Data:
${JSON.stringify({ metadata, seo, stats, headings }, null, 2).substring(0, 3000)}`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         contents: [{ parts: [{ text: prompt }] }],
         generationConfig: { temperature: 0.4 }
      })
    });

    const result: any = await aiResponse.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";

    return c.json({ analysis: text });
  } catch (error: any) {
    return c.json({ error: `AI request failed: ${error.message}` }, 500);
  }
});

app.get("/api/proxy", async (c) => {
  const targetUrl = c.req.query('url');
  if (!targetUrl) return c.text("URL parameter required", 400);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") || "text/plain" }
    });
  } catch (error: any) {
    return c.text(`Error: ${error.message}`, 500);
  }
});

// Helper for fetching HTML using Browser Rendering API if available
async function fetchHtmlWithBrowser(env: Bindings, targetUrl: string): Promise<{ html: string, usingPuppeteer: boolean, error: string | null, networkMediaUrls: string[] }> {
    if (env.MYBROWSER) {
        let browser;
        try {
            browser = await puppeteer.launch(env.MYBROWSER);
            const page = await browser.newPage();
            // Important: Hide headless browser user-agent
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            
            const networkMediaUrls = new Set<string>();
            try {
               await page.setRequestInterception(true);
               page.on("request", (req) => {
                   const rt = req.resourceType();
                   if (["image", "font", "stylesheet"].includes(rt as string)) {
                       req.abort();
                   } else {
                       req.continue();
                   }
               });
               
               page.on("response", async (res) => {
                   try {
                       const url = res.url();
                       if (url.includes('.m3u8') || url.includes('.mp4')) {
                           networkMediaUrls.add(url);
                       }
                   } catch(e) {}
               });
            } catch (interceptErr) {
               console.error("Puppeteer intercept error:", interceptErr);
            }
            
            // Just go directly, cloudflare browser handles this smoothly
            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            console.log("Puppeteer page title:", await page.title());
            // Wait extra time for async videos to load
            await new Promise(r => setTimeout(r, 2000));
            const content = await page.content();
            return { html: content, usingPuppeteer: true, error: null, networkMediaUrls: Array.from(networkMediaUrls) };
        } catch (e: any) {
             console.error("Puppeteer fail fallback to normal fetch", e.message);
             return { html: '', usingPuppeteer: false, error: e.message, networkMediaUrls: [] }; // Temporarily return error for debugging
        } finally {
            if (browser) await browser.close();
        }
    }
    
    // Fallback standard fetch
    const resp = await fetch(targetUrl, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", 
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      }
    });
    
    const maxBytes = 5 * 1024 * 1024; 
    let html = '';
    if (resp.body) {
       const reader = resp.body.getReader();
       let bytes = 0;
       const decoder = new TextDecoder();
       while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         if (value) {
           html += decoder.decode(value, { stream: true });
           bytes += value.length;
           if (bytes > maxBytes) {
             await reader.cancel();
             break;
           }
         }
       }
    } else {
       html = await resp.text();
       if (html.length > maxBytes) html = html.substring(0, maxBytes);
    }
    return { html, usingPuppeteer: false, error: "MYBROWSER binding not found or errored", networkMediaUrls: [] };
}

app.get("/api/scrape", async (c) => {
  const targetUrl = c.req.query('url');
  const isDeep = c.req.query('deep') === 'true';

  if (!targetUrl) return c.json({ error: "URL parameter required" }, 400);

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const parseHtml = (html: string) => {
      const $ = cheerio.load(html);
      const title = $("title").text() || $("meta[property='og:title']").attr("content") || "";
      const metaDescription = $("meta[name='description']").attr("content") || "";
      const metaKeywords = $("meta[name='keywords']").attr("content") || "";
      
      const jsonLdData: any[] = [];
      $("script[type='application/ld+json']").each((_, el) => {
        try {
          const content = $(el).html();
          if (content) jsonLdData.push(JSON.parse(content));
        } catch (e) {}
      });

      const apiEndpoints = new Set<string>();
      let nextJsData = null;
      $("script").each((_, el) => {
        const src = $(el).attr("src");
        if (src && (src.includes("/api/") || src.includes(".json"))) apiEndpoints.add(src);
        const content = $(el).html();
        if (content) {
          const apiMatches = content.match(/https?:\/\/[^\s"'`]+?\/api\/[^\s"'`]+/gi);
          if (apiMatches) apiMatches.forEach(m => apiEndpoints.add(m));
          if (content.includes("__NEXT_DATA__")) {
             try {
                const match = content.match(/__NEXT_DATA__\s*=\s*(\{.*?\});/);
                if (match) nextJsData = JSON.parse(match[1]);
             } catch (e) {}
          }
        }
      });

      const iframes: any[] = [];
      $("iframe").each((_, el) => {
        const src = $(el).attr("src");
        if (src) iframes.push({ src, title: $(el).attr("title") || "" });
      });

      const headings = { h1: [] as string[], h2: [] as string[], h3: [] as string[] };
      $("h1").each((_, el) => { headings.h1.push($(el).text().trim()); });
      $("h2").each((_, el) => { headings.h2.push($(el).text().trim()); });
      $("h3").each((_, el) => { headings.h3.push($(el).text().trim()); });

      const images: any[] = [];
      $("img").each((_, el) => {
        const src = $(el).attr("src");
        const alt = $(el).attr("alt") || "";
        if (src) images.push({ src: src.startsWith("/") && !src.startsWith("//") ? `${baseUrl}${src}` : src, alt });
      });

      const mediaUrls = new Set<string>();
      $("video, source, audio").each((_, el) => {
        const src = $(el).attr("src");
        if (src) try { mediaUrls.add(new URL(src, baseUrl).href); } catch (e) {}
      });
      const mediaRegex = /(https?:\/\/[^"'\s\\<>]+?\.(?:mp4|m3u8))/gi;
      let match;
      while ((match = mediaRegex.exec(html)) !== null) mediaUrls.add(match[1]);
      const mediaList = Array.from(mediaUrls).map(url => ({ url, type: url.includes(".m3u8") ? "HLS" : "Video" }));

      const internalLinks: { text: string; href: string }[] = [];
      const externalLinks: { text: string; href: string }[] = [];
      $("a").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim() || $(el).attr("aria-label") || "";
        if (href && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
          try {
            const linkUrl = new URL(href, baseUrl);
            if (linkUrl.host === parsedUrl.host) internalLinks.push({ text: text || "[No Text]", href: linkUrl.href });
            else externalLinks.push({ text: text || "[No Text]", href: linkUrl.href });
          } catch (e) {}
        }
      });

      const technologies: string[] = [];
      const htmlLower = html.toLowerCase();
      if (htmlLower.includes("wp-content/")) technologies.push("WordPress");
      if (htmlLower.includes("/_next/")) technologies.push("Next.js");
      else if (htmlLower.includes("data-reactroot")) technologies.push("React");
      if (htmlLower.includes("/_nuxt/")) technologies.push("Nuxt.js");
      else if (htmlLower.includes("data-v-")) technologies.push("Vue.js");
      if (htmlLower.includes("tailwindcss")) technologies.push("Tailwind CSS");

      return { title, metaDescription, metaKeywords, jsonLdData, apiEndpoints, nextJsData, iframes, headings, images, mediaList, internalLinks, externalLinks, htmlLength: html?.length || 0, technologies, ogTitle: $("meta[property='og:title']").attr("content") || "", ogDescription: $("meta[property='og:description']").attr("content") || "", ogImage: $("meta[property='og:image']").attr("content") || "" };
    };

    const { html: mainHtml, usingPuppeteer, error: puppeteerError, networkMediaUrls } = await fetchHtmlWithBrowser(c.env, targetUrl);
    
    if (puppeteerError) {
        return c.json({ error: `Puppeteer Error: ${puppeteerError}` }, 500);
    }
    
    const data = parseHtml(mainHtml);
    if (networkMediaUrls && networkMediaUrls.length > 0) {
       networkMediaUrls.forEach(url => {
          if (!data.mediaList.find(m => m.url === url)) {
             data.mediaList.push({ url, type: url.includes(".m3u8") ? "HLS" : "Video" });
          }
       });
    }

    if (isDeep) {
      const linksToCrawl = Array.from(new Set(data.internalLinks.map(l => l.href))).filter(href => href !== targetUrl && !href.includes('#')).slice(0, 3);
      if (linksToCrawl.length > 0) {
        for (const href of linksToCrawl) {
          try {
            const { html: h, error: deepError } = await fetchHtmlWithBrowser(c.env, href);
            if (!deepError && h) {
                const res = parseHtml(h);
                if (res) {
                  res.mediaList.forEach(m => { if (!data.mediaList.find(dm => dm.url === m.url)) data.mediaList.push(m); });
                  res.apiEndpoints.forEach(a => data.apiEndpoints.add(a));
                  res.iframes.forEach(iframe => { if (!data.iframes.find(d => d.src === iframe.src)) data.iframes.push(iframe); });
                  res.jsonLdData.forEach(j => data.jsonLdData.push(j));
                  data.htmlLength += res.htmlLength;
                }
            }
          } catch (e) {
            console.error("Deep crawl error:", e);
          }
        }
      }
    }

    return c.json({
      metadata: { title: data.title, description: data.metaDescription, keywords: data.metaKeywords },
      openGraph: { title: data.ogTitle, description: data.ogDescription, image: data.ogImage },
      stats: { htmlLength: data.htmlLength, internalLinkCount: data.internalLinks.length, externalLinkCount: data.externalLinks.length, imageCount: data.images.length, mediaCount: data.mediaList.length, iframeCount: data.iframes.length, pagesCrawled: isDeep ? 6 : 1, usingPuppeteer },
      deepData: { jsonLd: data.jsonLdData, apiEndpoints: Array.from(data.apiEndpoints), iframes: data.iframes, hasNextJsState: !!data.nextJsData },
      technologies: data.technologies,
      seo: { titleLength: data.title.length, descriptionLength: data.metaDescription.length, h1Count: data.headings.h1.length, imagesMissingAlt: data.images.filter(img => !img.alt).length },
      headings: data.headings, media: data.mediaList, images: data.images.slice(0, 50),
      internalLinks: Array.from(new Set(data.internalLinks.map(l => l.href))).map(href => data.internalLinks.find(l => l.href === href)!).slice(0, 50),
      externalLinks: Array.from(new Set(data.externalLinks.map(l => l.href))).map(href => data.externalLinks.find(l => l.href === href)!).slice(0, 50),
    });
  } catch (error: any) {
    return c.json({ error: `Error: ${error.message}` }, 500);
  }
});

app.get('/*', async (c) => {
  return c.env.ASSETS.fetch(new Request(new URL("/", c.req.url), c.req.raw));
});

export default app;