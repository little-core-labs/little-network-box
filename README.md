little-box
==========

> A little toolkit for distributed applications based on
> [Hypercore][hypercore].

## Installation

```sh
$ npm install jwerle/little-box # from github for now
```

## Status

> WIP

## Example

```js
const { Origin, Sink, storage } = require('little-box')
const pump = require('pump')
const path = require('path')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const fs = require('fs')

const video = path.resolve(__dirname, 'video.mp4')
const copy = path.resolve(__dirname, 'copy.mp4')
const origin = new Origin(ram)

origin.ready(() => {
  const input = origin.createWriteStream()
  const video = fs.createReadStream(video, { highWaterMark: 1024 })
  const sink = new Sink(storage.sink(copy), origin.key, {
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
```

## API

Below is the documentation for the modules, classes, functions, and
constants `little-box` exports publically.

### `Box(storage, key, options)`

The `Box` class represents a container for a hypercore feed
and related feeds managed by a `Corestore` instance. This class
serves as the base class for the various classes exported by
`little-box`.

```js
const { Box, codecs, hooks } = require('little-box')
const ready = require('hypercore-ready')

const nonce = crypto.randomBytes(24)
const box = new Box('./path/to/box', {
  nonce, codec: codecs.xsalsa20
})

box.ready(() => {
  const vault = new Box('./path/to/secure/vault', box.key)
  const message = Buffer.from('hello')
  const unboxed = new Box('./path/to/unboxed', {
    nonce, hooks: [ hooks.xsalsa20 ]
  })

  box.append(message, () => {
    box.head(console.log) // hello
  })

  box.update(() => {
    ready(vault, unbox, () => {
      replicate(box, vault, () => {
        vault.head(console.log) // <ciphertext>
        replicate(vault, unbox, () => {
          unbox.head(console.log) // hello
        })
      })
    })
  })
})
```

### `Node(storage, key, options)`

> TBA

### `Edge(storage, key, options)`

> TBA

### `Origin(storage, key, options)`

> TBA

### `Reader(storage, key, options)`

> TBA

### `Receive(storage, key, options)`

> TBA

### `Send(storage, key, options)`

> TBA

### `Network(opts)`

> TBA

### `replicate(...boxes[, options[, callback]])`

> TBA

### `codecs`

> TBA

#### `codecs.xsalsa20`

> TBA

### `hooks`

> TBA

#### `hooks.xsalsa20`

> TBA

### `storage`

> TBA

#### `storage.sink`

> TBA


## License

MIT

[hypercore]: https://github.com/mafintosh/hypercore
