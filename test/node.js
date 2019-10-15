const test = require('tape')
const ram = require('random-access-memory')

const createNode = require('../node')
const { Node } = require('../node')

test('createNode(storage, key, opts)', (t) => {
  const node = createNode(ram)
  node.ready(() => {
    node.close(() => {
      t.pass()
      t.end()
    })
  })
})

test('Node.defaults(defaults, opts)', (t) => {
  t.ok('object' === typeof Node.defaults())
  t.equal(true, Node.defaults().announce)
  t.equal(true, Node.defaults().download)
  t.equal(false, Node.defaults({ announce: false }).announce)

  t.end()
})


test('Node(storage, key opts)', (t) => {
  {
    const node = new Node(ram)
    node.ready(() => {
      t.ok('function' === typeof node.onconnection)
      t.ok(Buffer.isBuffer(node.encryptionKey))
      t.ok(Buffer.isBuffer(node.nonce))
      t.ok(node.network)
      node.close(() => {
        t.pass()
      })
    })
  }

  {
    const node = new Node(ram, {
      encryptionKey: null,
      network: false,
      nonce: null,
    })

    node.ready(() => {
      t.ok('function' === typeof node.onconnection)
      t.ok(!Buffer.isBuffer(node.encryptionKey))
      t.ok(!Buffer.isBuffer(node.nonce))
      t.notOk(node.network)
      node.close(() => {
        t.pass()
      })
    })
  }

  {
    const node = new Node(ram, { network: false })
    node.ready(() => {
      t.ok('function' === typeof node.onconnection)
      t.ok(Buffer.isBuffer(node.encryptionKey))
      t.ok(Buffer.isBuffer(node.nonce))
      t.notOk(node.network)
      node.close(() => {
        t.end()
      })
    })
  }
})

test('Node - replication', (t) => {
  const source = new Node(ram, { origin: true })

  t.plan(4)

  source.once('connection', () => {
    t.pass('source connection')
  })

  source.ready(() => {
    source.append(Buffer.from('hello'), () => {
      t.ok(source.isOrigin)

      const reader = new Node(ram, source.key, {
        announce: false,
        encryptionKey: source.encryptionKey,
        nonce: source.nonce,
      })


      reader.once('connection', (s, i) => {
        t.pass('reader connection')
        reader.update(() => {
          reader.head((err, buf) => {
            t.ok(0 === Buffer.compare(buf, Buffer.from('hello')))
            source.close(() => {
              reader.close(() => {
                t.end()
              })
            })
          })
        })
      })
    })
  })
})

test('Node#[Node.connection](stream, info, socket)', (t) => {
  class ExtendedNode extends Node {
    [Node.connection](stream, info, socket) {
      // prevent default connection handler (node replication)
      return false
    }
  }

  const source = new ExtendedNode(ram, { origin: true })

  t.plan(5)

  source.once('connection', () => {
    t.pass('source connection')
  })

  source.ready(() => {
    source.append(Buffer.from('hello'), () => {
      t.ok(source.isOrigin)

      const reader = new ExtendedNode(ram, source.key, {
        announce: false,
        encryptionKey: source.encryptionKey,
        nonce: source.nonce,
      })

      reader.once('connection', (s, i) => {
        t.pass('reader connection')
        reader.head((err, buf) => {
          t.ok(err)
          t.notOk(buf)
          source.close(() => {
            reader.close(() => {
              t.end()
            })
          })
        })
      })
    })
  })
})

test('Node.connection', (t) => {
  t.ok('symbol' === typeof Node.connection)
  t.end()
})
