import leven from 'js-levenshtein'

console.log(leven('first', 'first'), leven('first', 'mirst'), leven('first', 'asd'), leven('flase', 'false'))
