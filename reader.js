const { Node } = require('./node')
const extend = require('extend')

/**
 */
class Reader extends Node {

  /**
   */
  static defaults(defaults, ...overrides) {
    return Node.defaults({
      announce: false, lookup: true,
      download: true, upload: false,
      //sparse: true,
    }, defaults, ...overrides)
  }
}

/**
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
