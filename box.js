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
const kBoxDefaults = Symbol('Box.defaults')
const kBoxStorage = Symbol('Box.storage')
const kBoxOptions = Symbol('Box.options')
const kBoxCodec = Symbol('Box.codec')
const kBoxReady = Symbol('Box.ready')
const kBoxWrite = Symbol('Box.write')
const kBoxClose = Symbol('Box.close')
const kBoxOpen = Symbol('Box.open')
const kBoxInit = Symbol('Box.init')

/**
 * The `Box` class represents a container for a hypercore feed.
 * This class serves as the base class for the `Edge`, `Origin`, `Reader`
 * `Send`, and `Receive`classes.
 * @public
 * @class Box
 * @extends EventEmitter
 */
class Box extends EventEmitter {

  /**
   * Default options for the class instance.
   * @public
   * @static
   * @param {Object} opts
   * @return {Object}
   */
  static defaults(opts) {
    return extend(true, {}, opts)
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

    // use the `Box.codec` symbol from the instance if
    // a codec is not given by default
    const { codec = this[kBoxCodec] } = opts

    // defaults
    extend(true, opts, this.constructor.defaults(), opts)

    this[kBoxOptions](opts)

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

    if (!opts.valueEncoding && 'function' === typeof codec) {
      opts.valueEncoding = codec.call(this, opts)
    }

    // storage factory
    this.storage = this[kBoxStorage](storage, opts)

    // hypercore factory
    this.feed = this[kBoxHypercore](opts)(this.storage, key, opts)

    this.feed.on('extension', this.onextension)
    this.feed.on('download', this.ondownload)
    this.feed.on('upload', this.onupload)
    this.feed.on('append', this.onappend)
    this.feed.on('close', this.onclose)
    this.feed.on('error', this.onerror)
    this.feed.on('sync', this.onsync)
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
    return this.feed ? this.feed.key : null
  }

  /**
   * Box instance Hypercore feed secret key accessor.
   * @public
   * @accessor
   * @type {?(Buffer)}
   */
  get secretKey() {
    return this.feed ? this.feed.secretKey : null
  }

  /**
   * Box instance Hypercore feed discovery key accessor.
   * @public
   * @accessor
   * @type {?(Buffer)}
   */
  get discoveryKey() {
    return this.feed ? this.feed.discoveryKey : null
  }

  /**
   * Box instance Hypercore feed noise protocol key pair accessor.
   * @public
   * @accessor
   * @type {?(Object<String, Buffer>)}
   */
  get noiseKeyPair() {
    return this.feed ? this.feed.noiseKeyPair : null
  }

  /**
   * Box instance Hypercore feed stats accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get stats() {
    return this.feed ? this.feed.stats : null
  }

  /**
   * Box instance Hypercore feed extensions accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get extensions() {
    return this.feed ? this.feed.extensions : null
  }

  /**
   * Box instance Hypercore feed live accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get live() {
    return this.feed ? this.feed.live : null
  }

  /**
   * Box instance Hypercore feed sparse accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get sparse() {
    return this.feed ? this.feed.sparse : null
  }

  /**
   * Box instance Hypercore feed readable accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get readable() {
    return this.feed ? this.feed.readable : null
  }

  /**
   * Box instance Hypercore feed writable accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get writable() {
    return this.feed ? this.feed.writable : null
  }

  /**
   * Box instance Hypercore feed opened accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get opened() {
    return this.feed ? this.feed.opened : null
  }

  /**
   * Box instance Hypercore feed closed accessor.
   * @public
   * @accessor
   * @type {?(Object)}
   */
  get closed() {
    return this.feed ? this.feed.closed : null
  }

  /**
   * Box instance Hypercore feed length accessor.
   * @public
   * @accessor
   * @type {Number}
   */
  get length() {
    return this.feed ? this.feed.length : 0
  }

  /**
   * Box instance Hypercore feed byte length accessor.
   * @public
   * @accessor
   * @type {Number}
   */
  get byteLength() {
    return this.feed ? this.feed.byteLength : 0
  }

