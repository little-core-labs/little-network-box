const { Server, Client, Source, Sink } = require('../')
const path = require('path')
const ram = require('random-access-memory')

const files = [
  'https://raw.githubusercontent.com/jwerle/little-box/master/package.json',
  __filename,
  path.resolve('video.mp4'),
  path.resolve('copy.mp4'),
]

const server = new Server()
const client = new Client(server.key)
const sources = files.map((uri) => new Source(ram, { uri,
  network: server.network
}))

let pending = 0
for (const source of sources) {
  console.log('pending', source.uri);
  pending++
  source.ready(() => {
    const destination = path.resolve(__dirname, path.basename(source.uri) + '-copy')
    const sink = new Sink(destination, source.key, {
      network: client.network,
      encryptionKey: source.encryptionKey,
      nonce: source.nonce
    })

    sink.on('sync', () => {
      console.log('sync', source.uri);
      source.close()
      sink.close()
      if (0 == --pending) {
        client.close()
        server.close()
        process.nextTick(process.exit)
      }
    })
  })
}
