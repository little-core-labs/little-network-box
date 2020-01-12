const passthrough = require('passthrough-encoding')
const hypertrie = require('hypertrie')
const hypercore = require('hypercore')
const collect = require('collect-stream')
const crypto = require('hypercore-crypto')
const mutex = require('mutexify')
const pump = require('pump')
const test = require('tape')
const ram = require('random-access-memory')

const createBox = require('../box')
const { Box } = require('../box')

test('createBox(storage, key, opts)', (t) => {
  createBox(ram).ready(() => t.end())
})

test('Box(storage, key, opts)', (t) => {
  t.throws(() => new Box())
  t.throws(() => new Box(null))
  t.throws(() => new Box([]))
  t.throws(() => new Box({}))
  t.throws(() => new Box(123))
  t.throws(() => new Box(() => void 0))

  {
    t.ok(new Box(ram))
  }

  {
    const { publicKey, secretKey } = crypto.keyPair()
    t.ok(new Box(ram, publicKey, { secretKey }))
  }

  {
    const { publicKey } = crypto.keyPair()
    t.ok(new Box(ram, publicKey))
  }

  {
    const { publicKey, secretKey } = crypto.keyPair()
    t.ok(new Box(ram,  { key: publicKey, secretKey }))
  }

  {
    const { publicKey, secretKey } = crypto.keyPair()
    t.ok(new Box(ram,  publicKey.toString('hex'), {
      secretKey: secretKey.toString('hex')
    }))
  }

  {
    t.ok(new Box(ram, { origin: true }))
    t.ok(new Box(ram, { lock: mutex() }))
    t.ok(new Box(ram, { hooks: [] }))
    t.ok(new Box(ram, { hooks: null }))
    t.ok(new Box(ram, { hook: () => void 0 }))
    t.ok(new Box(ram, { hypercore: hypercore }))
    t.ok(new Box(null, { feed: hypercore(ram) }))
    t.ok(new Box(ram, { codec: passthrough }))
    t.ok(new Box(ram, { valueEncoding: passthrough }))

    class ExtendedBox extends Box {
      [Box.init](opts) {
        this[Box.codec] = null
      }
    }

    t.ok(new ExtendedBox(ram))
  }

  t.end()
})

test('Box.defaults(defaults, opts)', (t) => {
  t.ok('object' === typeof Box.defaults())
  t.equal(false, Box.defaults().storeSecretKey)
  t.equal(true, Box.defaults({ storeSecretKey: true }).storeSecretKey)

  class ExtendedBox extends Box { }
  ExtendedBox.defaults = null

  t.ok(new ExtendedBox(ram))

  t.end()
})

test('Box#key', (t) => {
  const { publicKey } = crypto.keyPair()
  const box = new Box(ram)
  box.ready(() => {
    t.ok(Buffer.isBuffer(box.key))
    const other = new Box(ram, box.key)
    other.ready(() => {
      t.ok(0 === Buffer.compare(other.key, box.key))
      const another = new Box(ram, publicKey)
      another.ready(() => {
        t.ok(0 === Buffer.compare(publicKey, another.key))
        t.end()
      })
    })
  })
})

test('Box#secretKey', (t) => {
  const { publicKey, secretKey } = crypto.keyPair()
  const box = new Box(ram)
  box.ready(() => {
    t.ok(Buffer.isBuffer(box.secretKey))
    const other = new Box(ram, box.key, { secretKey: box.secretKey })
    other.ready(() => {
      t.ok(0 === Buffer.compare(other.secretKey, box.secretKey))
      const another = new Box(ram, publicKey, { secretKey })
      another.ready(() => {
        t.ok(0 === Buffer.compare(publicKey, another.key))
        t.ok(0 === Buffer.compare(secretKey, another.secretKey))
        t.end()
      })
    })
  })
})

test('Box#discoveryKey', (t) => {
  const { publicKey } = crypto.keyPair()
  const discoveryKey = crypto.discoveryKey(publicKey)
  const box = new Box(ram)
  box.ready(() => {
    t.ok(Buffer.isBuffer(box.discoveryKey))
    const other = new Box(ram, box.key)
    const another = new Box(ram, publicKey, { discoveryKey })
    other.ready(() => {
      t.ok(0 == Buffer.compare(other.discoveryKey, box.discoveryKey))
    })

    another.ready(() => {
      t.ok(0 == Buffer.compare(another.discoveryKey, discoveryKey))
      t.end()
    })
  })
})

test('Box#stats', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.ok(box.stats)
    t.end()
  })
})

test('Box#extensions', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.ok(box.extensions)
    t.end()
  })
})

test('Box#live', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.equal(true, box.live)
    t.end()
  })
})

test('Box#sparse', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.equal(false, box.sparse)
    t.end()
  })
})

test('Box#readable', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.equal(true, box.readable)
    t.end()
  })
})

