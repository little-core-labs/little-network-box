const { EventEmitter } = require('events')
const { Origin } = require('./origin')
const { source } = require('./storage')
const Nanoguard = require('nanoguard')
const duplexify = require('duplexify')
const { Box } = require('./box')
const storage = require('./storage')
const extend = require('extend')
const assert = require('assert')
const thunky = require('thunky')
const debug = require('debug')('little-box:source')
const pump = require('pump')
const ram = require('random-access-memory')
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
   */
  static defaults() {
    return extend(true, Origin.defaults(), {
      encryptionKey: null,
      highWaterMark: 1024,
      indexing: true,
      nonce: null
    })
  }

  /**
   */
  [Box.options](opts) {
    super[Box.options](opts)

    const u = url.parse(opts.uri)

    try {
      if ('file:' !== u.protocol) {
        fs.accessSync(opts.uri)
        u.protocol = 'file:'
        opts.uri = url.format(u)
      }
    } catch (err) {
      void err
    }
  }

  /**
   */
  [Box.init](opts) {
    super[Box.init](opts)

    this.uri = opts.uri
  }

  /**
   */
  [Box.codec](opts) {
    return null
  }

  /**
   */
  [Box.storage](storage, opts) {
    return source(this.uri, storage)
  }

  /**
   */
  [Box.ready](opts, done) {
    super[Box.ready](opts, (err) => {
      if (err) { return done(err) }
      this.feed.ready(() => {
        this[kSourceStream](opts, (err, stream) => {
          pump(stream, this.createWriteStream(), done)
        })
      })
    })
  }

  /**
  */
  [kSourceStream](opts, done) {
    get(this.uri, opts, done)
  }
}

/**
*/
function createSource(...args) {
  return new Source(...args)
}

/**
 */
Source.stream = kSourceStream

/**
 * Module exports.
 */
module.exports = Object.assign(createSource, {
  Source,
})