const { replicate } = require('./replicate')
const { Network } = require('./network')
const toBuffer = require('to-buffer')
const { Box } = require('./box')
const crypto = require('hypercore-crypto')
const codecs = require('./codecs')
const assert = require('assert')
const pump = require('pump')

// quick util
const bind = (self, f) => (...args) => f.call(self, ...args)

// exported symbols attached to the `Node` class
const kNodeConnection = Symbol('Node.connection')

/**
*/
class Node extends Box {

  /**
   */
  static defaults(defaults, ...overrides) {
    return Box.defaults({
      announce: true, lookup: true,
      download: true, upload: true,
      encrypt: true,
    }, defaults, ...overrides)
  }

  /**
   */
  [Box.options](opts) {
    super[Box.options](opts)

    if (null !== opts.nonce) {
      opts.nonce = toBuffer(opts.nonce || crypto.randomBytes(24), 'hex')
    }

    if (null !== opts.discoveryKey) {
      opts.discoveryKey = toBuffer(opts.discoveryKey, 'hex')
    }

    if (null !== opts.encryptionKey) {
      opts.encryptionKey = toBuffer(
        opts.encryptionKey || opts.secretKey || opts.key, 'hex')
    }
  }

  /**
   */
  [Box.init](opts) {
    super[Box.init](opts)

    this.onconnection = bind(this, this.onconnection)
    this.encryptionKey = opts.encryptionKey
    this.nonce = opts.nonce

    if (false !== opts.network) {
      this.network = opts.network || new Network(opts)
      this.network.on('connection', this.onconnection)
    }
  }

  /**
   */
  [Box.codec](opts) {
    const { encryptionKey, nonce } = opts
    if (encryptionKey && nonce) {
      assert(Buffer.isBuffer(nonce))
      assert(Buffer.isBuffer(encryptionKey))
      return codecs.xsalsa20({ encryptionKey, nonce })
    }
  }

  [Box.close](opts) {
    if (this.network) {
      this.network.removeListener('connection', this.onconnection)
      if (false === 'network' in opts) {
        this.network.destroy()
      }
    }
  }

  /**
  */
  [Box.ready](opts, done) {
    super[Box.ready](opts, (err) => {
      if (err) {
        done(err)
      } else if (this.network) {
        const { announce, lookup } = opts
        this.network.join(this.discoveryKey, { announce, lookup })
        this.network.ready(done)
      } else {
        process.nextTick(done)
      }
    })
  }

  /**
   */
  [kNodeConnection](stream, info, socket) {
    void stream, info, socket
    return true
  }

  /**
   */
  onconnection(stream, info, socket) {
    this.emit('connection', stream, info, socket)

    // prevent default
    if (false === this[Node.connection](stream, info, socket)) {
      return
    }

    const { isOrigin, discoveryKey } = this
    const topic = info.peer && info.peer.topic
    const { download, upload, encrypt, live } = this

    if (Buffer.isBuffer(topic) && 0 === Buffer.compare(topic, discoveryKey)) {
      this.replicate({ stream, initiator: info.client, ack: true, live: true })
    } else if (!topic && isOrigin) {
      this.replicate({ stream, initiator: info.client, ack: true, live: true })
    }
  }
}

/**
*/
Node.connection = kNodeConnection

/**
*/
function createNode(...args) {
  return new Node(...args)
}

/**
*/
module.exports = Object.assign(createNode, {
  Node,
})
