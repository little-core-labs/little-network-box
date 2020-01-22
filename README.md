little-network-box
==================

> A little toolkit for distributed applications based on
> [Hypercore][hypercore] and [Hyperswarm][hyperswarm]

## Installation

```sh
$ npm install little-network-box # from github for now
```

## Status

[![Actions Status](https://github.com/little-core-labs/little-network-box/workflows/Node%20CI/badge.svg)](https://github.com/little-core-labs/little-network-box/actions)

> **Development/Testing/Documentation**

## Example

```js
const { Origin, Sink } = require('little-network-box')
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

Creates an options object that can be passed to the `Box` constructor
where options can at least be:

```js
{
  storeSecretKey: false,
  live: true,
}
```

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
const ram = require('random-access-memory')

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
const ram = require('random-access-memory')

class ExtendedBox extends Box {
  [Box.codec](opts) {
    return encoding
  }
}

const box = new ExtendedBox(ram)

box.ready(() => {
  box.append({ hello: 'world' }, (err) => {
    box.head(console.log) // { hello: 'world' }
  })
})
```

### `Box.open`

Classes who extend the `Box` class who are interested in opening
resources when the instance is "opening" should implement this Symbol
method.

```js
class ExtendedBox extends Box {
  [Box.open](opts) {
    this.socket = net.connect(opts)
    this.socket.on('connect', () => this.emit('connect', this.socket)
  }
}

const box = new ExtendedBox(ram)
box.on('connect', (socket) => {
  // handle socket connection
})
```

### `Box.close`

Classes who extend the `Box` class who are interested in closing
resources when the instance is "closing" should implement this Symbol
method.

```js
class ExtendedBox extends Box {
  [Box.open](opts) {
    this.socket = net.connect(opts)
    this.socket.on('connect', () => this.emit('connect', this.socket)
  }

  [Box.close](opts) {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
  }
}

const box = new ExtendedBox(ram)
box.on('connect', (socket) => {
  // handle socket connection then close
  box.close()
})
```

### `Box.write`

Classes who extend the `Box` class who are interested in modifying data
as after verification but before being written to storage should
implement this Symbol method.

```js
const replicate = require('little-network-box/replicate')
const encoding = require('xsalsa20-encoding')
const crypto = require('crypto')

const secret = crypto.randomBytes(32)

// encrypts plaintext into ciphertext before writing to storage
class EncryptedBox extends Box {
  [Box.codec](opts) {
    return encoding(opts.secret)
  }
}

const encrypted = new EncryptedBox(ram, { secret })
encrypted.ready(() => {
  const decrypted = new EncryptedBox(ram, { secret })
  encrypted.append(Buffer.from('hello world'))
  replicate(encrypted, decrypted, (err) => {
    decrypted.head(console.log) // hello world
  })
})
```

### `Box.ready`

Classes who extend the `Box` class who are interested in adding work to
the "ready queue" should extend this Symbol method.

```js
// waits for super to be ready, then waits 5000ms before calling
// `done()` signaling that the instance is ready.
class DelayedReadyBox extends Box {
  [Box.ready](opts, done) {
    super[Box.ready](opts, (err) => {
        setTimeout(done, 5000)
    })
  }
}

const box = new DelayedReadyBox(ram)
box.ready(() => {
  // called after 5000ms
})
```

### `Box.storage`

Classes who extend the `Box` class who are interested in providing a
custom [random-access-storage][random-access-storage] interface based on
constructor input should implement this Symbol method.

```js
const pump = require('pump')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const fs = require('fs')

// indexes a file by passing the contents of the file,
// block by block, (fs.createReadStream()) through the hypercore
// feed generating a merkle tree and signed roots.
class IndexedBox extends Box {
  [Box.options](opts) {
    opts.indexing = true
  }

  [Box.init](opts) {
    this.filename = opts.filename
  }

  // treats the file as the data storage
  [Box.storage](storage, opts) {
    return (filename) => {
      if ('data' === filename) {
        return raf(this.filename)
      } else {
        return ram()
      }
    }
  }

  [Box.ready](opts, done) {
    super[Box.ready](opts, (err) => {
      const reader = fs.createReadStream(this.filename)
      const writer = this.createWriteStream()
      pump(reader, writer, done)
    })
  }
}

const indexed = new IndexedBox(ram, { filename: './video.mp4' })
indexed.ready(() => {
  indexed.audit(console.log) // should report 0 invalid
})
```

### `Box.origin`

Classes who extend the `Box` class who are interested in affecting the
value of the `box.isOrigin` predicate accessor should implement this
Symbol method.

```js
const ram = require('random-access-memory')

class Origin extends Box {
  get [Box.origin]() {
    return true
  }
}

const origin = new Origin(ram)
console.log(origin.isOrigin) // true
```

### `Box.hypercore`

Classes who extend the `Box` class who are interested in providing a
[hypercore][hypercore] factory should implement this Symbol method.

```js
const hypertrie = require('hypertrie')
const xsalsa20 = require('xsalsa20-encoding')
const crypto = require('crypto')

class EncryptedOriginTrieBox extends Box {
  [Box.hypercore](opts) {
    return hypertrie
  }

  [Box.codec](opts) {
    return xsalsa20(opts.secret)
  }

  get [Box.origin]() {
    return true
  }
}

const secret = crypto.randomBytes(32)
const trie = new EncryptedOriginTrieBox(ram, { secret })
trie.put('hello', 'world', (err) => {
  trie.get('hello', console.log) // { ..., key: 'hello', value: 'world' }
})
```

### `const node = new Node(storage, key, options)`

The `Node` class represents an extended `Box` class that
creates and joins a network swarm replicating with peers
that connect to it. Storage is encrypted using the XSalsa20
cipher encoding.

#### Usage

```js
const node = new Node(storage[, key, [options]])
```

Where `storage`, `key`, and `options` are the same arguments for `Box`
and `options` is passed directly to the `Network` (and the [hyperswarm
constructor][hyperswarm]).

#### `node.encryptionKey`

Encryption key used for the XSalsa20 cipher to encrypt storage data.

### `const options = Node.defaults(defaults, ...overrides)`

Creates an options object that can be passed to the `Node` constructor
where options can at least be those returned by `Box.defaults()` and:

```js
{
  announce: true,
  lookup: true,
  download: true,
  upload: true,
  ephemeral: true,
  encrypt: true,
}
```

##### Usage

```js
const options = Node.defaults(defaults, ...overrides)
```

Where default options described by the `Node` class can be overloaded by a
given `defaults` object and subsequently with any number of override
objects passed in as _rest arguments_ `...overrides`.

### `Node.connection`

Classes who extend the `Node` class who are interested in providing a
custom connection handler or short circuit before the replication begins
for the instance Hypercore feed.

```js
class ExtendedNode extends Node {
  [Node.connection](connection, info) {
    // abort replication and handle connection here
    return false
  }
}
```

### `const edge = new Edge(storage, key, options)`

The `Edge` class represents an extended `Node` that is
live, non-ephemeral and non-sparse.

#### Usage

```js
const edge = new Edge(storage[, key[, options]])`
```

Where `storage`, `key`, and `options` are the same arguments for `Node`.

### `const options = Edge.defaults(defaults, ...overrides)`

Creates an options object that can be passed to the `Edge` constructor
where options can at least be those returned by `Node.defaults()` and:

```js
{
  ephemeral: false,
  sparse: false,
  origin: true,
  live: true,
}
```

#### Usage

```js
const options = Edge.defaults(defaults, ...overrides)
```

Where default options described by the `Edge` class can be overloaded by a
given `defaults` object and subsequently with any number of override
objects passed in as _rest arguments_ `...overrides`.

### `const origin = new Origin(storage, key, options)`

The `Origin` class represents an extended `Node` that is
is an origin, non-ephemeral, only uploads, and does not look up
peers.

#### Usage

```js
const origin = new Origin(storage[, key[, options]])
```

Where `storage`, `key`, and `options` are the same arguments for `Node`.

### `const options = Origin.defaults(defaults, ...overrides)`

Creates an options object that can be passed to the `Origin` constructor
where options can at least be those returned by `Node.defaults()` and:

```js
{
  ephemeral: false,
  download: false,
  lookup: false,
  origin: true,
}
```

#### Usage

```js
const options = Origin.defaults(defaults, ...overrides)
```

Where default options described by the `Origin` class can be overloaded by a
given `defaults` object and subsequently with any number of override
objects passed in as _rest arguments_ `...overrides`.

### `const reader = new Reader(storage, key, options)`

The `Reader` class represents an extended `Node` that is
ephemeral, only downloads, and does not look up
peers.

#### Usage

```js
const reader = new Reader(storage[, key[, options]])
```

Where `storage`, `key`, and `options` are the same arguments for `Node`.

### `const options = Reader.defaults(defaults, ...overrides)`

Creates an options object that can be passed to the `Reader` constructor
where options can at least be those returned by `Node.defaults()` and:

```js
{
  announce: false,
  download: true,
}
```

#### Usage

```js
const options = Reader.defaults(defaults, ...overrides)
```

Where default options described by the `Reader` class can be overloaded by a
given `defaults` object and subsequently with any number of override
objects passed in as _rest arguments_ `...overrides`.

### `const sink = new Sink(storage, key, options)`

The `Sink` class represents an extended `Node` that
treats the data storage as the contents of a file
to be downloaded and synced with the network. The `Sink`
class will decode data using the XSalsa20 cipher for decryption
before writing to data storage if an `encryptionKey` is given.

#### Usage

```js
const sink = new Sink(storage[, key[, options]])
```

Where `storage` is the path to the destination storage, and `key` and
`options` are the same arguments for `Node`.

### `const options = Sink.defaults(defaults, ...overrides)`

Creates an options object that can be passed to the `Sink` constructor
where options can at least be those returned by `Node.defaults()` and:

```js
{
  encryptionKey: null,
  overwrite: true,
  nonces: null,
  hooks: []
}
```

#### Usage

```js
const options = Sink.defaults(defaults, ...overrides)
```

Where default options described by the `Sink` class can be overloaded by a
given `defaults` object and subsequently with any number of override
objects passed in as _rest arguments_ `...overrides`.



## License

MIT

[hypercore]: https://github.com/mafintosh/hypercore
[hyperswarm]: https://github.com/hyperswarm/hyperswarm
[random-access-storage]: https://github.com/random-access-storage/random-access-storage
