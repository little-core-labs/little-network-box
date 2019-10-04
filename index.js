const { replicate } = require('./replicate')
const { Network } = require('./network')
const { Receive } = require('./receive')
const { Reader } = require('./reader')
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

function receive(...args) {
  return new Receive(...args)
}

module.exports = Object.assign(box, {
  replicate,
  receive,
  origin,
  edge,
  send,
  sink,

  storage,
  codecs,
  hooks,

  Receive,
  Reader,
  Origin,
  Send,
  Sink,
  Edge,
  Box,
})