test('Box#writable', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.equal(true, box.writable)
    const other = new Box(ram, box.key)
    other.ready(() => {
      t.equal(false, other.writable)
      t.end()
    })
  })
})

test('Box#opened', (t) => {
  const box = new Box(ram)
  t.equal(false, box.opened)
  box.ready(() => {
    t.equal(true, box.opened)
    t.end()
  })
})

test('Box#closed', (t) => {
  const box = new Box(ram)
  t.equal(false, box.closed)
  box.once('close', () =>{ t.end() })
  box.ready(() => {
    t.equal(false, box.closed)
    box.close(() => {
      t.equal(true, box.closed)
    })
  })
})

test('Box#length', (t) => {
  const box = new Box(ram)
  t.equal(0, box.length)
  box.ready(() => {
    // no funny business
    t.equal(0, box.length)
    box.append(Buffer.from('hello'), () => {
      t.equal(1, box.length)
      t.end()
    })
  })
})

test('Box#byteLength', (t) => {
  const box = new Box(ram)
  t.equal(0, box.byteLength)
  box.ready(() => {
    // no funny business
    t.equal(0, box.byteLength)
    box.append(Buffer.from('hello'), () => {
      t.equal(Buffer.from('hello').length, box.byteLength)
      t.end()
    })
  })
})

test('Box#isOrigin', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.equal(false, box.isOrigin)
    const other = new Box(ram, { origin: true })
    other.ready(() => {
      t.equal(true, other.isOrigin)
      t.end()
    })
  })
})

test('Box#[Box.options](opts)', (t) => {
  class ExtendedBox extends Box {
    [Box.options](opts) {
      t.ok(opts)
      t.equal('object', typeof opts)
      t.equal('123', opts.value)
      t.end()
    }
  }

  new ExtendedBox(ram, { value: '123' })
})

test('Box#[Box.init](opts)', (t) => {
  class ExtendedBox extends Box {
    [Box.init](opts) {
      t.ok(opts)
      t.equal('object', typeof opts)
      t.equal('123', opts.value)
      t.end()
    }
  }

  new ExtendedBox(ram, { value: '123' })
})

test('Box#[Box.codec](opts)', (t) => {
  class ExtendedBox extends Box {
    [Box.codec](opts) {
      return require('buffer-json-encoding')
    }
  }

  const box = new ExtendedBox(ram)
  box.append({value: '123'}, (err) => {
    t.notOk(err)
    box.head((err, result) => {
      t.notOk(err)
      t.ok(result)
      t.equal('123', result.value)
      t.end()
    })
  })
})

test('Box#[Box.open](opts)', (t) => {
  class ExtendedBox extends Box {
    [Box.open](opts) {
      t.ok(opts)
      t.equal('object', typeof opts)
      t.equal('123', opts.value)
      t.end()
    }
  }

  new ExtendedBox(ram, { value: '123' })
})

test('Box#[Box.close](opts)', (t) => {
  class ExtendedBox extends Box {
    [Box.close](opts) {
      t.ok(opts)
      t.equal('object', typeof opts)
      t.equal('123', opts.value)
      t.end()
    }
  }

  const box = new ExtendedBox(ram, { value: '123' })
  box.ready(() => {
    box.close()
  })
})

test('Box#[Box.write](index, data, peer, done)', (t) => {
  class ExtendedBox extends Box {
    [Box.write](index, data, peer, done) {
      t.equal(0, index)
      t.ok(0 === Buffer.compare(Buffer.from('hello'), data))
      done()
      t.end()
    }
  }

  const box = new ExtendedBox(ram)
  box.ready(() => {
    box.append(Buffer.from('hello'))
  })
})

test('Box#[Box.ready](opts, done)', (t) => {
  class ExtendedBox extends Box {
    [Box.ready](opts, done) {
      t.ok(opts)
      t.equal('object', typeof opts)
      t.equal('123', opts.value)
      t.end()
      done()
    }
  }

  new ExtendedBox(ram, { value: '123' })
})

test('Box#[Box.storage](storage, opts)', (t) => {
  class ExtendedBox extends Box {
    [Box.storage](storage, opts) {
      t.ok(opts)
      t.equal('object', typeof opts)
      t.equal('123', opts.value)
      t.equal('./path', storage)
      t.end()
      return ram
    }
  }

  new ExtendedBox('./path', { value: '123' })
})

test('Box#[Box.hypercore](opts)', (t) => {
  class ExtendedBox extends Box {
    [Box.hypercore](opts) {
      t.ok(opts)
      return hypertrie
    }
  }

  const box = new ExtendedBox(ram)
  box.ready(() => {
    box.feed.put('hello', 'world', (err) => {
      t.notOk(err)
      box.feed.get('hello', (err, result) => {
        t.notOk(err)
        t.ok(result)
        t.ok(0 === Buffer.compare(Buffer.from('world'), result.value))
        t.equal('hello', result.key)
        t.end()
      })
    })
  })
})

