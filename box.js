const { EventEmitter } = require('events')
const hyperswarm = require('hyperswarm')
const Nanoguard = require('nanoguard')
const duplexify = require('duplexify')
const hypercore = require('hypercore')
const extend = require('extend')
const crypto = require('hypercore-crypto')
const thunky = require('thunky')
const Batch = require('batch')
const mutex = require('mutexify')

// quick util
const isFunction = (f) => 'function' === typeof f
const bind = (self, f, ...args) => (...rest) => f.apply(self, args.concat(rest))

// exported symbols attached to the `Box` class
const kBoxHypercore = Symbol('Box.hypercore')
const kBoxStorage = Symbol('Box.storage')
const kBoxOptions = Symbol('Box.options')
const kBoxOrigin = Symbol('box.origin')
const kBoxCodec = Symbol('Box.codec')
const kBoxReady = Symbol('Box.ready')
const kBoxWrite = Symbol('Box.write')
const kBoxClose = Symbol('Box.close')
const kBoxOpen = Symbol('Box.open')
const kBoxInit = Symbol('Box.init')

/**
 * The `Box` class represents a container for a Hypercore feed. Extending
 * classes are provided life cycle callback by implementing various
 * `Box` symbol methods like `Box.codec`, `Box.storage`, and more to customize
 * the configuration, initialization, and encryption of the Hypercore feed.
 * @public
 * @class Box
 * @extends EventEmitter
 */
class Box extends EventEmitter {

  /**
   * Default options for a Box class instance.
   * @public
   * @static
   * @param {?(Object)} defaults
   * @param {...?(Object)} overrides
   * @return {Object}
   */
  static defaults(defaults, ...overrides) {
    return extend(true, {
      storeSecretKey: false,
      live: true,
    }, defaults, ...overrides)
  }

