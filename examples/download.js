const { Sink } = require('../')
const Progress = require('progress')
const assert = require('assert')
const path = require('path')
const raf = require('random-access-file')
const fs = require('fs')

assert(4 === process.argv.length, 'usage: node download.js <key> <output>')

const key = process.argv[2]
const destination = path.resolve(process.argv[3])

const sink = new Sink(destination, key)
const now = Date.now()

sink.update(() => {
  const progress = new Progress('> downloading [:bar] :rate/bps :percent :etas', {
    complete: '#',
    incomplete: '-',
    width: 20,
    total: sink.length
  })

  console.log('> starting download... [%d blocks]',
    sink.length - sink.downloaded())

  progress.tick(sink.downloaded())
  sink.on('download', () => {
    progress.tick()
  })
  sink.network.on('connection', () => {
  })
})

sink.on('sync', () => {
  const delta = (Date.now() - now) / 1000
  console.log('> done! [in %d seconds]', delta.toPrecision(2))
  sink.close()
  process.nextTick(process.exit)
})
