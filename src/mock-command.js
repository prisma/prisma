const text = `Chalk supports 256 colors and Truecolor (16 million colors) on supported terminal apps.

Colors are downsampled from 16 million RGB values to an ANSI color format that is supported by the terminal emulator (or by specifying {level: n} as a Chalk option). For example, Chalk configured to run at level 1 (basic color support) will downsample an RGB value of #FF0000 (red) to 31 (ANSI escape for red).

Examples:

chalk.hex('#DEADED').underline('Hello, world!')
chalk.keyword('orange')('Some orange text')
chalk.rgb(15, 100, 204).inverse('Hello!')
Background versions of these models are prefixed with bg and the first level of the module capitalized (e.g. keyword for foreground colors and bgKeyword for background colors).

chalk.bgHex('#DEADED').underline('Hello, world!')
chalk.bgKeyword('orange')('Some orange text')
chalk.bgRgb(15, 100, 204).inverse('Hello!')
The following color models can be used:

rgb - Example: chalk.rgb(255, 136, 0).bold('Orange!')
hex - Example: chalk.hex('#FF8800').bold('Orange!')
keyword (CSS keywords) - Example: chalk.keyword('orange').bold('Orange!')
hsl - Example: chalk.hsl(32, 100, 50).bold('Orange!')
hsv - Example: chalk.hsv(32, 100, 100).bold('Orange!')
hwb - Example: chalk.hwb(32, 0, 50).bold('Orange!')
ansi16
ansi256`
let index = 0
let lines = text.split('\n')
function render() {
  console.log(lines[index++ % lines.length])
  setTimeout(render, Math.round(Math.random() * 200))
}
setTimeout(render, Math.round(Math.random() * 200))
