'use strict'

import { FieldRefImpl } from '../core/model/FieldRef'
import { ObjectEnumValue } from '../object-enums'
import { lowerCase } from './common'

const isRegexp = require('is-regexp')
const isObj = require('is-obj')
const getOwnEnumPropSymbols = require('get-own-enumerable-property-symbols').default

// Fork of https://github.com/yeoman/stringify-object/blob/master/index.js
// with possibility to overwrite the whole key-value pair (options.transformLine)

const stringifyObject = (input, options?: any, pad?: any) => {
  const seen: any[] = []

  return (function stringifyObject(input, options = {}, pad = '', path = []) {
    options.indent = options.indent || '\t'

    let tokens

    if (options.inlineCharacterLimit === undefined) {
      tokens = {
        newLine: '\n',
        newLineOrSpace: '\n',
        pad,
        indent: pad + options.indent,
      }
    } else {
      tokens = {
        newLine: '@@__STRINGIFY_OBJECT_NEW_LINE__@@',
        newLineOrSpace: '@@__STRINGIFY_OBJECT_NEW_LINE_OR_SPACE__@@',
        pad: '@@__STRINGIFY_OBJECT_PAD__@@',
        indent: '@@__STRINGIFY_OBJECT_INDENT__@@',
      }
    }

    const expandWhiteSpace = (string) => {
      if (options.inlineCharacterLimit === undefined) {
        return string
      }

      const oneLined = string
        .replace(new RegExp(tokens.newLine, 'g'), '')
        .replace(new RegExp(tokens.newLineOrSpace, 'g'), ' ')
        .replace(new RegExp(tokens.pad + '|' + tokens.indent, 'g'), '')

      if (oneLined.length <= options.inlineCharacterLimit) {
        return oneLined
      }

      return string
        .replace(new RegExp(tokens.newLine + '|' + tokens.newLineOrSpace, 'g'), '\n')
        .replace(new RegExp(tokens.pad, 'g'), pad)
        .replace(new RegExp(tokens.indent, 'g'), pad + options.indent)
    }

    if (seen.indexOf(input) !== -1) {
      return '"[Circular]"'
    }

    if (Buffer.isBuffer(input)) {
      return `Buffer(${Buffer.length})`
    }

    if (
      input === null ||
      input === undefined ||
      typeof input === 'number' ||
      typeof input === 'boolean' ||
      typeof input === 'function' ||
      typeof input === 'symbol' ||
      input instanceof ObjectEnumValue ||
      isRegexp(input)
    ) {
      return String(input)
    }

    if (input instanceof Date) {
      return `new Date('${input.toISOString()}')`
    }

    if (input instanceof FieldRefImpl) {
      return `prisma.${lowerCase(input.modelName)}.fields.${input.name}`
    }

    if (Array.isArray(input)) {
      if (input.length === 0) {
        return '[]'
      }

      seen.push(input)

      const ret =
        '[' +
        tokens.newLine +
        input
          .map((el, i) => {
            const eol = input.length - 1 === i ? tokens.newLine : ',' + tokens.newLineOrSpace

            let value = stringifyObject(el, options, pad + options.indent, [...path, i] as any)
            if (options.transformValue) {
              value = options.transformValue(input, i, value)
            }

            return tokens.indent + value + eol
          })
          .join('') +
        tokens.pad +
        ']'

      seen.pop()

      return expandWhiteSpace(ret)
    }

    if (isObj(input)) {
      let objKeys = Object.keys(input).concat(getOwnEnumPropSymbols(input))

      if (options.filter) {
        objKeys = objKeys.filter((el) => options.filter(input, el))
      }

      if (objKeys.length === 0) {
        return '{}'
      }

      seen.push(input)

      const ret =
        '{' +
        tokens.newLine +
        objKeys
          .map((el, i) => {
            const eol = objKeys.length - 1 === i ? tokens.newLine : ',' + tokens.newLineOrSpace
            const isSymbol = typeof el === 'symbol'
            const isClassic = !isSymbol && /^[a-z$_][a-z$_0-9]*$/i.test(el)
            const key = isSymbol || isClassic ? el : stringifyObject(el, options, undefined, [...path, el] as any)

            let value = stringifyObject(input[el], options, pad + options.indent, [...path, el] as any)
            if (options.transformValue) {
              value = options.transformValue(input, el, value)
            }

            let line = tokens.indent + String(key) + ': ' + value + eol

            if (options.transformLine) {
              line = options.transformLine({
                obj: input,
                indent: tokens.indent,
                key,
                stringifiedValue: value,
                value: input[el],
                eol,
                originalLine: line,
                path: path.concat(key),
              })
            }

            return line
          })
          .join('') +
        tokens.pad +
        '}'

      seen.pop()

      return expandWhiteSpace(ret)
    }

    input = String(input).replace(/[\r\n]/g, (x) => (x === '\n' ? '\\n' : '\\r'))

    if (options.singleQuotes === false) {
      input = input.replace(/"/g, '\\"')
      return `"${input}"`
    }

    input = input.replace(/\\?'/g, "\\'")
    return `'${input}'`
  })(input, options, pad)
}

export default stringifyObject
