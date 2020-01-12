const { Origin, Sink, Edge } = require('../')
const replicate = require('hypercore-replicate')
const pump = require('pump')
const path = require('path')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const fs = require('fs')

const nonces = ram()
const source = path.resolve(__dirname, 'video.mp4')
const proxy = path.resolve(__dirname, 'edge.mp4')
const destination = path.resolve(__dirname, 'copy.mp4')
const origin = new Origin(ram, { nonces, network: false })

origin.ready(() => {
  const input = origin.createWriteStream()
  const video = fs.createReadStream(source)
  const sink = new Sink(destination, origin.key, {
    encryptionKey: origin.encryptionKey,
    nonces: origin.nonces
  })

  pump(video, input, (err) => {
    if (err) { throw err }
    const edge = new Edge((filename) =>
      'data' !== filename ? ram() : raf(proxy),
      origin.key
    )

    edge.ready(() => {
      replicate(origin, edge, (err) => {
        if (err) { throw err }
      })
    })

    edge.on('sync', onsync)
    sink.on('sync', onsync)

    function onsync() {
      if (
        sink.byteLength === origin.byteLength &&
        edge.byteLength === origin.byteLength
      ) {
        edge.close()
        sink.close()
        origin.close()
        process.nextTick(process.exit)
      }
    }
  })
})
