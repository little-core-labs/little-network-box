const xsalsa20 = require('xsalsa20-encoding')

function codec(opts) {
  const key = Buffer.from(opts.encryptionKey || opts.key).slice(0, 32)
  return xsalsa20(key)
}

module.exports = codec
