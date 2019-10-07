const { EventEmitter } = require('events')
const { Network } = require('./network')
const toBuffer = require('to-buffer')
const crypto = require('hypercore-crypto')
const assert = require('assert')

// quick util
const bind = (self, f) => (...args) => f.call(self, ...args)

/**
 */
class Client extends EventEmitter {

  /**
   */
  static defaults() {
    return {
      port: 54809,
      lookup: true,
      announce: false,
      ephemeral: true,
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

    if ('string' === typeof opts.publicKey) {
      opts.publicKey = toBuffer(opts.publicKey, 'hex')
    }

    assert(Buffer.isBuffer(opts.publicKey), 'public key is not a buffer')

    this.onconnection = bind(this, this.onconnection)
    this.onerror = bind(this, this.onerror)
    this.onpeer = bind(this, this.onpeer)

    this.discoveryKey = crypto.discoveryKey(opts.publicKey)
    this.publicKey = opts.publicKey
    this.secretKey = null

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
  connect(...args) {
    return this.network.connect(...args)
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
  onconnection(connection) {
    this.emit('connection', connection)
  }

  /**
   */
  onpeer(peer) {
    this.emit('peer', peer)
  }
}

/**
 */
function createClient(key, opts, onconnection) {
  if ('function' === typeof opts) {
    onconnection = opts
    opts = null
  }

  const client = new Client(opts)

  if ('function' === typeof onconnection) {
    client.on('connection', onconnection)
  }

  return client
}

/**
 * Module exports.
 */
module.exports = Object.assign(createClient, {
  Client,
})
