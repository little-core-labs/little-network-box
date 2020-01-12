const xsalsa20 = require('hypercore-xsalsa20-onwrite-hook')
const from = require('random-access-storage-from')

function hook(box, opts) {
  const nonces = from(opts.nonces)
  const key = Buffer.from(opts.encryptionKey || opts.key).slice(0, 32)
  return xsalsa20(nonces, key)
}

module.exports = hook
