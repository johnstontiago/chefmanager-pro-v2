import type { Browser } from 'puppeteer-core'

export interface PdfOptions {
  format?: 'A4' | 'Letter'
  margin?: {
    top?: string
    bottom?: string
    left?: string
    right?: string
  }
}

// En producción (Railway) el contenedor no trae las librerías de sistema que
// necesita el Chromium completo que descarga `puppeteer` — @sparticuz/chromium
// empaqueta un binario compilado para entornos serverless/contenedor sin esas
// dependencias. En desarrollo local seguimos usando `puppeteer` normal, que sí
// gestiona su propio Chromium de forma transparente en la máquina del dev.
async function lanzarNavegador(): Promise<Browser> {
  if (process.env.NODE_ENV === 'production') {
    const chromium = (await import('@sparticuz/chromium')).default
    const { launch } = await import('puppeteer-core')
    return launch({
      args: [...chromium.args, '--disable-gpu'],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
    ],
    headless: true,
  })
  return browser as unknown as Browser
}

export async function htmlToPdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const browser = await lanzarNavegador()

  try {
    const page = await browser.newPage()

    // Disable JS: our HTML is static (inline CSS only). No need for script execution.
    await page.setJavaScriptEnabled(false)

    // Block all outbound network requests from the headless browser.
    // Our HTML is self-contained (inline CSS, no external assets).
    // Without this, a crafted payload could probe internal Railway services (SSRF)
    // or read local files via file:// URLs.
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const url = req.url()
      if (url.startsWith('data:') || url === 'about:blank') {
        req.continue()
      } else {
        req.abort('blockedbyclient')
      }
    })

    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdf = await page.pdf({
      format: options.format ?? 'A4',
      margin: options.margin ?? {
        top: '15mm',
        bottom: '15mm',
        left: '10mm',
        right: '10mm',
      },
      printBackground: true,
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
