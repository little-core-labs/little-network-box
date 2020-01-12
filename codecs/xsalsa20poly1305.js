const secretbox = require('secretbox-encoding')

function codec(opts) {
  const key = opts.encryptionKey || opts.key
  return secretbox(key)
}

module.exports = codec
