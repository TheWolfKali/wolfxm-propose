import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Dark slate background
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, size, size)

  // Wolf emoji
  const fontSize = size * 0.45
  ctx.font = `bold ${fontSize}px serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('\uD83D\uDC3A', size / 2, size * 0.48)

  // WOLFXM label
  const labelSize = size * 0.13
  ctx.font = `bold ${labelSize}px sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('WOLFXM', size / 2, size * 0.82)

  return canvas.toBuffer('image/png')
}

writeFileSync('public/icon-192.png', generateIcon(192))
writeFileSync('public/icon-512.png', generateIcon(512))
writeFileSync('public/apple-touch-icon.png', generateIcon(180))
console.log('Icons generated: icon-192.png, icon-512.png, apple-touch-icon.png')
