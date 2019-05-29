'use strict'

const { FORCE_COLOR, NODE_DISABLE_COLORS, TERM } = process.env

const cleur = {
  enabled: !NODE_DISABLE_COLORS && TERM !== 'dumb' && FORCE_COLOR !== '0',

  // modifiers
  reset: init(0, 0),
  bold: init(1, 22),
  dim: init(2, 22),
  italic: init(3, 23),
  underline: init(4, 24),
  inverse: init(7, 27),
  hidden: init(8, 28),
  strikethrough: init(9, 29),

  // colors
  black: init(30, 39),
  red: init(31, 39),
  green: init(32, 39),
  yellow: init(33, 39),
  blue: init(34, 39),
  magenta: init(35, 39),
  cyan: init(36, 39),
  white: init(37, 39),
  gray: init(90, 39),
  grey: init(90, 39),

  // Bright color
  blackBright: init(90, 39),
  redBright: init(91, 39),
  greenBright: init(92, 39),
  yellowBright: init(93, 39),
  blueBright: init(94, 39),
  magentaBright: init(95, 39),
  cyanBright: init(96, 39),
  whiteBright: init(97, 3),

  // background colors
  bgBlack: init(40, 49),
  bgRed: init(41, 49),
  bgGreen: init(42, 49),
  bgYellow: init(43, 49),
  bgBlue: init(44, 49),
  bgMagenta: init(45, 49),
  bgCyan: init(46, 49),
  bgWhite: init(47, 49),
}

function run(arr, str) {
  let i = 0,
    tmp,
    beg = '',
    end = ''
  for (; i < arr.length; i++) {
    tmp = arr[i]
    beg += tmp.open
    end += tmp.close
    if (str.includes(tmp.close)) {
      str = str.replace(tmp.rgx, tmp.close + tmp.open)
    }
  }
  return beg + str + end
}

function chain(has, keys) {
  let ctx: any = { has, keys }

  ctx.reset = cleur.reset.bind(ctx)
  ctx.bold = cleur.bold.bind(ctx)
  ctx.dim = cleur.dim.bind(ctx)
  ctx.italic = cleur.italic.bind(ctx)
  ctx.underline = cleur.underline.bind(ctx)
  ctx.inverse = cleur.inverse.bind(ctx)
  ctx.hidden = cleur.hidden.bind(ctx)
  ctx.strikethrough = cleur.strikethrough.bind(ctx)

  ctx.black = cleur.black.bind(ctx)
  ctx.red = cleur.red.bind(ctx)
  ctx.green = cleur.green.bind(ctx)
  ctx.yellow = cleur.yellow.bind(ctx)
  ctx.blue = cleur.blue.bind(ctx)
  ctx.magenta = cleur.magenta.bind(ctx)
  ctx.cyan = cleur.cyan.bind(ctx)
  ctx.white = cleur.white.bind(ctx)
  ctx.gray = cleur.gray.bind(ctx)
  ctx.grey = cleur.grey.bind(ctx)

  // Bright color
  ctx.blackBright = cleur.blackBright.bind(ctx)
  ctx.redBright = cleur.redBright.bind(ctx)
  ctx.greenBright = cleur.greenBright.bind(ctx)
  ctx.yellowBright = cleur.yellowBright.bind(ctx)
  ctx.blueBright = cleur.blueBright.bind(ctx)
  ctx.magentaBright = cleur.magentaBright.bind(ctx)
  ctx.cyanBright = cleur.cyanBright.bind(ctx)
  ctx.whiteBright = cleur.whiteBright.bind(ctx)

  ctx.bgBlack = cleur.bgBlack.bind(ctx)
  ctx.bgRed = cleur.bgRed.bind(ctx)
  ctx.bgGreen = cleur.bgGreen.bind(ctx)
  ctx.bgYellow = cleur.bgYellow.bind(ctx)
  ctx.bgBlue = cleur.bgBlue.bind(ctx)
  ctx.bgMagenta = cleur.bgMagenta.bind(ctx)
  ctx.bgCyan = cleur.bgCyan.bind(ctx)
  ctx.bgWhite = cleur.bgWhite.bind(ctx)

  return ctx
}

function init(open, close) {
  let blk = {
    open: `\x1b[${open}m`,
    close: `\x1b[${close}m`,
    rgx: new RegExp(`\\x1b\\[${close}m`, 'g'),
  }
  return function(this: any, txt?: any) {
    if (this !== void 0 && this.has !== void 0) {
      this.has.includes(open) || (this.has.push(open), this.keys.push(blk))
      return txt === void 0
        ? this
        : cleur.enabled
        ? run(this.keys, txt + '')
        : txt + ''
    }
    return txt === void 0
      ? chain([open], [blk])
      : cleur.enabled
      ? run([blk], txt + '')
      : txt + ''
  }
}

export default cleur
