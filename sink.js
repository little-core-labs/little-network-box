const { Node } = require('./node')
const { Box } = require('./box')
const extend = require('extend')
const hooks =  require('./hooks')

/**
 */
class Sink extends Node {

  /**
   */
  static defaults() {
    return extend(true, Node.defaults(), {
      announce: true, lookup: true,
      download: true, upload: false,
    })
  }

  /**
   */
  get isOrigin() {
    return false
  }

  /**
   */
  [Box.write](index, data, peer, done) {
    return hooks.xsalsa20(this).call(this, index, data, peer, done)
  }
}

/**
 */
function createSink(...args) {
  return new Sink(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createSink, {
  Sink
})
