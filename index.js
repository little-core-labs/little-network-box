const { replicate } = require('./replicate')
const { Network } = require('./network')
const { Receive } = require('./receive')
const { Reader } = require('./reader')
const { Source } = require('./source')
const { Origin } = require('./origin')
const { Sink } = require('./sink')
const { Send } = require('./send')
const { Edge } = require('./edge')
const { Box } = require('./box')
const storage = require('./storage')
const codecs = require('./codecs')
const hooks = require('./hooks')

function box(...args) {
  return new Box(...args)
}

function send(...args) {
  return new Send(...args)
}

function sink(...args) {
  return new Sink(...args)
}

function edge(...args) {
  return new Edge(...args)
}

function origin(...args) {
  return new Origin(...args)
}

function source(...args) {
  return new Source(...args)
}

function receive(...args) {
  return new Receive(...args)
}

module.exports = Object.assign(box, {

  receive: factory(Receive),
  reader: factory(Reader),
  source: factory(Source),
  origin: factory(Origin),
  send: factory(Send),
  sink: factory(Sink),
  edge: factory(Edge),
  box: factory(Box),

  replicate,
  storage,
  codecs,
  hooks,

  Receive,
  Reader,
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
