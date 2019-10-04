const xsalsa20 = require('xsalsa20-encoding')

function codec(opts) {
  const { nonce } = opts
  const key = opts.encryptionKey || opts.key
  return xsalsa20(nonce, key)
}

module.exports = codec
