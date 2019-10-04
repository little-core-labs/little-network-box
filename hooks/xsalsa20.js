const xsalsa20 = require('hypercore-xsalsa20-onwrite-hook')

function hook(opts) {
  const { nonce } = opts
  const key = opts.encryptionKey || opts.key
  return xsalsa20({ nonce, key })
}

module.exports = hook
