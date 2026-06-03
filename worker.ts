import * as cheerio from "cheerio";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/check") {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return new Response(JSON.stringify({ error: "URL required" }), { status: 400 });

      try {
        const response = await fetch(targetUrl, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        return new Response(JSON.stringify({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type") || "Unknown"
        }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, status: 0, statusText: e.message }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === "/api/proxy") {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return new Response("URL parameter required", { status: 400 });

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
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    if (url.pathname === "/api/scrape") {
      const targetUrl = url.searchParams.get('url');
      const isDeep = url.searchParams.get('deep') === 'true';

      if (!targetUrl) return new Response(JSON.stringify({ error: "URL parameter required" }), { status: 400 });

      try {
        const parsedUrl = new URL(targetUrl);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

        const fetchHtml = async (fetchUrl: string) => {
          const resp = await fetch(fetchUrl, {
            headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html,*/*" }
          });
          return await resp.text();
        };

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

        const mainHtml = await fetchHtml(targetUrl);
        const data = parseHtml(mainHtml);

        if (isDeep) {
          const linksToCrawl = Array.from(new Set(data.internalLinks.map(l => l.href))).filter(href => href !== targetUrl && !href.includes('#')).slice(0, 5);
          if (linksToCrawl.length > 0) {
            const crawlPromises = linksToCrawl.map(async (href) => {
              try { const h = await fetchHtml(href); return parseHtml(h); } catch (e) { return null; }
            });
            const results = await Promise.all(crawlPromises);
            results.forEach(res => {
              if (res) {
                res.mediaList.forEach(m => { if (!data.mediaList.find(dm => dm.url === m.url)) data.mediaList.push(m); });
                res.apiEndpoints.forEach(a => data.apiEndpoints.add(a));
                res.iframes.forEach(iframe => { if (!data.iframes.find(d => d.src === iframe.src)) data.iframes.push(iframe); });
                res.jsonLdData.forEach(j => data.jsonLdData.push(j));
                data.htmlLength += res.htmlLength;
              }
            });
          }
        }

        return new Response(JSON.stringify({
          metadata: { title: data.title, description: data.metaDescription, keywords: data.metaKeywords },
          openGraph: { title: data.ogTitle, description: data.ogDescription, image: data.ogImage },
          stats: { htmlLength: data.htmlLength, internalLinkCount: data.internalLinks.length, externalLinkCount: data.externalLinks.length, imageCount: data.images.length, mediaCount: data.mediaList.length, iframeCount: data.iframes.length, pagesCrawled: isDeep ? 6 : 1 },
          deepData: { jsonLd: data.jsonLdData, apiEndpoints: Array.from(data.apiEndpoints), iframes: data.iframes, hasNextJsState: !!data.nextJsData },
          technologies: data.technologies,
          seo: { titleLength: data.title.length, descriptionLength: data.metaDescription.length, h1Count: data.headings.h1.length, imagesMissingAlt: data.images.filter(img => !img.alt).length },
          headings: data.headings, media: data.mediaList, images: data.images.slice(0, 50),
          internalLinks: Array.from(new Set(data.internalLinks.map(l => l.href))).map(href => data.internalLinks.find(l => l.href === href)!).slice(0, 50),
          externalLinks: Array.from(new Set(data.externalLinks.map(l => l.href))).map(href => data.externalLinks.find(l => l.href === href)!).slice(0, 50),
        }), { headers: { 'Content-Type': 'application/json' } });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: `Error: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return env.ASSETS.fetch(new Request(new URL("/", request.url), request));
  }
}
