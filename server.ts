import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/ai-analyze", express.json(), async (req, res) => {
    try {
      const apiKey = req.headers["x-gemini-key"] || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "GEMINI API KEY is missing. Please configure it in Settings." });
      }

      const { metadata, seo, stats, headings } = req.body;
      const prompt = `You are an expert SEO and Web Performance Analyst.
Review the following extracted website data and provide a concise, structured SEO & Content analysis.
Format your response in Markdown. Include:
1. **Overall Score** (Out of 100)
2. **Strengths** (What they did right)
3. **Weaknesses** (Critical issues)
4. **Actionable Recommendations** (How to fix the issues)

Website Data:
${JSON.stringify({ metadata, seo, stats, headings }, null, 2).substring(0, 3000)}`;

      const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
         contents: [{ parts: [{ text: prompt }] }],
         generationConfig: { temperature: 0.4 }
      }, { headers: { 'Content-Type': 'application/json' } });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
      res.json({ analysis: text });
    } catch (error: any) {
      console.error("AI Error:", error.message);
      res.status(500).json({ error: `AI request failed: ${error.message}` });
    }
  });

  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.status(400).send("URL parameter is required");
    }

    try {
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      });
      res.send(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
    } catch (error: any) {
      console.error("Proxy Error:", error.message);
      let errorMsg = error.message;
      if (error.response?.status === 403) {
        errorMsg = "403 Forbidden: The target website is actively blocking automated access (e.g., Cloudflare, WAF).";
      } else if (error.response?.status) {
        errorMsg = `${error.response.status} Error: ${error.message}`;
      }
      res.status(500).send(`Error fetching URL: ${errorMsg}`);
    }
  });

  app.get("/api/check", async (req, res) => {
    const targetUrl = req.query.url as string;
    
    if (!targetUrl) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    try {
      // Use HEAD request to ping the URL to check status without fetching full content
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 5000,
        validateStatus: () => true // Resolve on all status codes
      });
      
      res.json({
        ok: response.status >= 200 && response.status < 400,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'] || 'Unknown',
        method: response.config.method?.toUpperCase() || 'GET'
      });
    } catch (error: any) {
      res.json({
        ok: false,
        status: error.response?.status || 0,
        statusText: error.message,
        contentType: 'Unknown',
        method: 'GET'
      });
    }
  });

  app.get("/api/scrape", async (req, res) => {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    let browser;
    try {
      const parsedUrl = new URL(targetUrl);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const isDeep = req.query.deep === 'true';

      browser = await puppeteer.launch({ 
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          headless: true
        });
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        
        await page.setRequestInterception(true);
        page.on("request", (req) => {
            const rt = req.resourceType();
            // Allow everything necessary for CSR rendering, block images/media to save bandwidth
            if (["image", "font", "media", "stylesheet"].includes(rt)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        const fetchHtml = async (url: string) => {
           await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
           return await page.content();
        };

      const parseHtml = (html: string, currentUrl: string) => {
        const $ = cheerio.load(html);
        
        // Meta Data
        const title = $("title").text() || $("meta[property='og:title']").attr("content") || "";
        const metaDescription = $("meta[name='description']").attr("content") || "";
        const metaKeywords = $("meta[name='keywords']").attr("content") || "";
        
        // JSON-LD (Structured Data)
        const jsonLdData: any[] = [];
        $("script[type='application/ld+json']").each((i, el) => {
          try {
            const content = $(el).html();
            if (content) jsonLdData.push(JSON.parse(content));
          } catch (e) {}
        });

        // API Endpoints
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

        // iframes (Embeds)
        const iframes: { src: string; title: string }[] = [];
        $("iframe").each((i, el) => {
          const src = $(el).attr("src");
          if (src) iframes.push({ src, title: $(el).attr("title") || "" });
        });

        // Open Graph
        const ogTitle = $("meta[property='og:title']").attr("content") || "";
        const ogDescription = $("meta[property='og:description']").attr("content") || "";
        const ogImage = $("meta[property='og:image']").attr("content") || "";

        // Headings
        const headings = { h1: [] as string[], h2: [] as string[], h3: [] as string[] };
        $("h1").each((i, el) => { headings.h1.push($(el).text().trim()); });
        $("h2").each((i, el) => { headings.h2.push($(el).text().trim()); });
        $("h3").each((i, el) => { headings.h3.push($(el).text().trim()); });

        // Images
        const images: { src: string; alt: string }[] = [];
        $("img").each((i, el) => {
          const src = $(el).attr("src");
          const alt = $(el).attr("alt") || "";
          if (src) {
            images.push({ src: src.startsWith("/") && !src.startsWith("//") ? `${baseUrl}${src}` : src, alt });
          }
        });

        // Media
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

        // Links
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

      // 1. Fetch Main Page
      const mainHtml = await fetchHtml(targetUrl);
      const data = parseHtml(mainHtml, targetUrl);

      // 2. Optional: Deep Crawl
      if (isDeep) {
        // Collect unique internal links to crawl (max 5)
        const linksToCrawl = Array.from(new Set(data.internalLinks.map(l => l.href)))
          .filter(href => href !== targetUrl && !href.includes('#')) // exclude same page / anchors
          .slice(0, 5);

        if (linksToCrawl.length > 0) {
          for (const href of linksToCrawl) {
            try {
              const html = await fetchHtml(href);
              const res = parseHtml(html, href);
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
            } catch (err) {
              console.error(`Error crawling ${href}: ${err}`);
            }
          }
        }
      }

      res.json({
        metadata: {
          title: data.title,
          description: data.metaDescription,
          keywords: data.metaKeywords,
        },
        openGraph: {
          title: data.ogTitle,
          description: data.ogDescription,
          image: data.ogImage,
        },
        stats: {
          htmlLength: data.htmlLength,
          internalLinkCount: data.internalLinks.length,
          externalLinkCount: data.externalLinks.length,
          imageCount: data.images.length,
          mediaCount: data.mediaList.length,
          iframeCount: data.iframes.length,
          pagesCrawled: isDeep ? 6 : 1
        },
        deepData: {
          jsonLd: data.jsonLdData,
          apiEndpoints: Array.from(data.apiEndpoints),
          iframes: data.iframes,
          hasNextJsState: !!data.nextJsData
        },
        technologies: data.technologies,
        seo: {
          titleLength: data.title.length,
          descriptionLength: data.metaDescription.length,
          h1Count: data.headings.h1.length,
          imagesMissingAlt: data.images.filter(img => !img.alt).length,
        },
        headings: data.headings,
        media: data.mediaList,
        images: data.images.slice(0, 50),
        internalLinks: Array.from(new Set(data.internalLinks.map(l => l.href))).map(href => {
          return data.internalLinks.find(l => l.href === href)!;
        }).slice(0, 50),
        externalLinks: Array.from(new Set(data.externalLinks.map(l => l.href))).map(href => {
          return data.externalLinks.find(l => l.href === href)!;
        }).slice(0, 50),
      });
    } catch (error: any) {
      console.error("Scrape Error:", error.message);
      let errorMsg = error.message;
      if (error.response?.status === 403) {
        errorMsg = "403 Forbidden: The target website is actively blocking automated access (e.g., Cloudflare, WAF).";
      } else if (error.response?.status) {
        errorMsg = `${error.response.status} Error: ${error.message}`;
      }
      res.status(500).json({ error: `Error scraping URL: ${errorMsg}` });
    } finally {
      if (browser) await browser.close();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
