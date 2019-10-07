const assert = require('assert')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const rah = require('random-access-http')
const url = require('url')

/**
 */
function storage(uri, defaultStorage, dataStorage) {
  const { protocol, pathname } = url.parse(uri)

  if (!defaultStorage) {
    defaultStorage = ram
  }

  if (!dataStorage) {
    switch (protocol) {
      case 'https:':
      case 'http:':
        dataStorage = rah
        break

      case 'file:':
      default:
        uri = pathname
        dataStorage = raf
    }
  }

  assert('string' === typeof uri,
    'uri is not a string.')

  assert('function' === typeof defaultStorage,
    'default storage is not a function.')

  assert('function' === typeof dataStorage,
    'data storage is not a function.')

  return (filename) => {
    if ('master_key' === filename || filename.startsWith('.graph')) {
      return defaultStorage(filename)
    }

    if (filename.endsWith('data')) {
      return dataStorage(uri)
    } else {
      return defaultStorage(filename)
    }
  }
}

module.exports = storage
