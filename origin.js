const { Node } = require('./node')
const extend = require('extend')

/**
 */
class Origin extends Node {

  /**
   */
  static defaults() {
    return extend(true, Node.defaults(), {
      announce: true, lookup: false,
      download: false, upload: true,
    })
  }

  /**
   */
  get isOrigin() {
    return true
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
