const { Node } = require('./node')
const { sink } = require('./storage')
const { Box } = require('./box')
const extend = require('extend')
const hooks =  require('./hooks')

/**
 * The `Sink` class represents an extended `Node` that
 * treats the data storage as the contents of a file
 * to be downloaded and synced with the network. The `Sink`
 * class will decode data using the XSalsa20 cipher for decryption
 * before writing to data storage if an `encryptionKey` and `nonce`
 * is given.
 * @public
 * @class Sink
 * @extends Node
 */
class Sink extends Node {

  /**
   * Default options for a `Sink` class instance.
   * @public
   * @static
   * @param {?(Object)} defaults
   * @param {...?(Object)} overrides
   * @return {Object}
   */
  static defaults(defaults, ...overrides) {
    return Node.defaults({
      encryptionKey: null,
      overwrite: true,
      nonce: null,
    }, defaults, ...overrides)
  }

  /**
   * `Box.codec` handler to return empty encoding
   * @private
   */
  [Box.codec](opts) {
    return null
  }

  /**
   * `Box.storage` handler to return `sink()` storage
   * @private
   */
  [Box.storage](storage, opts) {
    return sink(this, storage, opts.storage, null, opts)
  }

  /**
   * Decodes data using XSalsa20 cipher if
   * `encryptionKey` and `nonce` were given.
   * @private
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
 * Factory for creating `Sink` instances.
 * @public
 */
function createSink(...args) {
  return new Sink(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createSink, {
  Sink,
})
