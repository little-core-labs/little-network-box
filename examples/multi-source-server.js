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

for (const source of sources) {
  source.ready(() => {
    const destination = path.resolve(__dirname, path.basename(source.uri) + '-copy')
    const sink = new Sink(destination, source.key, {
      network: client.network,
      encryptionKey: source.encryptionKey,
      nonce: source.nonce
    })
  })
}
