'use strict';

var net   = require('net');
var debug = require('debug')('instrumental');

const VERSION = require('../package.json').version;

class Instrumental {

  constructor() {
    this.queuedCalls = [];
    this.enabled = false;
  }

  configure(options){
    this.apiKey  = options.apiKey;
    this.enabled = options.enabled === undefined ? true : options.enabled;
    this.host    = options.host || 'collector.instrumentalapp.com';
  }

  connect(){
    if(this.socket){ return; }

    debug('Opening Instrumental connection');
    this.socket = net.createConnection({ host: this.host, port: 8000 });
    this.socket.setEncoding('ascii');

    this.socket.on('connect', () => {
      debug('Authenticating Instrumental connection');
      this.socket.write('hello version node/instrumental_agent/' + VERSION + '\n' +
                        'authenticate ' + this.apiKey + '\n');
    });

    this.socket.on('error', (err) => {
      debug('Connection Error ' + err);
    });

    this.socket.on('close', (hadError) => {
      debug('Closing Instrumental connection - ' + hadError);
      if (hadError) { this.socket.destroy(); }
      this.socket.removeAllListeners();
      this.connected = false;
      this.socket = null;
      if(this.queuedCalls.length > 0){
        setTimeout(() => { this.connect(); }, 5000);
      }
    });

    this.socket.on('data', (data) => {
      if (data === 'ok\nok\n') {
        debug('Instrumental connected!');
        this.connected = true;
        this.socket.write(this.queuedCalls.join('\n'));
        this.queuedCalls = [];
      } else if (data === 'ok\nfail\n') {
        debug('Instrumental authentication failed!');
        this.connected = false;
        this.socket.end();
      } else {
        debug('Unexpected response received - ' + data);
      }
    });
  }

  apiCall(type, metric, value, time, count){
    if(!this.enabled){ return; }
    if(!time){ time = Date.now(); }
    setImmediate(() => { this.apiCallInner(type, metric, value, time, count); });
  }

  apiCallInner(type, metric, value, time, count){
    if(!metric){
      debug('Metric name required');
      return;
    }

    value = Number(value);
    if(!isFinite(value)){
      debug('Metric value is invalid');
      return;
    }

    if(count === null || count === undefined){ count = 1; }
    count = Number(count);
    if(!isFinite(count)){
      debug('Metric count is invalid');
      return;
    }

    if(!time){ time = Date.now(); }
    time = Math.round(Number(time) / 1000);

    var line = [type, metric, value, time, count].join(' ') + '\n';
    if(this.connected){
      this.socket.write(line);
    } else {
      if(!this.socket){ this.connect(); }
      if(this.queuedCalls.length > 1000){
        debug('Queue too large - dropping metric');
        return;
      }
      this.queuedCalls.push(line);
    }
  }

  noticeApiCallInner(type, time, duration, desc) {
    if(!this.enabled){ return; }
    if (!time) {
      time = Date.now();
    }
    time = Math.round(Number(time) / 1000);
    if(duration === null || duration === undefined){ duration = 0; }
    duration = Number(duration);
    if(!isFinite(duration)){
      debug('duration is invalid');
      return;
    }

    var line = [type, time, duration, desc].join(' ') + '\n';
    if (this.connected) {
      this.socket.write(line);
    }
    else {
      if (!this.socket) {
        this.connect();
      }
      if (this.queuedCalls.length > 1000) {
        debug('Queue too large - dropping notice event');
        return;
      }
      this.queuedCalls.push(line);
    }
  }

  increment(metric, value, time, count){
    if(value === 0){ return; }
    if(value === null || value === undefined){ value = 1; }
    this.apiCall('increment', metric, value, time, count);
  }

  gauge(metric, value, time, count){
    this.apiCall('gauge', metric, value, time, count);
  }

  notice(time, duration, description) {
    if (!time) {
    time = Date.now();
    }
     setImmediate(() => {
    this.noticeApiCallInner('notice', time, duration, description);
    });
  }

}

module.exports = Instrumental;
