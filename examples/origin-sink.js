const { Origin, Sink, storage } = require('../')
const pump = require('pump')
const path = require('path')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const fs = require('fs')

const nonces = ram()
const source = path.resolve(__dirname, 'video.mp4')
const destination = path.resolve(__dirname, 'copy.mp4')
const origin = new Origin(ram, { nonces })

origin.ready(() => {
  const input = origin.createWriteStream()
  const video = fs.createReadStream(source)
  const sink = new Sink(destination, origin.key, {
    encryptionKey: origin.encryptionKey,
    nonces: origin.nonces
  })

  pump(video, input, (err) => {
    sink.on('sync', ()=> {
      if (sink.byteLength === origin.byteLength) {
        sink.close()
        origin.close()
        process.nextTick(process.exit)
      }
    })
  })
})
