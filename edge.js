const { Node } = require('./node')
const extend = require('extend')

/**
 * The `Edge` class represents an extended `Node` that is
 * live, non-ephemeral and non-sparse.
 * @public
 * @class Node
 * @extends Edge
 */
class Edge extends Node {

  /**
   * Default options for a `Edge` class instance.
   * @public
   * @static
   * @param {?(Object)} defaults
   * @param {...?(Object)} overrides
   * @return {Object}
   */
  static defaults(defaults, ...overrides) {
    return Node.defaults({
      ephemeral: false,
      sparse: false,
      origin: true,
      live: true,
    }, defaults, ...overrides)
  }
}

/**
 * Factory for creating `Edge` instances.
 * @public
 */
function createEdge(...args) {
  return new Edge(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createEdge, {
  Edge,
})
