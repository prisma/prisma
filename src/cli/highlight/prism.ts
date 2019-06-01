import { theme, identity } from './theme'

/* **********************************************
     Begin prism-core.js
********************************************** */

var _self: any = {}

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

// Private helper vars
var uniqueId = 0

export var Prism = {
  manual: _self.Prism && _self.Prism.manual,
  disableWorkerMessageHandler:
    _self.Prism && _self.Prism.disableWorkerMessageHandler,
  util: {
    encode: function(tokens: any) {
      if (tokens instanceof Token) {
        const anyTokens: any = tokens
        return new Token(
          anyTokens.type,
          Prism.util.encode(anyTokens.content),
          anyTokens.alias,
        )
      } else if (Array.isArray(tokens)) {
        return tokens.map(Prism.util.encode)
      } else {
        return tokens
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/\u00a0/g, ' ')
      }
    },

    type: function(o) {
      return Object.prototype.toString.call(o).slice(8, -1)
    },

    objId: function(obj) {
      if (!obj['__id']) {
        Object.defineProperty(obj, '__id', { value: ++uniqueId })
      }
      return obj['__id']
    },

    // Deep clone a language definition (e.g. to extend it)
    clone: function deepClone(o, visited?: any) {
      var clone,
        id,
        type = Prism.util.type(o)
      visited = visited || {}

      switch (type) {
        case 'Object':
          id = Prism.util.objId(o)
          if (visited[id]) {
            return visited[id]
          }
          clone = {}
          visited[id] = clone

          for (var key in o) {
            if (o.hasOwnProperty(key)) {
              clone[key] = deepClone(o[key], visited)
            }
          }

          return clone

        case 'Array':
          id = Prism.util.objId(o)
          if (visited[id]) {
            return visited[id]
          }
          clone = []
          visited[id] = clone

          o.forEach(function(v, i) {
            clone[i] = deepClone(v, visited)
          })

          return clone

        default:
          return o
      }
    },
  },

  languages: {
    extend: function(id, redef) {
      var lang = Prism.util.clone(Prism.languages[id])

      for (var key in redef) {
        lang[key] = redef[key]
      }

      return lang
    },

    /**
     * Insert a token before another token in a language literal
     * As this needs to recreate the object (we cannot actually insert before keys in object literals),
     * we cannot just provide an object, we need an object and a key.
     * @param inside The key (or language id) of the parent
     * @param before The key to insert before.
     * @param insert Object with the key/value pairs to insert
     * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
     */
    insertBefore: function(inside, before, insert, root) {
      root = root || Prism.languages
      var grammar = root[inside]
      var ret = {}

      for (var token in grammar) {
        if (grammar.hasOwnProperty(token)) {
          if (token == before) {
            for (var newToken in insert) {
              if (insert.hasOwnProperty(newToken)) {
                ret[newToken] = insert[newToken]
              }
            }
          }

          // Do not insert token which also occur in insert. See #1525
          if (!insert.hasOwnProperty(token)) {
            ret[token] = grammar[token]
          }
        }
      }

      var old = root[inside]
      root[inside] = ret

      // Update references in other language definitions
      Prism.languages.DFS(Prism.languages, function(this: any, key, value) {
        if (value === old && key != inside) {
          this[key] = ret
        }
      })

      return ret
    },

    // Traverse a language definition with Depth First Search
    DFS: function DFS(o, callback, type?: any, visited?: any) {
      visited = visited || {}

      var objId = Prism.util.objId

      for (var i in o) {
        if (o.hasOwnProperty(i)) {
          callback.call(o, i, o[i], type || i)

          var property = o[i],
            propertyType = Prism.util.type(property)

          if (propertyType === 'Object' && !visited[objId(property)]) {
            visited[objId(property)] = true
            DFS(property, callback, null, visited)
          } else if (propertyType === 'Array' && !visited[objId(property)]) {
            visited[objId(property)] = true
            DFS(property, callback, i, visited)
          }
        }
      }
    },
  },
  plugins: {},

  highlight: function(text, grammar, language) {
    var env: any = {
      code: text,
      grammar: grammar,
      language: language,
    }
    Prism.hooks.run('before-tokenize', env)
    env.tokens = Prism.tokenize(env.code, env.grammar)
    Prism.hooks.run('after-tokenize', env)
    return Token.stringify(Prism.util.encode(env.tokens), env.language)
  },

  matchGrammar: function(
    text,
    strarr,
    grammar,
    index,
    startPos,
    oneshot,
    target?: any,
  ) {
    for (var token in grammar) {
      if (!grammar.hasOwnProperty(token) || !grammar[token]) {
        continue
      }

      if (token == target) {
        return
      }

      var patterns = grammar[token]
      patterns = Prism.util.type(patterns) === 'Array' ? patterns : [patterns]

      for (var j = 0; j < patterns.length; ++j) {
        var pattern = patterns[j],
          inside = pattern.inside,
          lookbehind = !!pattern.lookbehind,
          greedy = !!pattern.greedy,
          lookbehindLength = 0,
          alias = pattern.alias

        if (greedy && !pattern.pattern.global) {
          // Without the global flag, lastIndex won't work
          var flags = pattern.pattern.toString().match(/[imuy]*$/)[0]
          pattern.pattern = RegExp(pattern.pattern.source, flags + 'g')
        }

        pattern = pattern.pattern || pattern

        // Don’t cache length as it changes during the loop
        for (
          var i = index, pos = startPos;
          i < strarr.length;
          pos += strarr[i].length, ++i
        ) {
          var str = strarr[i]

          if (strarr.length > text.length) {
            // Something went terribly wrong, ABORT, ABORT!
            return
          }

          if (str instanceof Token) {
            continue
          }

          if (greedy && i != strarr.length - 1) {
            pattern.lastIndex = pos
            var match = pattern.exec(text)
            if (!match) {
              break
            }

            var from = match.index + (lookbehind ? match[1].length : 0),
              to = match.index + match[0].length,
              k = i,
              p = pos

            for (
              var len = strarr.length;
              k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy));
              ++k
            ) {
              p += strarr[k].length
              // Move the index i to the element in strarr that is closest to from
              if (from >= p) {
                ++i
                pos = p
              }
            }

            // If strarr[i] is a Token, then the match starts inside another Token, which is invalid
            if (strarr[i] instanceof Token) {
              continue
            }

            // Number of tokens to delete and replace with the new match
            delNum = k - i
            str = text.slice(pos, p)
            match.index -= pos
          } else {
            pattern.lastIndex = 0

            var match = pattern.exec(str),
              delNum = 1
          }

          if (!match) {
            if (oneshot) {
              break
            }

            continue
          }

          if (lookbehind) {
            lookbehindLength = match[1] ? match[1].length : 0
          }

          var from = match.index + lookbehindLength,
            match = match[0].slice(lookbehindLength),
            to = from + match.length,
            before = str.slice(0, from),
            after = str.slice(to)

          var args: any = [i, delNum]

          if (before) {
            ++i
            pos += before.length
            args.push(before)
          }

          var wrapped = new Token(
            token,
            inside ? Prism.tokenize(match, inside) : match,
            alias,
            match,
            greedy,
          )

          args.push(wrapped)

          if (after) {
            args.push(after)
          }

          Array.prototype.splice.apply(strarr, args)

          if (delNum != 1)
            Prism.matchGrammar(text, strarr, grammar, i, pos, true, token)

          if (oneshot) break
        }
      }
    }
  },

  tokenize: function(text, grammar) {
    var strarr = [text]

    var rest = grammar.rest

    if (rest) {
      for (var token in rest) {
        grammar[token] = rest[token]
      }

      delete grammar.rest
    }

    Prism.matchGrammar(text, strarr, grammar, 0, 0, false)

    return strarr
  },

  hooks: {
    all: {},

    add: function(name, callback) {
      var hooks = Prism.hooks.all

      hooks[name] = hooks[name] || []

      hooks[name].push(callback)
    },

    run: function(name, env) {
      var callbacks = Prism.hooks.all[name]

      if (!callbacks || !callbacks.length) {
        return
      }

      for (var i = 0, callback; (callback = callbacks[i++]); ) {
        callback(env)
      }
    },
  },

  Token: Token,
}

export function Token(
  this: any,
  type,
  content,
  alias,
  matchedStr?: any,
  greedy?: any,
) {
  this.type = type
  this.content = content
  this.alias = alias
  // Copy of the full string this token was created from
  this.length = (matchedStr || '').length | 0
  this.greedy = !!greedy
}

Token.stringify = function(o, language?: any) {
  if (typeof o == 'string') {
    return o
  }

  if (Array.isArray(o)) {
    return o
      .map(function(element) {
        return Token.stringify(element, language)
      })
      .join('')
  }

  return getColorForSyntaxKind(o.type)(o.content)
}

function getColorForSyntaxKind(syntaxKind: string) {
  return theme[syntaxKind] || identity
}
