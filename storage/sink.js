const assert = require('assert')
const path = require('path')
const ram = require('random-access-memory')
const raf = require('random-access-file')

function storage(sink, target, defaultStorage, dataStorage, opts) {
  if (!defaultStorage) {
    defaultStorage = ram
  }

  if (!dataStorage) {
    dataStorage = raf
  }

  assert('string' === typeof target,
    'target filename is not a string.')

  assert('function' === typeof defaultStorage,
    'default storage is not a function.')

  assert('function' === typeof dataStorage,
    'data storage is not a function.')

  return (filename) => {
    if ('master_key' === filename || filename.startsWith('.graph')) {
      return defaultStorage(filename)
    }

    if (filename.endsWith('data')) {
      return dataStorage(target)
    } else if (filename.endsWith('secret_key')) {
      return ram(sink.secretKey || opts.secretKey)
    } else if (filename.endsWith('key')) {
      return ram(sink.key || opts.key)
    } else {
      return defaultStorage(path.resolve(`${target}.${filename}`))
    }
  }
}

module.exports = storage