  /**
   * `Box` class constructor.
   * @public
   * @constructor
   * @param {String|Object|RandomAccessStorage|Function} storage
   * @param {?(Buffer|String)} [key]
   * @param {?(Object)} opts
   */
  constructor(storage, key, opts) {
    super()
    this.setMaxListeners(0)

    this.onextension = bind(this, this.onextension)
    this.ondownload = bind(this, this.ondownload)
    this.onupload = bind(this, this.onupload)
    this.onappend = bind(this, this.onappend)
    this.onclose = bind(this, this.onclose)
    this.onerror = bind(this, this.onerror)
    this.onwrite = bind(this, this.onwrite)
    this.onsync = bind(this, this.onsync)

    if (storage && 'object' === typeof storage) {
      opts = storage
      key = null
      storage = null
    }

    if (!opts && 'string' !== typeof key && false === Buffer.isBuffer(key)) {
      opts = key
      key = null
    }

    if (!opts || 'object' !== typeof opts) {
      opts = {}
    }

    if ('string' !== typeof key && false === Buffer.isBuffer(key)) {
      key = null
    }

    const { onwrite } = opts

    opts = Object.assign({ }, opts, {
      onwrite: this.onwrite
    })

    if ('string' === typeof opts.key || Buffer.isBuffer(opts.key)) {
      key = opts.key
    }

    if (!opts.key && 'string' === typeof key || Buffer.isBuffer(key)) {
      opts.key = key
    }

    if (!opts.key) {
      opts.key = key
    }

    let { secretKey } = opts

    if ('string' !== typeof secretKey && false === Buffer.isBuffer(secretKey)) {
      secretKey = null
    }

    if (!key && !secretKey) {
      const keyPair = crypto.keyPair()
      key = opts.key = keyPair.publicKey
      secretKey = opts.secretKey = keyPair.secretKey
    }

    if ('string' === typeof key) {
      key = Buffer.from(key, 'hex')
    }

    if ('string' === typeof secretKey) {
      secretKey = Buffer.from(secretKey, 'hex')
    }

    if (false === Array.isArray(opts.hooks)) {
      opts.hooks = [ opts.hooks ].filter(isFunction)
    }

    if (isFunction(opts.hook)) {
      opts.hooks.push(opts.hook)
    }

    opts.key = key
    opts.secretKey = secretKey
    opts.discoveryKey = crypto.discoveryKey(opts.key)

    // defaults
    if ('function'=== typeof this.constructor.defaults) {
      opts = extend(true, this.constructor.defaults(), opts)
    }

    this[kBoxOptions](opts)

    if ('origin' in opts && 'boolean' === typeof opts.origin) {
      this[kBoxOrigin] = opts.origin
    }

    this.feed = null
    this.lock = opts.lock || mutex()
    this.guard = new Nanoguard()

    // init hooks
    this.hooks = Array.from(new Set(
      [ bind(this, this[kBoxWrite]), onwrite ]
      // `opts.hooks` should be an array of "hook constructors",
      // functions that return functions
      .concat(opts.hooks.map((hook) => hook(this, opts)))
      .filter(isFunction)
    ))

    // convert `Box.ready` symbol on instance to a "thunky"
    // function that binds the `opts` to the first argument
    this[kBoxReady] = thunky(bind(this, this[kBoxReady], opts))

    // initializer for extending class who implements the
    // `Box.init` symbol
    this[kBoxInit](opts)

    // use the `Box.codec` symbol from the instance if
    // a codec is not given by default
    const { codec = this[kBoxCodec] } = opts

    if (!opts.valueEncoding) {
      if ('function' === typeof codec) {
        opts.valueEncoding = codec.call(this, opts)
      } else if (codec && 'object' === typeof codec) {
        opts.valueEncoding = codec
      } else {
        delete opts.valueEncoding
      }
    }

    if (null === storage) {
      this.storage = null
    } else {
      // storage factory
      this.storage = this[kBoxStorage](storage, opts)
    }

    // hypercore factory
    if ('function' === typeof opts.hypercore) {
      this.feed = opts.hypercore(this.storage, key, opts)
    } else if (opts.feed && 'object' === typeof opts.feed) {
      this.feed = opts.feed
    } else {
      this.feed = this[kBoxHypercore](opts)(this.storage, key, opts)
    }

    this.feed.ready(() => {
      this.feed.on('extension', this.onextension)
      this.feed.on('download', this.ondownload)
      this.feed.on('upload', this.onupload)
      this.feed.on('append', this.onappend)
      this.feed.on('close', this.onclose)
      this.feed.on('error', this.onerror)
      this.feed.on('sync', this.onsync)
    })

    this.ready(() => {
      this.emit('ready')
      this.once('close', bind(this, this[kBoxClose], opts))
      process.nextTick(bind(this, this[kBoxOpen], opts))
    })
  }

  /**
   * Box instance Hypercore feed public key accessor.
   * @public
   * @accessor
   * @type {?(Buffer)}
   */
  get key() {
    return this.feed && this.feed.key
  }

  /**
   * Box instance Hypercore feed secret key accessor.
   * @public
   * @accessor
   * @type {?(Buffer)}
   */
  get secretKey() {
    return this.feed && this.feed.secretKey
  }

  /**
   * Box instance Hypercore feed discovery key accessor.
   * @public
   * @accessor
   * @type {?(Buffer)}
   */
  get discoveryKey() {
    return this.feed && this.feed.discoveryKey
  }