test('Box#ready(done)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    t.end()
  })
})

test('Box#replicate(opts)', (t) => {
  const writer = new Box(ram)
  writer.ready(() => {
    writer.append(Buffer.from('hello'), (err) => {
      t.notOk(err)
      const reader = new Box(ram, writer.key)
      const stream = writer.replicate(false)
      pump(stream, reader.replicate(true), stream, (err) => {
        t.notOk(err)
        reader.head((err, head) => {
          t.notOk(err)
          t.ok(0 === Buffer.compare(head, Buffer.from('hello')))
          t.end()
        })
      })
    })
  })
})

test('Box#update(callback)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.append(Buffer.from('hello'), (err) => {
      t.notOk(err)
    })
  })

  box.update(() => {
    t.ok(box.length > 0)
    t.end()
  })
})

test('Box#close(callback)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.close(() => {
      t.equal(true, box.closed)
      t.end()
    })
  })
})

test('Box#append(data, callback)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.append(Buffer.from('hello'), (err) => {
      t.equal(1, box.length)
      t.notOk(err)
      t.end()
    })
  })
})

test('Box#extension(name, message)', (t) => {
  const box = new Box(ram, { extensions: [ 'hello' ] })
  box.ready(() => {
    box.extension('hello', Buffer.from('world'))
    t.end()
  })
})

test('Box#download(range, callback)', (t) => {
  t.plan(6)
  const origin = new Box(ram)
  origin.ready(() => {
    origin.append('hello'.split('').map(Buffer.from), (err) => {
      t.notOk(err)
      const destination = new Box(ram, origin.key, { sparse: true })
      const stream = origin.replicate(false)

      let missing = 0
      for (let i = 0; i < origin.length; ++i) {
        missing++
        destination.download({ start: i, end: i + 1 }, (err) => {
          t.notOk(err)
          if (0 === --missing) {
            t.end()
          }
        })
      }

      pump(stream, destination.replicate(true), stream, (err) => {
        t.notOk(err)
      })
    })
  })
})

test('Box#undownload(range)', (t) => {
  const origin = new Box(ram)
  origin.ready(() => {
    origin.append('hello'.split('').map(Buffer.from), (err) => {
      t.notOk(err)
      const destination = new Box(ram, origin.key, { sparse: true })
      const stream = origin.replicate(false)

      pump(stream, destination.replicate(true), stream)

      for (let i = 0; i < origin.length; ++i) {
        destination.download({start: i, end: i + 1}, (err) => {
          t.fail('should not download block')
        })
      }

      for (let i = 0; i < origin.length; ++i) {
        destination.undownload({ start: i, end: i + 1, callback: () => void 0})
      }

      t.end()
    })
  })
})

test('Box#head(opts, callback)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.append(Buffer.from('hello'), (err) =>{
      t.notOk(err)
      box.head((err, head) => {
        t.notOk(err)
        t.ok(0 === Buffer.compare(head, Buffer.from('hello')))
        t.end()
      })
    })
  })
})

test('Box#get(index, opts, callback)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.append(Buffer.from('hello'), (err) =>{
      t.notOk(err)
      box.get(0, (err, head) => {
        t.notOk(err)
        t.ok(0 === Buffer.compare(head, Buffer.from('hello')))
        t.end()
      })
    })
  })
})

test('Box#put(index, data, proof, callback)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    const copy = new Box(ram, box.key)
    box.append(Buffer.from('hello'), (err) =>{
      t.notOk(err)
      box.proof(0, (err, proof) => {
        t.notOk(err)
        copy.put(0, Buffer.from('hello'), proof, (err) => {
          t.notOk(err)
          copy.head((err, head) => {
            t.notOk(err)
            t.ok(0 === Buffer.compare(head, Buffer.from('hello')))
            t.end()
          })
        })
      })
    })
  })
})

test('Box#audit(callback)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.append(Buffer.from('hello'), (err) => {
      t.notOk(err)
      box.audit((err, report) => {
        t.notOk(err)
        t.ok(report)
        t.equal(1, report.valid)
        t.equal(0, report.invalid)
        t.end()
      })
    })
  })
})

test('Box#downloaded(start, end)', (t) => {
  const origin = new Box(ram)
  origin.ready(() => {
    origin.append('hello'.split('').map(Buffer.from), (err) => {
      t.notOk(err)
      const destination = new Box(ram, origin.key, { sparse: true })
      const stream = origin.replicate(false)

      let missing = 0
      for (let i = 0; i < origin.length; ++i) {
        missing++
        destination.download({ start: i, end: i + 1 }, (err) => {
          t.notOk(err)
          if (0 === --missing) {
            t.equal(origin.length, destination.downloaded(0, origin.length))
            t.end()
          }
        })
      }

      pump(stream, destination.replicate(true), stream, (err) => {
        t.notOk(err)
      })
    })
  })
})

