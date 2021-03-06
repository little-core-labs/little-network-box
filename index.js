const { replicate } = require('./replicate')
const { Network } = require('./network')
const { Receive } = require('./receive')
const { Client } = require('./client')
const { Reader } = require('./reader')
const { Server } = require('./server')
const { Source } = require('./source')
const { Origin } = require('./origin')
const { Sink } = require('./sink')
const { Send } = require('./send')
const { Edge } = require('./edge')
const { Box } = require('./box')
const storage = require('./storage')
const codecs = require('./codecs')
const hooks = require('./hooks')

/**
 * The top level module exports for the 'little-network-box' module.
 * @public
 * @namespace little-network-box
 * @type {Object}
 */
module.exports = Object.assign(factory(Box), {

  // factories
  network: factory(Network),
  receive: factory(Receive),
  client: factory(Client),
  reader: factory(Reader),
  server: factory(Server),
  source: factory(Source),
  origin: factory(Origin),
  send: factory(Send),
  sink: factory(Sink),
  edge: factory(Edge),
  box: factory(Box),

  // utilities
  replicate,
  storage,
  codecs,
  hooks,

  // classes
  Receive,
  Client,
  Reader,
  Server,
  Source,
  Origin,
  Send,
  Sink,
  Edge,
  Box,
})

function factory(Class) {
  return (...args) => new Class(...args)
}
