import { docComment } from './DocComment'
import { stringify } from './stringify'

test('empty', () => {
  expect(stringify(docComment())).toMatchInlineSnapshot(`
    /**
     */

  `)
})

test('one line', () => {
  expect(stringify(docComment('I am comment'))).toMatchInlineSnapshot(`
    /**
     * I am comment
     */

  `)
})

test('multiline', () => {
  expect(stringify(docComment('first\nsecond'))).toMatchInlineSnapshot(`
    /**
     * first
     * second
     */

  `)
})

test('multiple addText calls', () => {
  const comment = docComment('Line 1').addText('Line 2').addText('Line 3')
  expect(stringify(comment)).toMatchInlineSnapshot(`
    /**
     * Line 1
     * Line 2
     * Line 3
     */

  `)
})

test('tagged template - empty', () => {
  expect(stringify(docComment``)).toMatchInlineSnapshot(`
    /**
     */

  `)
})

test('tagged template - spaces only', () => {
  expect(stringify(docComment`    `)).toMatchInlineSnapshot(`
    /**
     */

  `)
})

test('tagged template - with content', () => {
  const comment = docComment`
        This is a multiline comment
           - this line should be indented
        And this should be not
    `

  expect(stringify(comment)).toMatchInlineSnapshot(`
    /**
     * This is a multiline comment
     *    - this line should be indented
     * And this should be not
     */

  `)
})
