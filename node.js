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
 * The `Node` class represents an extended `Box` class that
 * creates and joins a network swarm replicating with peers
 * that connect to it. Storage is encrypted using the XSalsa20
 * cipher encoding.
 * @public
 * @class Node
 * @extends Box
 */
class Node extends Box {

  /**
   * Default options for a `Node` class instance.
   * @public
   * @static
   * @param {?(Object)} defaults
   * @param {...?(Object)} overrides
   * @return {Object}
   */
  static defaults(defaults, ...overrides) {
    return Box.defaults({
      announce: true, lookup: true,
      download: true, upload: true,
      ephemeral: true,
      encrypt: true,
    }, defaults, ...overrides)
  }

  /**
   * `Box.options` handler to ensure `nonce`, `discoveryKey`,
   * and `encryptionKey` are set.
   * @private
   * @method
   * @param {Object} opts
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
   * `Box.init` handler to initialize `Node` instance.
   * @private
   * @method
   * @param {Object} opts
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
   * `Box.codec` handler to return abstract encoding interface.
   * @private
   * @method
   * @param {Object} opts
   * @return {?(Object)}
   */
  [Box.codec](opts) {
    const { encryptionKey, nonce } = opts
    if (encryptionKey && nonce) {
      assert(Buffer.isBuffer(nonce))
      assert(Buffer.isBuffer(encryptionKey))
      return codecs.xsalsa20({ encryptionKey, nonce })
    }
  }

  /**
   * `Box.close` handler to destroy `Node` resources (network, etc).
   * @private
   * @method
   * @param {Object} opts
   */
  [Box.close](opts) {
    if (this.network) {
      this.network.removeListener('connection', this.onconnection)
      if (false === 'network' in opts) {
        this.network.destroy()
      }
    }
  }

  /**
   * `Box.ready` handler to signal ready state for `Node` instance.
   * @private
   * @method
   * @param {Object} opts
   * @param {Function} done
   */
  [Box.ready](opts, done) {
    super[Box.ready](opts, (err) => {
      if (this.network) {
        const { announce, lookup } = opts
        this.network.join(this.discoveryKey, { announce, lookup })
        this.network.ready(done)
      } else {
        process.nextTick(done)
      }
    })
  }

  /**
   * Abstract method called when a `Node` instance receives
   * a connection. Returning `false` prevents the default connection
   * handler from executing allow extending classes to implement custom
   * connection logic.
   * @protected
   * @abstract
   * @method
   * @param {Duplex} stream
   * @param {Object} info
   * @param {Duplex} socket
   * @return {Boolean}
   */
  [kNodeConnection](stream, info, socket) {
    void stream, info, socket
    return true
  }

  /**
   * Network connection handler.
   * @private
   * @method
   * @param {Duplex} stream
   * @param {Object} info
   * @param {Duplex} socket
   */
  onconnection(stream, info, socket) {
    this.emit('connection', stream, info, socket)

    // prevent default
    if (false === this[Node.connection](stream, info, socket)) {
      return
    }

    const { download, upload, encrypt, live } = this
    const { isOrigin, discoveryKey } = this
    const initiator = info.client
    const topic = info.peer && info.peer.topic

    if (
      (!topic && isOrigin) ||
      Buffer.isBuffer(topic) && 0 === Buffer.compare(topic, discoveryKey)
    ) {
      this.replicate({ ack: true, live, stream, initiator, upload, download })
    }
  }
}

/**
 * The `Node.connection` symbol for overloading connections handlers.
 * @public
 * @static
 * @type {Symbol}
 */
Node.connection = kNodeConnection

/**
 * Factory for creating `Node` instances.
 * @public
 */
function createNode(...args) {
  return new Node(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createNode, {
  Node,
})
