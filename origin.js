const { Node } = require('./node')
const extend = require('extend')

/**
 */
class Origin extends Node {

  /**
   */
  static defaults(defaults, ...overrides) {
    return Node.defaults({
      announce: true, lookup: true,
      download: false, upload: true,
      origin: true
    }, defaults, ...overrides)
  }
}

/**
 */
function createOrigin(...args) {
  return new Origin(...args)
}

/**
*/
module.exports = Object.assign(createOrigin, {
  Origin
})