  /**
   * Box instance origin predicate accessor used to determine who
   * the initiator is during feed Hypercore replication.
   * @public
   * @accessor
   * @type {Number}
   */
  get isOrigin() {
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
   * @public
   * @method
   * @param {Object|Boolean} opts
   * @param {?(Mixed)} ...args
   * @return {Stream}
   */
  replicate(opts, ...args) {
    const isInitiator = 'boolean' === typeof opts
      ? opts
      : !this.isOrigin

    opts = 'boolean' === typeof opts
      ? args[0]
      : opts

    const { stream, upload, download, encrypt, live, initiator } = opts

    return this.feed.replicate(isInitiator, {
      initiator,
      download,
      encrypt,
      stream,
      upload,
      live,
    })
  }

  /**
   * Waits for Hypercore feed to be updated.
   * Calls `feed.update(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  update(...args) {
    this.ready(() => this.feed.update(...args))
  }

  /**
   * Closes Hypercore feed..
   * Calls `feed.close(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  close(...args) {
    this.ready(() => this.feed.close(...args))
  }

  /**
   * Appends log to Hypercore feed.
   * Calls `feed.append(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  append(...args) {
    this.ready(() => this.feed.append(...args))
  }

  /**
   * Calls an extension on the Hypercore feed.
   * Calls `feed.extension(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  extension(...args) {
    this.ready(() => this.feed.extension(...args))
  }

  /**
   * Downloads data to Hypercore feed.
   * Calls `feed.download(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  download(...args) {
    this.ready(() => this.feed.download(...args))
  }

  /**
   * Undownloads data to Hypercore feed.
   * Calls `feed.undownload(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  undownload(...args) {
    this.ready(() => this.feed.undownload(...args))
  }

  /**
   * Requests head of Hypercore feed.
   * Calls `feed.head(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  head(...args) {
    this.ready(() => this.feed.head(...args))
  }

  /**
   * Requests buffer at index in Hypercore feed.
   * Calls `feed.get(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  get(...args) {
    this.ready(() => this.feed.get(...args))
  }

  /**
   * Requests audit of Hypercore feed.
   * Calls `feed.audit(...args)`
   * @public
   * @method
   * @param {...Mixed} ...args
   * @return {undefined}
   */
  audit(...args) {
    this.ready(() => this.feed.audit(...args))
  }

  /**
   * Creates a read stream from the Hypercore feed
   * Calls `feed.createReadStream(opts)`
   * @public
   * @method
   * @param {Object} opts
   * @return {?(Stream)}
   */
  createReadStream(...args) {
    return this.feed.createReadStream(...args)
  }

  /**
   * Creates a read stream from the Hypercore feed
   * Calls `feed.createReadStream(opts)`
   * @public
   * @method
   * @param {Object} opts
   * @return {?(Stream)}
   */
  createWriteStream(...args) {
    return this.feed.createWriteStream(...args)
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
  onappend(...args) {
    this.emit('append', ...args)
  }

  /**
   * Level 1 `extension` event handler that emits a 'extension'
   * event.
   * @private
   * @emits extension
   */
  onextension(...args) {
    this.emit('extension', ...args)
  }

  /**
   * Level 1 `download` event handler that emits a 'download'
   * event.
   * @private
   * @emits download
   */
  ondownload(...args) {
    this.emit('download', ...args)
  }

  /**
   * Level 1 `upload` event handler that emits a 'upload'
   * event.
   * @private
   * @emits upload
   */
  onupload(...args) {
    this.emit('upload', ...args)
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
   */
  onwrite(index, data, peer, done) {
    const { feed, hooks } = this
    const batch = new Batch().concurrency(1)

    for (const hook of hooks) {
      batch.push((next) => {
        hook.call(feed, index, data, peer, next)
      })
    }

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
 * The `Box.hypercore` symbol for the hypercore factory method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.hypercore = kBoxHypercore

/**
 * The `Box.defaults` symbol for the `defaults()` method.
 * @public
 * @static
 * @type {Symbol}
 */
Box.defaults = kBoxDefaults

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
  Box
})
