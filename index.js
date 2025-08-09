const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('instagram.com')) {
    return res.status(400).json({ error: 'Invalid Instagram URL' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Try open-graph image (og:image)
    const ogImage = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:image"]');
      return meta ? meta.content : null;
    });

    // Collect images inside the post (article)
    const imgs = await page.evaluate(() => {
      const set = new Set();
      document.querySelectorAll('article img').forEach(img => {
        if (img.src) set.add(img.src);
      });
      return Array.from(set);
    });

    const images = [];
    if (ogImage) images.push(ogImage);
    imgs.forEach(i => { if (!images.includes(i)) images.push(i); });

    await browser.close();

    if (images.length === 0) return res.status(404).json({ error: 'No images found' });
    res.json({ success: true, images });
  } catch (err) {
    if (browser) await browser.close();
    console.error('Scrape error:', err);
    res.status(500).json({ error: 'Scrape failed', details: err.message });
  }
});

app.get('/', (req, res) => res.send('Instagram scraper running'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server listening on port', PORT));