  /**
   * Box instance Hypercore feed noise key pair accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get noiseKeyPair() {
    return this.feed && this.feed.noiseKeyPair
  }

  /**
   * Box instance Hypercore feed stats accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get stats() {
    return this.feed && this.feed.stats
  }

  /**
   * Box instance Hypercore feed extensions accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get extensions() {
    return this.feed && this.feed.extensions
  }

  /**
   * Box instance Hypercore feed live accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get live() {
    return this.feed && this.feed.live
  }

  /**
   * Box instance Hypercore feed sparse accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get sparse() {
    return this.feed && this.feed.sparse
  }

  /**
   * Box instance Hypercore feed readable accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get readable() {
    return this.feed && this.feed.readable
  }

  /**
   * Box instance Hypercore feed writable accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get writable() {
    return this.feed && this.feed.writable
  }

  /**
   * Box instance Hypercore feed opened accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get opened() {
    return this.feed && this.feed.opened
  }

  /**
   * Box instance Hypercore feed closed accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get closed() {
    return this.feed && this.feed.closed
  }

  /**
   * Box instance Hypercore feed length accessor.
   * @public
   * @accessor
   * @type {Number}
   */
  get length() {
    return this.feed && this.feed.length
  }

  /**
   * Box instance Hypercore feed byte length accessor.
   * @public
   * @accessor
   * @type {Number}
   */
  get byteLength() {
    return this.feed && this.feed.byteLength
  }

  /**
   * Box instance origin predicate accessor used to determine who
   * the initiator is during feed Hypercore replication.
   * @public
   * @accessor
   * @type {Boolean}
   */
  get isOrigin() {
    if (kBoxOrigin in this) {
      return this[kBoxOrigin]
    }

    return false
  }

  /**
   * Abstract method called during initiation in the constructor
   * before the `init()` step default options that may be configured here
   * by extending classes.
   * @protected
   * @abstract
   * @method
   * @param {Object} opts
   * @return {undefined}
   */
  [kBoxOptions](opts) {
    void opts
  }

  /**
   * Abstract method called during initiation in the constructor
   * after the `options()` step with configured options.
   * @protected
   * @abstract
   * @method
   * @param {Object} opts
   * @return {undefined}
   */
  [kBoxInit](opts) {
    void opts
  }

  /**
   * Abstract method called during initiation in the constructor
   * after the `init()` step with configured options suitable for
   * initialization a value codec for the Hypercore feed.
   * @protected
   * @abstract
   * @method
   * @param {Object} opts
   * @return {undefined}
   */
  [kBoxCodec](opts) {
    void opts
  }

  /**
   * Abstract method called when the Hypercore feed has been opened
   * and is considered ready.
   * @protected
   * @abstract
   * @method
   * @param {Object} opts
   * @return {undefined}
   */
  [kBoxOpen](opts) {
    void opts
  }

  /**
   * Abstract method called when the Hypercore feed has closed.
   * @protected
   * @abstract
   * @method
   * @param {Object} opts
   * @return {undefined}
   */
  [kBoxClose](opts) {
    void opts
  }

  /**
   * Abstract method used as a write hook for a Hypercore feed.
   * @protected
   * @abstract
   * @method
   * @param {Number} index
   * @param {Buffer} data
   * @param {?(Object)} peer
   * @param {Function} done
   * @return {undefined}
   */
  [kBoxWrite](index, data, peer, done) {
    done(null)
  }

  /**
   * Abstract method for waiting and calling a callback function
   * when the instance is considered ready.
   * @protected
   * @abstract
   * @method
   * @param {Function} opts
   * @param {Function} done
   * @return {undefined}
   */
  [kBoxReady](opts, done) {
    process.nextTick(done, null)
  }

  /**
   * Abstract method for a storage factory.
   * @protected
   * @abstract
   * @method
   * @param {String|Object|Function} storage
   * @param {Object} opts
   * @return {undefined}
   */
  [kBoxStorage](storage, opts) {
    return storage
  }

  /**
   * Abstract method for a hypercore factory.
   * @protected
   * @abstract
   * @method
   * @param {Object} opts
   * @return {Function}
   */
  [kBoxHypercore](opts) {
    return hypercore
  }

  /**
   * Calls callback when instance is considered ready.
   * @public
   * @method
   * @param {Function} done
   * @return {undefined}
   */
  ready(done) {
    this.feed.ready(() => {
      this[kBoxReady](done)
    })
  }

