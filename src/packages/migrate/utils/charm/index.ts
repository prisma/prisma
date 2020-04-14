var tty = require('tty')
import { encode } from './lib/encode'
var Stream = require('stream').Stream
var inherits = require('inherits')

inherits(Charm, Stream)

export default function charm() {
  var input: any = null
  function setInput(s) {
    if (input) throw new Error('multiple inputs specified')
    else input = s
  }

  var output = null
  function setOutput(s) {
    if (output) throw new Error('multiple outputs specified')
    else output = s
  }

  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i]
    if (!arg) continue
    if (arg.readable) setInput(arg)
    else if (arg.stdin || arg.input) setInput(arg.stdin || arg.input)

    if (arg.writable) setOutput(arg)
    else if (arg.stdout || arg.output) setOutput(arg.stdout || arg.output)
  }

  if (input && typeof input.fd === 'number' && tty.isatty(input.fd)) {
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true)
    } else tty.setRawMode(true)
  }

  var charm = new Charm()
  if (input) {
    input.pipe(charm)
  }

  if (output) {
    charm.pipe(output)
  }

  charm.once('^C', process.exit)
  charm.once('end', function() {
    if (input) {
      if (typeof input.fd === 'number' && tty.isatty(input.fd)) {
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false)
        } else tty.setRawMode(false)
      }
      input.destroy()
    }
  })

  return charm
}

export function Charm(this: any) {
  this.writable = true
  this.readable = true
  this.pending = []
}

Charm.prototype.write = function(buf) {
  var self = this

  if (self.pending.length) {
    var codes = extractCodes(buf)
    var matched = false

    for (var i = 0; i < codes.length; i++) {
      for (var j = 0; j < self.pending.length; j++) {
        var cb = self.pending[j]
        if (cb(codes[i])) {
          matched = true
          self.pending.splice(j, 1)
          break
        }
      }
    }

    if (matched) return
  }

  if (buf.length === 1) {
    if (buf[0] === 3) self.emit('^C')
    if (buf[0] === 4) self.emit('^D')
  }

  self.emit('data', buf)

  return self
}

Charm.prototype.destroy = function() {
  this.end()
}

Charm.prototype.end = function(buf) {
  if (buf) this.write(buf)
  this.emit('end')
}

Charm.prototype.reset = function(cb) {
  // resets the screen on iTerm, which appears
  // to lack support for the reset character.
  this.write(encode('[0m'))
  this.write(encode('[2J'))

  this.write(encode('c'))
  return this
}

Charm.prototype.position = function(x, y) {
  // get/set absolute coordinates
  if (typeof x === 'function') {
    var cb = x
    this.pending.push(function(buf) {
      if (
        buf[0] === 27 &&
        buf[1] === encode.ord('[') &&
        buf[buf.length - 1] === encode.ord('R')
      ) {
        var pos = buf
          .toString()
          .slice(2, -1)
          .split(';')
          .map(Number)
        cb(pos[1], pos[0])
        return true
      }
    })
    this.write(encode('[6n'))
  } else {
    this.write(encode('[' + Math.floor(y) + ';' + Math.floor(x) + 'f'))
  }
  return this
}

Charm.prototype.move = function(x, y) {
  // set relative coordinates
  var bufs = []

  if (y < 0) this.up(-y)
  else if (y > 0) this.down(y)

  if (x > 0) this.right(x)
  else if (x < 0) this.left(-x)

  return this
}

Charm.prototype.up = function(y) {
  if (y === undefined) y = 1
  this.write(encode('[' + Math.floor(y) + 'A'))
  return this
}

Charm.prototype.down = function(y) {
  if (y === undefined) y = 1
  this.write(encode('[' + Math.floor(y) + 'B'))
  return this
}

Charm.prototype.right = function(x) {
  if (x === undefined) x = 1
  this.write(encode('[' + Math.floor(x) + 'C'))
  return this
}