test('Box#createReadStream(opts)', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.append('hello'.split('').map(Buffer.from), (err) => {
      t.notOk(err)
      collect(box.createReadStream(), (err, buf) => {
        t.notOk(err)
        t.ok(0 === Buffer.compare(buf, Buffer.from('hello')))
        t.end()
      })
    })
  })
})

test('Box#createWriteStream()', (t) => {
  const box = new Box(ram)
  box.ready(() => {
    box.createWriteStream().end(Buffer.from('hello'))
    box.on('append', () => {
      collect(box.createReadStream(), (err, buf) => {
        t.notOk(err)
        t.ok(0 === Buffer.compare(buf, Buffer.from('hello')))
        t.end()
      })
    })
  })
})

test('Box#onerror(err)', (t) => {
  const box = new Box(ram)
  const { onerror } = box
  box.onerror = (err) => {
    t.pass('error')
    return onerror(err)
  }

  box.on('error', (err) => {
    t.ok(err)
    t.equal('oops', err.message)
    t.end()
  })

  box.ready(() => {
    box.onerror()
    box.onerror(new Error('oops'))
  })
})

test('Box#onclose()', (t) => {
  const box = new Box(ram)
  const { onclose } = box
  box.onclose = () => {
    t.end()
    return onclose()
  }

  box.on('close', () => {
    t.pass('close')
  })

  box.ready(() => {
    box.close()
  })
})

test('Box#onappend()', (t) => {
  const box = new Box(ram)
  const { onappend } = box
  box.onappend = () => {
    t.end()
    return onappend()
  }

  box.on('append', () => {
    t.pass('append')
  })

  box.ready(() => {
    box.append(Buffer.from('hello'))
  })
})

test('Box#ondownload(index, data)', (t) => {
  const writer = new Box(ram)
  writer.ready(() => {
    writer.append(Buffer.from('hello'), (err) => {
      t.notOk(err)
      const reader = new Box(ram, writer.key)
      const stream = writer.replicate(false)

      const { ondownload } = reader
      reader.ondownload = (...args) => {
        t.end()
        return ondownload(...args)
      }

      pump(stream, reader.replicate(true), stream, (err) => {
        t.notOk(err)
        reader.head((err, head) => {
          t.notOk(err)
          t.ok(0 === Buffer.compare(head, Buffer.from('hello')))
        })
      })
    })
  })
})

test('Box#onupload(index, data)', (t) => {
  const writer = new Box(ram)
  const { onupload } = writer
  writer.onupload = (...args) => {
    t.end()
    return onupload(...args)
  }

  writer.ready(() => {
    writer.append(Buffer.from('hello'), (err) => {
      t.notOk(err)
      const reader = new Box(ram, writer.key)
      const stream = writer.replicate(false)

      pump(stream, reader.replicate(true), stream, (err) => {
        t.notOk(err)
        reader.head((err, head) => {
          t.notOk(err)
          t.ok(0 === Buffer.compare(head, Buffer.from('hello')))
        })
      })
    })
  })
})

test('Box#onsync()', (t) => {
  const writer = new Box(ram)
  writer.ready(() => {
    writer.append(Buffer.from('hello'), (err) => {
      t.notOk(err)
      const reader = new Box(ram, writer.key)
      const stream = writer.replicate(false)

      const { onsync } = reader
      reader.onsync = (...args) => {
        t.end()
        return onsync(...args)
      }

      pump(stream, reader.replicate(true), stream, (err) => {
        t.notOk(err)
        reader.head((err, head) => {
          t.notOk(err)
          t.ok(0 === Buffer.compare(head, Buffer.from('hello')))
        })
      })
    })
  })
})

test('Box.options', (t) => {
  t.ok('symbol' === typeof Box.options)
  t.end()
})

test('Box.init', (t) => {
  t.ok('symbol' === typeof Box.init)
  t.end()
})

test('Box.codec', (t) => {
  t.ok('symbol' === typeof Box.codec)
  t.end()
})

test('Box.open', (t) => {
  t.ok('symbol' === typeof Box.open)
  t.end()
})

test('Box.close', (t) => {
  t.ok('symbol' === typeof Box.close)
  t.end()
})

test('Box.write', (t) => {
  t.ok('symbol' === typeof Box.write)
  t.end()
})

test('Box.ready', (t) => {
  t.ok('symbol' === typeof Box.ready)
  t.end()
})

test('Box.storage', (t) => {
  t.ok('symbol' === typeof Box.storage)
  t.end()
})

test('Box.hypercore', (t) => {
  t.ok('symbol' === typeof Box.hypercore)
  t.end()
})
