'use strict';

const VERSION = require('../package.json').version;
const net     = require('net');
const debug   = require('debug')('instrumental');

class Instrumental {

  constructor() {
    this.queuedCalls = [];
    this.enabled = false;
  }

  configure(options) {
    this.apiKey  = options.apiKey;
    this.enabled = options.enabled === undefined ? true : options.enabled;
    this.host    = options.host || 'collector.instrumentalapp.com';
  }

  connect() {
    if (this.socket) { return; }

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
      this.socket.unref();
      this.connected = false;
      this.socket = null;
      if (this.queuedCalls.length > 0) {
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

  record(metricParts) {
    const line = metricParts.join(' ') + '\n';
    if (this.connected) {
      this.socket.write(line);
    } else {
      if (!this.socket) {
        this.connect();
      }
      if (this.queuedCalls.length > 1000) {
        debug('Queue too large - dropping event');
        return;
      }
      this.queuedCalls.push(line);
    }
  }

  metricApiCallInner(type, metric, value, time, count) {
    if (!metric) {
      debug('Metric name required');
      return;
    }

    value = Number(value);
    if (!isFinite(value)) {
      debug('Metric value is invalid');
      return;
    }

    if (count === null || count === undefined) { count = 1; }
    count = Number(count);
    if (!isFinite(count)) {
      debug('Metric count is invalid');
      return;
    }

    this.record([type, metric, value, time, count]);
  }

  gaugeApiCallInner() { this.metricApiCallInner.apply(this, arguments); }
  incrementApiCallInner() { this.metricApiCallInner.apply(this, arguments); }

  noticeApiCallInner(type, description, duration, time) {
    if (!description) {
      debug('Description required');
      return;
    }

    if (duration === null || duration === undefined) { duration = 0; }
    duration = Number(duration);
    if (duration < 0) {
      debug('duration cannot be negative');
      return;
    }
    if (!isFinite(duration)) {
      debug('duration is invalid');
      return;
    }

    this.record([type, time, duration, description]);
  }

  unixTimeSeconds(time) {
    if (!time) { time = Date.now(); }
    return Math.round(Number(time) / 1000);
  }

  apiCall(type, descriptor, value, time, count) {
    if (!this.enabled) { return; }
    time = this.unixTimeSeconds(time);
    setImmediate(() => { this[`${type}ApiCallInner`](type, descriptor, value, time, count); });
  }

  increment(metric, value, time, count) {
    if (value === 0) { return; }
    if (value === null || value === undefined) { value = 1; }
    this.apiCall('increment', metric, value, time, count);
  }

  gauge(metric, value, time, count) {
    this.apiCall('gauge', metric, value, time, count);
  }

  notice(description, time, duration) {
    this.apiCall('notice', description, duration, time);
  }

}

module.exports = Instrumental;