  /**
   * Returns a Hypercore feed replication stream.
   * Calls `feed.replicate(opts)`
   * @public
   * @method
   * @param {?(Object)} opts
   * @return {Stream}
   */
  replicate(opts) {
    return this.feed.replicate(opts)
  }

  /**
   * Waits for Hypercore feed to be updated.
   * Calls `feed.update(...args)`
   * @public
   * @method
   * @param {?(Number)} length
   * @param {Function} callback
   * @return {undefined}
   */
  update(length, callback) {
    this.feed.update(length, callback)
  }

  /**
   * Closes Hypercore feed..
   * Calls `feed.close(callback)`
   * @public
   * @method
   * @param {Function} callback
   * @return {undefined}
   */
  close(callback) {
    this.feed.close(callback)
  }

  /**
   * Appends log to Hypercore feed.
   * Calls `feed.append(data, callback)`
   * @public
   * @method
   * @param {Mixed} data
   * @param {Function} callback
   * @return {undefined}
   */
  append(data, callback) {
    this.ready(() => this.feed.append(data, callback))
  }

  /**
   * Calls an extension on the Hypercore feed.
   * Calls `feed.extension(name, message)`
   * @public
   * @method
   * @param {String} name
   * @param {Buffer} message}
   * @return {Mixed}
   */
  extension(name, message) {
    return this.feed.extension(name, message)
  }

  /**
   * Downloads data to Hypercore feed.
   * Calls `feed.download(range, callback)`
   * @public
   * @method
   * @param {...Mixed} range, callback
   * @return {undefined}
   */
  download(range, callback) {
    this.ready(() => this.feed.download(range, callback))
  }

  /**
   * Undownloads data from  Hypercore feed.
   * Calls `feed.undownload(range)`
   * @public
   * @method
   * @param {Object} range
   * @return {undefined}
   */
  undownload(range) {
    this.ready(() => this.feed.undownload(range))
  }

  /**
   * Requests head of Hypercore feed.
   * Calls `feed.head(opts, callback)`
   * @public
   * @method
   * @param {?(Object} opts
   * @param {Function} callback
   * @return {undefined}
   */
  head(opts, callback) {
    this.ready(() => this.feed.head(opts, callback))
  }

  /**
   * Requests buffer at index in Hypercore feed.
   * Calls `feed.get(index, opts, callback)`
   * @public
   * @method
   * @param {Number} index
   * @param {?(Object} opts
   * @param {Function} callback
   * @return {undefined}
   */
  get(index, opts, callback) {
    this.ready(() => this.feed.get(index, opts, callback))
  }

  /**
   * Puts buffer at index with proof in Hypercore feed.
   * Calls `feed.put(index, data, proof, callback)`
   * @public
   * @method
   * @param {Number} index
   * @param {Buffer} data
   * @param {?(Object} proof
   * @param {Function} callback
   * @return {undefined}
   */
  put(index, data, proof, callback) {
    this.ready(() => this.feed.put(index, data, proof, callback))
  }

  /**
   * Requests audit of Hypercore feed.
   * Calls `feed.audit(callback)`
   * @public
   * @method
   * @param {?(Function)} callback
   * @return {undefined}
   */
  audit(callback) {
    this.ready(() => this.feed.audit(callback))
  }

  /**
   * Requests proof at index of Hypercore feed.
   * Calls `feed.proof(index, opts, callback)`
   * @public
   * @method
   * @param {Number} index
   * @param {?(Object} opts
   * @param {?(Function)} callback
   * @return {undefined}
   */
  proof(index, opts, callback) {
    this.ready(() => this.feed.proof(index, opts, callback))
  }

  /**
   * Requests downloaded range of Hypercore feed.
   * Calls `feed.downloaded(start, end)`
   * @public
   * @method
   * @param {?(Number)} start
   * @param {?(Number)} end
   * @return {undefined}
   */
  downloaded(start, end) {
    return this.feed.downloaded(start, end)
  }

