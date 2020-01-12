const secretbox = require('secretbox-encoding')

function codec(opts) {
  const key = Buffer.from(opts.encryptionKey || opts.key).slice(0, 32)
  return secretbox(key)
}

module.exports = codec
