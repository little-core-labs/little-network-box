const { EventEmitter } = require('events')
const { Origin } = require('./origin')
const { source } = require('./storage')
const { Box } = require('./box')
const storage = require('./storage')
const codecs = require('./codecs')
const extend = require('extend')
const debug = require('debug')('little-network-box:source')
const hooks = require('./hooks')
const pump = require('pump')
const get = require('get-uri')
const url = require('url')
const fs = require('fs')

// quick util
const bind = (self, f) => (...args) => f.call(self, ...args)

// exported symbols attached to the `Source` class
const kSourceStream = Symbol('Source.stream')

/**
 * The `Source` class represents a streamable source specified
 * defaulting to URI streams supported by the `get-uri`.
 * @public
 * @class
 * @extends Origin
 */
class Source extends Origin {

  /**
   * Default options for a `Source` class instance.
   * @public
   * @static
   * @param {?(Object)} defaults
   * @param {...?(Object)} overrides
   * @return {Object}
   */
  static defaults(defaults, ...overrides) {
    return Origin.defaults({
      encryptionKey: null,
      highWaterMark: 64 * 1024,
      indexing: true,
    }, defaults, ...overrides)
  }

  /**
   * @private
   */
  [Box.options](opts) {
    super[Box.options](opts)

    const u = url.parse(opts.uri)

    try {
      if (!u.protocol) {
        fs.accessSync(opts.uri)
        u.protocol = 'file:'
        opts.uri = url.format(u)
      }
    } catch (err) {
      void err
    }
  }

  /**
   * @protected
   */
  [Box.init](opts) {
    super[Box.init](opts)

    this.uri = opts.uri
  }

  /**
   * @private
   */
  [Box.codec](opts) {
    return null
  }

  /**
   * @private
   */
  [Box.storage](storage, opts) {
    return source(this, this.uri, storage, null, opts)
  }

  /**
   * @private
   */
  [Box.ready](opts, done) {
    super[Box.ready](opts, (err) => {
      if (err) { return done(err) }
      this.feed.ready(() => {
        this[kSourceStream](opts, (err, stream) => {
          if (err || !stream) { return done(err) }
          pump(stream, this.createWriteStream(), done)
        })
      })
    })
  }

  /**
   * @private
   */
  [kSourceStream](opts, done) {
    const { highWaterMark } = opts
    get(this.uri, { highWaterMark }, done)
  }
}

/**
 * The `Source.stream` symbol for overloading the handler
 * for getting source stream stream.
 * @public
 * @static
 * @type {Symbol}
 */
Source.stream = kSourceStream

/**
 * Factory for creating `Sink` instances.
 * @public
 */
function createSource(...args) {
  return new Source(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createSource, {
  Source,
})