  /**
   * Creates a read stream from the Hypercore feed
   * Calls `feed.createReadStream(opts)`
   * @public
   * @method
   * @param {Object} opts
   * @return {?(Stream)}
   */
  createReadStream(opts) {
    return this.feed.createReadStream(opts)
  }

  /**
   * Creates a read stream from the Hypercore feed
   * Calls `feed.createReadStream(opts)`
   * @public
   * @method
   * @return {?(Stream)}
   */
  createWriteStream() {
    return this.feed.createWriteStream()
  }

  /**
   * Level 1 `error` event handler that emits an 'error'
   * event given a "truthy" error object.
   * @private
   * @param {?(Error)} err
   * @emits error
   */
  onerror(err) {
    if (err) {
      this.emit('error', err)
    }
  }

  /**
   * Level 1 `close` event handler that emits a 'close'
   * event.
   * @private
   * @emits close
   */
  onclose() {
    this.emit('close')
  }

  /**
   * Level 1 `append` event handler that emits a 'append'
   * event.
   * @private
   * @emits append
   */
  onappend() {
    this.emit('append')
  }

  /**
   * Level 1 `extension` event handler that emits a 'extension'
   * event.
   * @private
   * @emits extension
   */
  onextension(name, message, peer) {
    this.emit('extension', name, message, peer)
  }

  /**
   * Level 1 `download` event handler that emits a 'download'
   * event.
   * @private
   * @param {Number} index
   * @param {Buffer} data
   * @emits download
   */
  ondownload(index, data) {
    this.emit('download', index, data)
  }

  /**
   * Level 1 `upload` event handler that emits a 'upload'
   * event.
   * @private
   * @param {Number} index
   * @param {Buffer} data
   * @emits upload
   */
  onupload(index, data) {
    this.emit('upload', index, data)
  }

  /**
   * Level 1 `sync` event handler that emits a 'sync'
   * event.
   * @private
   * @emits sync
   */
  onsync() {
    this.emit('sync')
  }

  /**
   * "write" hook for the instance Hypercore feed that middlewares
   * all hooks on the instance.
   * event.
   * @private
   * @param {Number} index
   * @param {Buffer} data
   * @param {?(Object)} peer
   * @param {Function} done
   * @emits write
   */
  onwrite(index, data, peer, done) {
    const { feed, hooks } = this
    const batch = new Batch().concurrency(1)

    for (const hook of hooks) {
      batch.push((next) => {
        hook.call(feed, index, data, peer, next)
      })
    }

    batch.push((next) => {
      this.emit('write', index, data, peer)
      next()
    })

    batch.end(done)
  }
}

/**
 * The `Box.options` symbol for the `options()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.options = kBoxOptions

/**
 * The `Box.init` symbol for the `init()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.init = kBoxInit

/**
 * The `Box.codec` symbol for the `codec()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.codec = kBoxCodec

/**
 * The `Box.open` symbol for the `open()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.open = kBoxOpen

/**
 * The `Box.close` symbol for the `close()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.close = kBoxClose

/**
 * The `Box.write` symbol for the `onwrite()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.write = kBoxWrite

/**
 * The `Box.ready` symbol for the `ready()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.ready = kBoxReady

/**
 * The `Box.storage` symbol for the storage factory method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.storage = kBoxStorage

/**
 * The `Box.origin` symbol for the origin (`isOrigin`) boolean predicate
 * @public
 * @static
 * @type {Symbol}
 */
Box.origin = kBoxOrigin

/**
 * The `Box.hypercore` symbol for the hypercore factory method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.hypercore = kBoxHypercore

/**
 * Factory for creating `Box` instances.
 * @public
 */
function createBox(...args) {
  return new Box(...args)
}

/**
 * Module exports.
 */
module.exports = Object.assign(createBox, {
  Box,
})
