const assert = require('assert')
const ram = require('random-access-memory')
const raf = require('random-access-file')

/**
 */
function storage(target, defaultStorage, dataStorage) {
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
    } else {
      return defaultStorage(filename)
    }
  }
}

module.exports = storage
