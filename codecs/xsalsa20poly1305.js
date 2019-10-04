const secretbox = require('secretbox-encoding')

function codec(opts) {
  const { nonce } = opts
  const key = opts.encryptionKey || opts.key
  return secretbox(nonce, key)
}

module.exports = codec
