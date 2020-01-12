const { Node } = require('./node')
const { sink } = require('./storage')
const { Box } = require('./box')
const codecs = require('./codecs')
const extend = require('extend')
const hooks = require('./hooks')
const ram = require('random-access-memory')

/**
 * The `Sink` class represents an extended `Node` that
 * treats the data storage as the contents of a file
 * to be downloaded and synced with the network. The `Sink`
 * class will decode data using the XSalsa20 cipher for decryption
 * before writing to data storage if an `encryptionKey` and `nonces`
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
      nonces: null,
      hooks: [],
    }, defaults, ...overrides)
  }

  /**
   * `Box.init` handler to initialize `Node` instance.
   * @private
   * @method
   * @param {Object} opts
   */
  [Box.init](opts) {
    super[Box.init](opts)

    this.nonces = opts.nonces
  }

  [Box.options](opts) {
    super[Box.options](opts)
    if (opts.encryptionKey && opts.nonces) {
      opts.hooks.push(hooks.xsalsa20)
    }
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
