const AVAILABLE_COLORS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright'
]

export function randomChalkColor() {
  const randomIndex = Math.floor(Math.random() * AVAILABLE_COLORS.length)
  return AVAILABLE_COLORS[randomIndex]
}
