little-network-box
==================

> A little toolkit for distributed applications based on
> [Hypercore][hypercore] and [Hyperswarm][hyperswarm]

## Installation

```sh
$ npm install little-network-box # from github for now
```

## Status

> WIP

## Example

```js
const { Origin, Sink, storage } = require('little-network-box')
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
constants `little-network-box` exports publically.

### `const box = new Box(storage, key, options)`

The `Box` class represents a container for a Hypercore feed. Extending
classes are provided life cycle callback by implementing various
`Box` symbol methods like `Box.codec`, `Box.storage`, and more to customize
the configuration, initialization, and encryption of the Hypercore feed.

#### Usage

```js
const box = new Box(storage[, key[, options]])
```

Where `storage` is a [random-access-storage][random-access-storage]
factory function, `key` is an optional [Hypercore public
keey](https://github.com/mafintosh/hypercore/#feedkey), and `options` is
an object that is passed directly to the [Hypercore
constructor](https://github.com/mafintosh/hypercore/#var-feed--hypercorestorage-key-options)
and made available to various Symbol methods like `Box.options`,
`Box.init`, and more.

#### `box.key`

Read only accessor for the Hypercore feed's public key.

#### `box.secretKey`

Read only accessor for the Hypercore feed's secret key.

#### `box.discoveryKey`

Read only accessor for the Hypercore feed's discovery key.

#### `box.stats`

Read only accessor for the Hypercore feed's stats object.

#### `box.extensions`

Read only accessor for the Hypercore feed's extensions array.

#### `box.live`

Read only accessor for the Hypercore feeds' live state.

#### `box.sparse`

Read only accessor for the Hypercore feeds' sparse state.

#### `box.readable`

Read only accessor for the Hypercore feeds' readable state.

#### `box.writable`

Read only accessor for the Hypercore feeds' writable state.

#### `box.opened`

Read only accessor for the Hypercore feeds' opened state.

#### `box.closed`

Read only accessor for the Hypercore feeds' closed state.

#### `box.length`

Read only accessor for the Hypercore feeds' length.

#### `box.byteLength`

Read only accessor for the Hypercore feeds' byte length.

#### `box.origin`

Read only accessor for the Box's origin state.

### `const options = Box.defaults(defaults, ...overrides)`

Creates an options object that can be passed to the `Box` constructor.

##### Usage

```js
const options = Box.defaults(defaults, ...overrides)
```

Where default options described by the `Box` class can be overloaded by a
given `defaults` object and subsequently with any number of override
objects passed in as _rest arguments_ `...overrides`.

### `Box.options`

Classes who extend the `Box` class who are interested in extending
constructor options should implement this Symbol method.

```js
class ExtendedBox extends Box {
  [Box.options](options) {
    // modify `options`
  }
}
```

### `Box.init`

Classes who extend the `Box` class who are interested in initializing objects
with the `options` passed into the constructor should implement this
Symbol method.

```js
const hyperswarm require('hyperswarm')
const ram = require('random-access-memory'

class ExtendedBox extends Box {
  [Box.init](options) {
    this.swarm = hyperswarm(options.swarm)
  }
}

const box = new ExtendedBox(ram, {
  swarm: { ephemeral: false }
})

box.ready(() => {
  box.swarm.join(box.discoveryKey)
})
```

### `Box.codec`

Classes who extend the `Box` class who are interested in providing a
codec for the Hypercore's `valueEncoding` property should implement this
Symbol method.

```js
const encoding = require('buffer-json-encoding')

class ExtendedBox extends Box {
  [Box.codec](opts) {
    return encoding
  }
}
```

### `Box.open`
### `Box.close`
### `Box.write`
### `Box.ready`
### `Box.storage`
### `Box.origin`
### `Box.hypercore`

## License

MIT

[hypercore]: https://github.com/mafintosh/hypercore
[hyperswarm]: https://github.com/hyperswarm/hyperswarm
[random-access-storage]: https://github.com/random-access-storage/random-access-storage
