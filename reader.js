const { Node } = require('./node')
const extend = require('extend')

/**
 */
class Reader extends Node {

  /**
   */
  static defaults() {
    return extend(true, Node.defaults(), {
      announce: false, lookup: true,
      download: true, upload: false,
      //sparse: true,
    })
  }

  /**
   */
  get isOrigin() {
    return false
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
