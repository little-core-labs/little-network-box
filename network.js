const HypercoreProtocol = require('hypercore-protocol')
const { EventEmitter } = require('events')
const hyperswarm = require('hyperswarm')
const crypto = require('hypercore-crypto')
const assert = require('assert')
const thunky = require('thunky')
const pump = require('pump')

// quick util
const bind = (self, f) => (...args) => f.call(self, ...args)

/**
 * @public
 * @class Network
 * @extends EventEmitter
 */
class Network extends EventEmitter {

  /**
   */
  constructor(opts) {
    super()
    this.setMaxListeners(0)

    if (null === opts || 'object' !== typeof opts) {
      opts = {}
    }

    this.ondisconnection = bind(this, this.ondisconnection)
    this.onconnection = bind(this, this.onconnection)
    this.onupdated = bind(this, this.onupdated)
    this.onclose = bind(this, this.onclose)
    this.onerror = bind(this, this.onerror)
    this.onready = bind(this, this.onready)
    this.onpeer = bind(this, this.onpeer)

    this.swarm = hyperswarm(opts)
    this.ready = thunky((done) => this.swarm.once('listening', done))

    if (!opts.publicKey || !opts.secretKey) {
      const { publicKey, secretKey } = crypto.keyPair()
    } else {
      this.publicKey = opts.publicKey
      this.secretKey = opts.secretKey
    }

    this.ready(this.onready)
    this.swarm.on('disconnection', this.ondisconnection)
    this.swarm.on('connection', this.onconnection)
    this.swarm.on('updated', this.onupdated)
    this.swarm.on('close', this.onclose)
    this.swarm.on('error', this.onerror)
  }

  /**
   */
  ondisconnection(socket, info) {
    this.emit('disconnection', socket, info)
  }

  /**
   */
  onconnection(socket, info) {
    const stream = new HypercoreProtocol({
      // TODO
      encrypt: false,
      ack: true,
      live: true
    })

    this.emit('connection', stream, info, socket)
    pump(socket, stream, socket)
  }

  /**
   */
  onupdated(info) {
    this.emit('updated', info)
  }

  /**
   */
  onclose() {
    this.emit('close')
  }

  /**
   */
  onerror(err) {
    this.emit('error', err)
  }

  /**
   */
  onready() {
    this.emit('ready')
  }

  /**
   */
  onpeer(peer) {
    this.emit('peer', peer)
  }

  /**
   */
  ready(onready) {
    void onready
    assert(false, 'Network ready function not implemented.')
  }

  /**
   */
  join(topic, opts) {
    return this.swarm.join(topic, opts)
  }

  /**
   */
  leave(topic, opts) {
    return this.swarm.leave(topic, opts)
  }

  /**
   */
  connect(peer, onconnect) {
    return this.swarm.connect(peer, onconnect)
  }

  /**
   */
  destroy(callback) {
    return this.swarm.destroy(callback)
  }

  /**
   */
  close(callback) {
    return this.destroy(callback)
  }
}

/**
 * Factory for creating `Network` instances.
 * @public
 */
function createNetwork(opts) {
  return new Network(opts)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createNetwork, {
  Network
})
