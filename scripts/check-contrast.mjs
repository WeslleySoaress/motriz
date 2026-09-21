/**
 * Verificação de contraste WCAG 2.1 dos pares de cor do design system.
 * Roda sem navegador: `node scripts/check-contrast.mjs`
 * Sai com código 1 se algum par obrigatório ficar abaixo do mínimo.
 */

function srgbToLinear(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function ratio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const DARK = {
  surface: '#0E0F12',
  surface2: '#16181C',
  surface3: '#1D2026',
  fg: '#F3F3EF',
  fgMuted: '#A7AAB1',
  fgSubtle: '#8A8E96',
  accentText: '#F0B75E',
  accentSolid: '#E9A23B',
  accentSolidFg: '#16170F',
  danger: '#FF8A80',
  success: '#7DDCA4',
}

const LIGHT = {
  surface: '#F3F3EF',
  surface2: '#FFFFFF',
  surface3: '#E7E7E0',
  fg: '#14161A',
  fgMuted: '#54585F',
  fgSubtle: '#6B6F77',
  accentText: '#8A4B0B',
  accentSolid: '#E9A23B',
  accentSolidFg: '#16170F',
  danger: '#B3261E',
  success: '#1E6B44',
}

// [nome, cor de frente, cor de fundo, mínimo exigido]
const checks = [
  ['escuro: texto principal / base', DARK.fg, DARK.surface, 4.5],
  ['escuro: texto principal / card', DARK.fg, DARK.surface2, 4.5],
  ['escuro: texto principal / elevado', DARK.fg, DARK.surface3, 4.5],
  ['escuro: texto secundário / base', DARK.fgMuted, DARK.surface, 4.5],
  ['escuro: texto secundário / card', DARK.fgMuted, DARK.surface2, 4.5],
  ['escuro: texto discreto / base', DARK.fgSubtle, DARK.surface, 4.5],
  ['escuro: destaque texto / base', DARK.accentText, DARK.surface, 4.5],
  ['escuro: destaque texto / card', DARK.accentText, DARK.surface2, 4.5],
  ['escuro: texto sobre botão âmbar', DARK.accentSolidFg, DARK.accentSolid, 4.5],
  ['escuro: erro / base', DARK.danger, DARK.surface, 4.5],
  ['escuro: sucesso / base', DARK.success, DARK.surface, 4.5],

  ['claro: texto principal / base', LIGHT.fg, LIGHT.surface, 4.5],
  ['claro: texto principal / card', LIGHT.fg, LIGHT.surface2, 4.5],
  ['claro: texto secundário / base', LIGHT.fgMuted, LIGHT.surface, 4.5],
  ['claro: texto secundário / card', LIGHT.fgMuted, LIGHT.surface2, 4.5],
  ['claro: texto discreto / base', LIGHT.fgSubtle, LIGHT.surface, 4.5],
  ['claro: destaque texto / base', LIGHT.accentText, LIGHT.surface, 4.5],
  ['claro: destaque texto / card', LIGHT.accentText, LIGHT.surface2, 4.5],
  ['claro: texto sobre botão âmbar', LIGHT.accentSolidFg, LIGHT.accentSolid, 4.5],
  ['claro: erro / base', LIGHT.danger, LIGHT.surface, 4.5],
  ['claro: sucesso / base', LIGHT.success, LIGHT.surface, 4.5],

  // Componentes não textuais (bordas, foco): mínimo 3:1 pela WCAG 1.4.11
  ['escuro: anel de foco / base', DARK.accentSolid, DARK.surface, 3],
  ['claro: anel de foco / base', LIGHT.accentSolid, LIGHT.fg, 3],
]

let failed = 0
const rows = checks.map(([name, fg, bg, min]) => {
  const r = ratio(fg, bg)
  const ok = r >= min
  if (!ok) failed++
  return { name, fg, bg, ratio: r.toFixed(2), min, status: ok ? 'OK' : 'FALHA' }
})

const width = Math.max(...rows.map((r) => r.name.length))
for (const r of rows) {
  console.log(
    `${r.status === 'OK' ? '✓' : '✗'} ${r.name.padEnd(width)}  ${String(r.ratio).padStart(6)}:1  (mín ${r.min})  ${r.fg} sobre ${r.bg}`,
  )
}

console.log(`\n${rows.length - failed}/${rows.length} pares aprovados.`)
process.exit(failed > 0 ? 1 : 0)
