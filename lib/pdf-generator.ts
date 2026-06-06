import puppeteer from 'puppeteer';

export interface PdfOptions {
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

export async function htmlToPdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
    ],
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Disable JS: our HTML is static (inline CSS only). No need for script execution.
    await page.setJavaScriptEnabled(false);

    // Block all outbound network requests from the headless browser.
    // Our HTML is self-contained (inline CSS, no external assets).
    // Without this, a crafted payload could probe internal Railway services (SSRF)
    // or read local files via file:// URLs.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') {
        req.continue();
      } else {
        req.abort('blockedbyclient');
      }
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdf = await page.pdf({
      format: options.format ?? 'A4',
      margin: options.margin ?? {
        top: '15mm',
        bottom: '15mm',
        left: '10mm',
        right: '10mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
