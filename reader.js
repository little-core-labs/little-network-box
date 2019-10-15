const { Node } = require('./node')
const extend = require('extend')

/**
 * The `Reader` class represents an extended `Node` that is
 * ephemeral, only downloads, and does not look up
 * peers.
 * @public
 * @class Reader
 * @extends Node
 */
class Reader extends Node {

  /**
   * Default options for a `Reader` class instance.
   * @public
   * @static
   * @param {?(Object)} defaults
   * @param {...?(Object)} overrides
   * @return {Object}
   */
  static defaults(defaults, ...overrides) {
    return Node.defaults({
      announce: false,
      download: true,
    }, defaults, ...overrides)
  }
}

/**
 * Factory for creating `Reader` instances.
 * @public
 */
function createReader(...args) {
  return new Reader(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createReader, {
  Reader
})
