const { Source, Sink } = require('../')
const pump = require('pump')
const path = require('path')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const fs = require('fs')

const uri = path.resolve(__dirname, 'video.mp4')

const destination = path.resolve(__dirname, 'copy.mp4')
const source = new Source(ram, { uri })
source.ready(() => {
  const sink = new Sink(destination, source.key, {
    encryptionKey: source.encryptionKey,
    nonce: source.nonce
  })

  sink.on('sync', () => {
    if (sink.byteLength === source.byteLength) {
      sink.close()
      source.close()
      process.nextTick(process.exit)
    }
  })
})

