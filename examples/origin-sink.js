const { Origin, Sink, storage } = require('../')
const pump = require('pump')
const path = require('path')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const fs = require('fs')

const source = path.resolve(__dirname, 'video.mp4')
const destination = path.resolve(__dirname, 'copy.mp4')
const origin = new Origin(ram)

origin.ready(() => {
  const input = origin.createWriteStream()
  const video = fs.createReadStream(source, { highWaterMark: 1024 })
  const sink = new Sink(storage.sink(destination), origin.key, {
    encryptionKey: origin.encryptionKey,
    nonce: origin.nonce
  })

  pump(video, input, (err) => {
    sink.on('sync', ()=> {
      if (sink.byteLength === origin.byteLength) {
        console.log('sync')
        sink.close()
        origin.close()
        process.nextTick(process.exit)
      }
    })
  })
})
