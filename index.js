'use strict';

var util         = require('util');
var EventEmitter = require('events').EventEmitter;
var SerialPort   = require('serialport').SerialPort
var xbee_api     = require('xbee-api');
var waspmote     = require('./lib/waspmote');
var debug        = require('debug')('meshblu-xbee');

var XBEE = xbee_api.constants;

var port = "/dev/ttyUSB0";
var baud = 9600;
var api_mode = 2;

var MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    output: {
      type: 'string',
      required: true
    },
    type: {
      type: 'integer',
      required: false
    },
    destination64: {
      type: 'string',
      required: false
    },
    options: {
      type: 'integer',
      required: false
    }
  }
};

var OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    port: {
      type: 'string',
      required: true
    },
    baud: {
      type: 'integer',
      required: true
    },
    api_mode: {
      type: 'integer',
      required: false
    }
  }
};

function Plugin(){
  this.options = {};
  this.messageSchema = MESSAGE_SCHEMA;
  this.optionsSchema = OPTIONS_SCHEMA;
  return this;
}

util.inherits(Plugin, EventEmitter);

Plugin.prototype.tryXbeeParser = function() {
  var self = this;
  return function(emitter, buffer) {
    try {
      self.xbeeAPI.parseRaw(buffer);
    } catch (err) {
      if (err instanceof RangeError) {
        debug('.');
      } else {
        debug("parser error: " + err);
      }
    }
  }
}

Plugin.prototype.onMessage = function(msg){
  var self = this;

  debug('onMessage...');
  debug(msg);

  if (msg.readPorts == true) {
    self.serialPort.list(function (err, ports) {
      ports.forEach(function(port) {
        debug(port.comName);
        debug(port.pnpId);
        debug(port.manufacturer);
        self.emit("message", {devices: ['*'], payload: ports});
      });
    });
  }

  if (typeof msg.output !== 'undefined') {
    var sendFrame = {
      type: msg.type || XBEE.FRAME_TYPE.TX_REQUEST_64,
      destination64: msg.destination64 || "000000000000FFFF",
      options: msg.options || 0x00,
      data: msg.output
    };

    debug('serial writing frame: ' + util.inspect(sendFrame));

    self.serialPort.write(self.xbeeAPI.buildFrame(sendFrame), function(err, res) {
      if (err) {
        debug('serial write error: ' + err);
      }
      if (res) {
        debug('serial write result: ' + res);
      }
    });
  }
};

Plugin.prototype.onConfig = function(device){
  var self = this;
  self.setOptions(device.options||{});

  if (this.options != {}) {
    port = this.options.port || port;
    baud = this.options.baud || baud;
    if (typeof this.options.api_mode !== 'undefined') {
      api_mode = this.options.api_mode;
    }
  }

  debug('onConfig...');
  debug('port: ' + port);
  debug('baud: ' + baud);
  debug('mode: ' + api_mode);

  self.xbeeAPI = new xbee_api.XBeeAPI({
    api_mode: api_mode
  });

  self.serialPort = new SerialPort(port, {
    baudrate: baud,
    parser: self.tryXbeeParser()
  });

  self.xbeeAPI.on("frame_object", function(frame) {
    frame.parsed = false;
    frame.type = 'unknown';

    if (waspmote.isWaspFrame(frame)) {
      frame.data = waspmote.parseFrame(frame);
      frame.parsed = true;
      frame.type = 'waspframe';
    }
    // TODO: Add MQTT & COAP(?) parsing

    debug('frame received: ' + util.inspect(frame));
    self.emit("message", {devices: ['*'], payload: {frame: frame}});
 });
};

Plugin.prototype.setOptions = function(options){
  this.options = options;
};

module.exports = {
  messageSchema: MESSAGE_SCHEMA,
  optionsSchema: OPTIONS_SCHEMA,
  Plugin: Plugin
};
