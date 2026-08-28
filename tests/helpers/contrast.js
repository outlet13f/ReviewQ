/**
 * WCAG 2.1 상대 명도 및 대비 계산.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

const SRGB_THRESHOLD = 0.03928
const SRGB_DIVISOR = 12.92
const CHANNEL_WEIGHTS = Object.freeze({ red: 0.2126, green: 0.7152, blue: 0.0722 })

const toChannel = (value) => {
  const normalized = value / 255
  return normalized <= SRGB_THRESHOLD
    ? normalized / SRGB_DIVISOR
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

/** #rrggbb 를 {red, green, blue} 로 분해한다. */
export const parseHex = (hex) => {
  const match = /^#([0-9a-f]{6})$/iu.exec(String(hex).trim())
  if (!match) throw new Error(`16진수 색상 형식이 아닙니다: ${hex}`)
  const value = Number.parseInt(match[1], 16)
  return Object.freeze({
    red: (value >> 16) & 0xff,
    green: (value >> 8) & 0xff,
    blue: value & 0xff,
  })
}

export const relativeLuminance = (hex) => {
  const { red, green, blue } = parseHex(hex)
  return (
    CHANNEL_WEIGHTS.red * toChannel(red) +
    CHANNEL_WEIGHTS.green * toChannel(green) +
    CHANNEL_WEIGHTS.blue * toChannel(blue)
  )
}

/** 두 색의 대비비. 순서와 무관하게 같은 값이 나온다(1 ~ 21). */
export const contrastRatio = (left, right) => {
  const a = relativeLuminance(left)
  const b = relativeLuminance(right)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** CSS 소스에서 :root 커스텀 프로퍼티 값을 읽는다. */
export const readCssVariable = (css, name) => {
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`, 'u').exec(css)
  if (!match) throw new Error(`CSS 변수를 찾을 수 없습니다: --${name}`)
  return match[1].trim()
}
