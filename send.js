const { Origin } = require('./origin')
const duplexify = require('duplexify')
const { Box } = require('./box')
const codecs = require('./codecs')
const assert = require('assert')
const path = require('path')
const pump = require('pump')
const zlib = require('zlib')
const tar = require('tar-stream')

// exported symbols attached to the `Send` class
const kSendPack = Symbol('Send.pack')
const kSendStream = Symbol('Send.stream')

/**
 * The `SendOrigin` class TBD
 * @class SendOrigin
 * @extends Origin
 */
class SendOrigin extends Origin {

  /**
   */
  [Box.init](opts) {
    super[Box.init](opts)
    this[kSendStream] = null
    this[kSendPack] = null
  }

  /**
   */
  [Box.codec](opts) {
    const { encryptionKey, nonce } = opts
    assert(Buffer.isBuffer(nonce))
    assert(Buffer.isBuffer(encryptionKey))
    return codecs.xsalsa20poly1305({ nonce, key: encryptionKey })
  }
}

/**
 * The `Send` class TBD
 * @class Send
 * @extends SendOrigin
 */
class Send extends SendOrigin {

  /**
   */
  packFile(name, buffer, opts, callback) {
    buffer = Buffer.from(buffer)
    if ('function' === typeof opts) {
      callback = opts
      opts = {}
    }

    if (!opts) {
      opts = {}
    }

    if (!opts.size) {
      opts.size = buffer.length
    }

    const stream = this.createPackStream(name, opts)

    if ('function' === typeof callback) {
      stream.once('close', callback)
      stream.once('error', callback)
    }

    stream.write(buffer)
    stream.end()
  }

  /**
   */
  createPackStream(name, opts) {
    assert(opts && 'object' === typeof opts)
    assert(opts.size > 0 && 'number' === typeof opts.size)
    name = path.resolve('/', name)
    opts = Object.assign({ name }, opts)

    const proxy = duplexify()

    this.lock((release) => {
      this.ready(() => {
        this.guard.wait()
        const pack = this[kSendPack] || tar.pack()
        const stream = this[kSendStream] || this.createWriteStream()
        const source = pack.entry(opts, () => {
          this.guard.continue()
        })

        if (!this[kSendStream] || !this[kSendPack]) {
          pump(pack, stream, this.onerror)
          this[kSendStream] = stream
          this[kSendPack] = pack
        }

        proxy.setReadable(false)
        proxy.setWritable(source)
        proxy.on('finish', release)
      })
    })

    return proxy
  }
}

/**
 */
Send.pack = kSendPack

/**
 */
Send.stream = kSendStream

/**
*/
function createSend(storage, key, opts) {
  return new Send(storage, key, opts)
}

/**
*/
module.exports = Object.assign(createSend, {
  Send
})
