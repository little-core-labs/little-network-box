const { Node } = require('./node')
const extend = require('extend')

/**
 */
class Edge extends Node {

  /**
   */
  static defaults(defaults, ...overrides) {
    return Node.defaults({
      announce: true, lookup: true,
      download: true, upload: true,
      sparse: false,
      live: true,
    }, defaults, ...overrides)
  }
}

/**
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
