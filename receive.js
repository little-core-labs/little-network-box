const { Reader } = require('./reader')
const duplexify = require('duplexify')
const { Box } = require('./box')
const collect = require('collect-stream')
const codecs = require('./codecs')
const assert = require('assert')
const path = require('path')
const pump = require('pump')
const tar = require('tar-stream')

/**
 * The `ReceiveReader` class TBD
 * @class ReceiveReader
 * @extends Reader
 */
class ReceiveReader extends Reader {

  /**
   */
  [Box.codec](opts) {
    const { encryptionKey, nonce } = opts
    assert(Buffer.isBuffer(nonce))
    assert(Buffer.isBuffer(encryptionKey))
    return codecs.xsalsa20poly1305({ nonce, encryptionKey })
  }
}

/**
 * The `Receive` class TBD
 * @class Receive
 * @extends ReceiveReader
 */
class Receive extends ReceiveReader {

  /**
   */
  unpackFile(name, opts, callback) {
    if ('function' === typeof opts) {
      callback = opts
      opts = {}
    }

    assert('function' === typeof callback)
    const stream = this.createUnpackStream(name, opts)
    collect(stream, callback)
  }

  /**
   */
  createUnpackStream(name, opts) {
    name = path.resolve('/', name)
    opts = Object.assign({ }, opts)

    const unpack = tar.extract()
    const reader = this.createReadStream(opts)
    const stream = duplexify()

    unpack.on('entry', onentry)
    stream.once('end', onend)

    pump(reader, unpack)

    return stream

    function onend() {
      unpack.removeListener('entry', onentry)
    }

    function onentry(header, source, next) {
      if (header && path.resolve(name) === path.resolve(header.name)) {
        stream.setReadable(source)
      } else {
        source.on('end', next)
        source.resume()
      }
    }
  }
}

/**
*/
function createReceive(storage, key, opts) {
  return new Receive(storage, key, opts)
}

/**
*/
module.exports = Object.assign(createReceive, {
  Receive,
})
