const { Node } = require('./node')
const { sink } = require('./storage')
const { Box } = require('./box')
const extend = require('extend')
const hooks =  require('./hooks')

/**
 */
class Sink extends Node {

  /**
   */
  static defaults() {
    return extend(true, Node.defaults(), {
      announce: true, lookup: true,
      download: true, upload: true,
      ephemeral: true,
      //sparse: true,
      encryptionKey: null, nonce: null,
    })
  }

  /**
   */
  get isOrigin() {
    return false
  }

  /**
   */
  [Box.codec](opts) {
    return null
  }

  /**
   */
  [Box.storage](storage, opts) {
    return sink(storage, opts.storage, null, opts)
  }

  /**
   */
  [Box.write](index, data, peer, done) {
    const { encryptionKey, nonce, feed } = this
    if (encryptionKey && nonce) {
      const hook =  hooks.xsalsa20(this)
      return hook.call(feed, index, data, peer, done)
    } else {
      return done(null)
    }
  }
}

/**
 */
function createSink(...args) {
  return new Sink(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createSink, {
  Sink
})
