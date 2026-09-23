// Renders public/icon.svg into the PNG icons iPhone and the web manifest need.
// Run with: npm run icons
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { webkit } from '@playwright/test'

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8')
const sizes = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 }

const browser = await webkit.launch()
for (const [file, size] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  )
  await page.screenshot({ path: fileURLToPath(new URL(`../public/${file}`, import.meta.url)) })
  await page.close()
  console.log(`wrote public/${file}`)
}
await browser.close()
