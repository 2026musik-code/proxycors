const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('URL parameter is required');
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        res.send(response.data);
    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).send(`Error fetching URL: ${error.message}`);
    }
});

app.get('/scrape', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const response = await axios.get(targetUrl, {
             headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        const title = $('title').text();
        const links = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href) {
                links.push({ text, href });
            }
        });

        res.json({
            title,
            linkCount: links.length,
            links: links.slice(0, 50), // Limit to top 50 links for brevity
            htmlLength: html.length
        });

    } catch (error) {
         console.error('Scrape Error:', error.message);
         res.status(500).json({ error: `Error scraping URL: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