Charm.prototype.left = function(x) {
  if (x === undefined) x = 1
  this.write(encode('[' + Math.floor(x) + 'D'))
  return this
}

Charm.prototype.column = function(x) {
  this.write(encode('[' + Math.floor(x) + 'G'))
  return this
}

Charm.prototype.push = function(withAttributes) {
  this.write(encode(withAttributes ? '7' : '[s'))
  return this
}

Charm.prototype.pop = function(withAttributes) {
  this.write(encode(withAttributes ? '8' : '[u'))
  return this
}

Charm.prototype.erase = function(s) {
  if (s === 'end' || s === '$') {
    this.write(encode('[K'))
  } else if (s === 'start' || s === '^') {
    this.write(encode('[1K'))
  } else if (s === 'line') {
    this.write(encode('[2K'))
  } else if (s === 'down') {
    this.write(encode('[J'))
  } else if (s === 'up') {
    this.write(encode('[1J'))
  } else if (s === 'screen') {
    this.write(encode('[1J'))
  } else {
    this.emit('error', new Error('Unknown erase type: ' + s))
  }
  return this
}

Charm.prototype.delete = function(s, n) {
  n = n || 1

  if (s === 'line') {
    this.write(encode('[' + n + 'M'))
  } else if (s === 'char') {
    this.write(encode('[' + n + 'M'))
  } else {
    this.emit('error', new Error('Unknown delete type: ' + s))
  }
  return this
}

Charm.prototype.insert = function(mode, n) {
  n = n || 1

  if (mode === true) {
    this.write(encode('[4h'))
  } else if (mode === false) {
    this.write(encode('[l'))
  } else if (mode === 'line') {
    this.write(encode('[' + n + 'L'))
  } else if (mode === 'char') {
    this.write(encode('[' + n + '@'))
  } else {
    this.emit('error', new Error('Unknown delete type: '))
  }
  return this
}

Charm.prototype.display = function(attr) {
  var c = {
    reset: 0,
    bright: 1,
    dim: 2,
    underscore: 4,
    blink: 5,
    reverse: 7,
    hidden: 8,
  }[attr]
  if (c === undefined) {
    this.emit('error', new Error('Unknown attribute: ' + attr))
  }
  this.write(encode('[' + c + 'm'))
  return this
}

Charm.prototype.foreground = function(color) {
  if (typeof color === 'number') {
    if (color < 0 || color >= 256) {
      this.emit('error', new Error('Color out of range: ' + color))
    }
    this.write(encode('[38;5;' + color + 'm'))
  } else {
    var c = {
      black: 30,
      red: 31,
      green: 32,
      yellow: 33,
      blue: 34,
      magenta: 35,
      cyan: 36,
      white: 37,
    }[color.toLowerCase()]

    if (!c) this.emit('error', new Error('Unknown color: ' + color))
    this.write(encode('[' + c + 'm'))
  }
  return this
}

Charm.prototype.background = function(color) {
  if (typeof color === 'number') {
    if (color < 0 || color >= 256) {
      this.emit('error', new Error('Color out of range: ' + color))
    }
    this.write(encode('[48;5;' + color + 'm'))
  } else {
    var c = {
      black: 40,
      red: 41,
      green: 42,
      yellow: 43,
      blue: 44,
      magenta: 45,
      cyan: 46,
      white: 47,
    }[color.toLowerCase()]

    if (!c) this.emit('error', new Error('Unknown color: ' + color))
    this.write(encode('[' + c + 'm'))
  }
  return this
}

Charm.prototype.cursor = function(visible) {
  this.write(encode(visible ? '[?25h' : '[?25l'))
  return this
}

var extractCodes = (exports.extractCodes = function(buf) {
  var codes: any[] = []
  var start = -1

  for (var i = 0; i < buf.length; i++) {
    if (buf[i] === 27) {
      if (start >= 0) codes.push(buf.slice(start, i))
      start = i
    } else if (start >= 0 && i === buf.length - 1) {
      codes.push(buf.slice(start))
    }
  }

  return codes
})
