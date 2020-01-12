const { Node } = require('./node')
const extend = require('extend')
const hooks = require('./hooks')
const ram = require('random-access-memory')

/**
 * The `Origin` class represents an extended `Node` that is
 * is an origin node, non-ephemeral, only uploads, and does not look up
 * peers.
 * @public
 * @class Origin
 * @extends Node
 */
class Origin extends Node {

  /**
   * Default options for a `Origin` class instance.
   * @public
   * @static
   * @param {?(Object)} defaults
   * @param {...?(Object)} overrides
   * @return {Object}
   */
  static defaults(defaults, ...overrides) {
    return Node.defaults({
      ephemeral: false,
      download: false,
      lookup: false,
      origin: true,
      nonces: null,
      hooks: [],
    }, defaults, ...overrides)
  }

  /**
   * @protected
   */
  [Node.init](opts) {
    super[Node.init](opts)

    this.nonces = opts.nonces
  }

  [Node.options](opts) {
    super[Node.options](opts)
    if (opts.encryptionKey && opts.nonces) {
      opts.hooks.push(hooks.xsalsa20)
    }
  }

  [Node.codec](opts) {
    return null
  }
}

/**
 * Factory for creating `Origin` instances.
 * @public
 */
function createOrigin(...args) {
  return new Origin(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createOrigin, {
  Origin,
})
