import sharp from 'sharp'
import { writeFileSync } from 'fs'

async function generateIcon(size) {
  const svg = `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#0f172a" rx="${size * 0.2}"/>
    <text
      x="50%"
      y="54%"
      font-size="${size * 0.5}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="serif"
    >🐺</text>
    <text
      x="50%"
      y="82%"
      font-size="${size * 0.13}"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="white"
      font-family="sans-serif"
      font-weight="bold"
      letter-spacing="1"
    >WOLFXM</text>
  </svg>`

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

const icon192 = await generateIcon(192)
const icon512 = await generateIcon(512)
const iconApple = await generateIcon(180)

writeFileSync('public/icon-192.png', icon192)
writeFileSync('public/icon-512.png', icon512)
writeFileSync('public/apple-touch-icon.png', iconApple)
console.log('Icons generated successfully')
