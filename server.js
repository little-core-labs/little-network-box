const { EventEmitter } = require('events')
const { Network } = require('./network')
const toBuffer = require('to-buffer')
const protocol = require('rpc-protocol')
const crypto = require('hypercore-crypto')
const assert = require('assert')

// quick util
const bind = (self, f) => (...args) => f.call(self, ...args)

/**
 */
class Server extends EventEmitter {

  /**
   */
  static defaults() {
    return {
      port: 54809,
      lookup: false,
      announce: true,
      ephemeral: false,
    }
  }

  /**
   */
  constructor(key, opts) {
    super()
    this.setMaxListeners(0)

    if (key && !Buffer.isBuffer(key) && 'object' === typeof key) {
      opts = key
      key = null
    }

    if (null === opts || 'object' !== typeof opts) {
      opts = {}
    }

    opts = Object.assign(this.constructor.defaults(), opts)

    if ('string' === typeof key || Buffer.isBuffer(key)) {
      if (!opts.key && !opts.publicKey) {
        opts.publicKey = key
      }
    }

    if (opts.key && !opts.publicKey) {
      opts.publicKey = opts.key
      delete opts.key
    }

    if (!opts.publicKey || !opts.secretKey) {
      Object.assign(opts, crypto.keyPair())
    }

    if ('string' === typeof opts.publicKey) {
      opts.publicKey = toBuffer(opts.publicKey, 'hex')
    }

    if ('string' === typeof opts.secretKey) {
      opts.secretKey = toBuffer(opts.secretKey, 'hex')
    }

    assert(Buffer.isBuffer(opts.publicKey), 'public key is not a buffer')
    assert(Buffer.isBuffer(opts.secretKey), 'secret key is not a buffer')

    this.onconnection = bind(this, this.onconnection)
    this.onerror = bind(this, this.onerror)
    this.onpeer = bind(this, this.onpeer)

    this.publicKey = opts.publicKey
    this.secretKey = opts.secretKey
    this.discoveryKey = crypto.discoveryKey(this.publicKey)

    this.network = new Network(opts)

    this.network.on('connection', this.onconnection)
    this.network.on('error', this.onerror)
    this.network.on('peer', this.onpeer)
    this.network.ready(() => {
      const { announce, lookup } = opts
      this.network.join(this.discoveryKey, { announce, lookup })
    })
  }

  /**
   */
  get key() {
    return this.publicKey
  }

  close(callback) {
    this.network.close(callback)
  }

  /**
   */
  onerror(err) {
    if (err) {
      this.emit('error', err)
    }
  }

  /**
   */
  onconnection(connection, info, socket) {
    this.emit('connection', connection, info, socket)
  }

  /**
   */
  onpeer(peer) {
    this.emit('peer', peer)
  }
}

/**
 */
function createServer(key, opts, onconnection) {
  if ('function' === typeof opts) {
    onconnection = opts
    opts = null
  }

  const server = new Server(key, opts)

  if ('function' === typeof onconnection) {
    server.on('connection', onconnection)
  }
  return server
}

/**
 * Module exports.
 */
module.exports = Object.assign(createServer, {
  Server,
})
