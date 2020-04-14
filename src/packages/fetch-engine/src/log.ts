import Progress from 'progress'

export function getBar(text): Progress {
  return new Progress(`> ${text} [:bar] :percent`, {
    stream: process.stdout,
    width: 20,
    complete: '=',
    incomplete: ' ',
    total: 100,
    head: '',
    clear: true,
  })
}
