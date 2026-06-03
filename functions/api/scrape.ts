import * as cheerio from "cheerio";

export async function onRequestGet(context: any) {
  const { request } = context;
  const searchParams = new URL(request.url).searchParams;
  const targetUrl = searchParams.get('url');
  const isDeep = searchParams.get('deep') === 'true';

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "URL parameter is required" }), { status: 400 });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const fetchHtml = async (url: string) => {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
      });
      return await resp.text();
    };

    const parseHtml = (html: string, currentUrl: string) => {
      const $ = cheerio.load(html);
      
      const title = $("title").text() || $("meta[property='og:title']").attr("content") || "";
      const metaDescription = $("meta[name='description']").attr("content") || "";
      const metaKeywords = $("meta[name='keywords']").attr("content") || "";
      
      const jsonLdData: any[] = [];
      $("script[type='application/ld+json']").each((i, el) => {
        try {
          const content = $(el).html();
          if (content) jsonLdData.push(JSON.parse(content));
        } catch (e) {}
      });

      const apiEndpoints = new Set<string>();
      let nextJsData = null;
      $("script").each((i, el) => {
        const src = $(el).attr("src");
        if (src && (src.includes("/api/") || src.includes(".json"))) {
           apiEndpoints.add(src);
        }
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

      const iframes: { src: string; title: string }[] = [];
      $("iframe").each((i, el) => {
        const src = $(el).attr("src");
        if (src) iframes.push({ src, title: $(el).attr("title") || "" });
      });

      const ogTitle = $("meta[property='og:title']").attr("content") || "";
      const ogDescription = $("meta[property='og:description']").attr("content") || "";
      const ogImage = $("meta[property='og:image']").attr("content") || "";

      const headings = { h1: [] as string[], h2: [] as string[], h3: [] as string[] };
      $("h1").each((i, el) => { headings.h1.push($(el).text().trim()); });
      $("h2").each((i, el) => { headings.h2.push($(el).text().trim()); });
      $("h3").each((i, el) => { headings.h3.push($(el).text().trim()); });

      const images: { src: string; alt: string }[] = [];
      $("img").each((i, el) => {
        const src = $(el).attr("src");
        const alt = $(el).attr("alt") || "";
        if (src) {
          images.push({ src: src.startsWith("/") && !src.startsWith("//") ? `${baseUrl}${src}` : src, alt });
        }
      });

      const mediaUrls = new Set<string>();
      $("video, source, audio, iframe").each((i, el) => {
        const src = $(el).attr("src");
        if (src && (src.includes(".mp4") || src.includes(".m3u8"))) {
          try { mediaUrls.add(new URL(src, baseUrl).href); } catch (e) {}
        }
      });
      const mediaRegex = /(https?:\/\/[^"'\s\\<>]+?\.(?:mp4|m3u8)(?:\?[^"'\s\\<>]*)?)/gi;
      let match;
      while ((match = mediaRegex.exec(html)) !== null) {
        mediaUrls.add(match[1]);
      }
      const mediaList = Array.from(mediaUrls).map(url => ({
        url,
        type: url.toLowerCase().includes(".m3u8") ? "HLS (.m3u8)" : "Video (.mp4)"
      }));

      const internalLinks: { text: string; href: string }[] = [];
      const externalLinks: { text: string; href: string }[] = [];
      $("a").each((i, el) => {
        const href = $(el).attr("href");
        let text = $(el).text().trim() || $(el).attr("aria-label") || $(el).attr("title") || "";
        if (href && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
          try {
            const linkUrl = new URL(href, baseUrl);
            const linkObj = { text: text || "[No Text]", href: linkUrl.href };
            if (linkUrl.host === parsedUrl.host) {
              internalLinks.push(linkObj);
            } else {
              externalLinks.push(linkObj);
            }
          } catch (e) {}
        }
      });

      const technologies: string[] = [];
      const htmlLower = html.toLowerCase();
      if (htmlLower.includes("wp-content/")) technologies.push("WordPress");
      if (htmlLower.includes("/_next/") || htmlLower.includes("__next_data__")) technologies.push("Next.js");
      else if (htmlLower.includes("data-reactroot") || htmlLower.includes('id="root"')) technologies.push("React");
      if (htmlLower.includes("/_nuxt/") || htmlLower.includes("__nuxt__")) technologies.push("Nuxt.js");
      else if (htmlLower.includes("data-v-") || htmlLower.includes("__vue__")) technologies.push("Vue.js");
      if (htmlLower.includes("ng-version=")) technologies.push("Angular");
      if (htmlLower.includes("tailwindcss")) technologies.push("Tailwind CSS");

      return {
        title, metaDescription, metaKeywords, jsonLdData, apiEndpoints, nextJsData,
        iframes, ogTitle, ogDescription, ogImage, headings, images, mediaList,
        internalLinks, externalLinks, htmlLength: html?.length || 0, technologies
      };
    };

    const mainHtml = await fetchHtml(targetUrl);
    const data = parseHtml(mainHtml, targetUrl);

    if (isDeep) {
      const linksToCrawl = Array.from(new Set(data.internalLinks.map(l => l.href)))
        .filter(href => href !== targetUrl && !href.includes('#'))
        .slice(0, 5);

      if (linksToCrawl.length > 0) {
        const crawlPromises = linksToCrawl.map(async (href) => {
          try {
            const html = await fetchHtml(href);
            return parseHtml(html, href);
          } catch (err) {
            return null;
          }
        });
        
        const results = await Promise.all(crawlPromises);
        results.forEach(res => {
          if (res) {
            res.mediaList.forEach(m => {
              if (!data.mediaList.find(dm => dm.url === m.url)) data.mediaList.push(m);
            });
            res.apiEndpoints.forEach(a => data.apiEndpoints.add(a));
            res.iframes.forEach(iframe => {
              if (!data.iframes.find(d => d.src === iframe.src)) data.iframes.push(iframe);
            });
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
    let errorMsg = error.message;
    return new Response(JSON.stringify({ error: `Error scraping URL: ${errorMsg}` }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
