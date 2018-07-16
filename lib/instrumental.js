'use strict';

const VERSION = require('../package.json').version;
const net     = require('net');
const debug   = require('debug')('instrumental');

// config constants
const DEFAULT_HOST = 'collector.instrumentalapp.com';

class Instrumental {

  constructor() {
    this.queuedCalls = [];
    this.enabled = false;
  }

  /**
   * Setup your agent to start reporting metrics.
   * @param {Object} options - configuration options
   * @param {string} options.apiKey - the project api key - see: https://instrumentalapp.com/docs/tokens
   * @param {boolean} [options.enabled=true] - whether to report metrics to Instrumental or simply log them
   * @param {string} [options.host=collector.instrumentalapp.com] - the instrumental collector to which you wish to record metrics
   * @param {number} [options.timeout=undefined] - the socket timeout used by the agent when reporting metrics
   */
  configure(options) {
    this.apiKey  = options.apiKey;
    this.enabled = options.enabled === undefined ? true : options.enabled;
    this.host    = options.host || DEFAULT_HOST;
    this.timeout = options.timeout;
  }

  connect() {
    if (this.socket) { return; }

    debug('Opening Instrumental connection');

    this.socket = new net.Socket();
    this.socket.connect(8000, this.host);

    this.socket.setEncoding('ascii');
    
    if (this.timeout) { this.socket.setTimeout(this.timeout); }

    this.socket.on('connect', () => {
      debug('Authenticating Instrumental connection');
      this.socket.write('hello version node/instrumental_agent/' + VERSION + '\n' +
                        'authenticate ' + this.apiKey + '\n', 'ascii');
    });

    this.socket.on('timeout', () => {
      debug('Instrumental connection timed out');
      this.disconnect();
    });

    this.socket.on('error', (err) => {
      debug('Connection Error ' + err);
    });

    this.socket.on('close', (hadError) => {
      debug('Closing Instrumental connection - ' + hadError);
      this.disconnect(hadError);
      if (this.queuedCalls.length > 0) {
        setTimeout(() => { this.connect(); }, 5000);
      }
    });

    this.socket.on('data', (data) => {
      if (data === 'ok\nok\n') {
        debug('Instrumental connected!');
        this.connected = true;
        this.socket.write(this.queuedCalls.join('\n'), 'ascii');
        this.queuedCalls = [];
      } else if (data === 'ok\nfail\n') {
        debug('Instrumental authentication failed!');
        this.disconnect();
      } else {
        debug('Unexpected response received - ' + data);
      }
    });
  }

  disconnect(hard) {
    if (!this.socket) { return; }

    if (hard) {
      this.socket.destroy();
    } else {
      this.socket.end();
    }
    this.socket.removeAllListeners();
    this.socket.unref();
    this.connected = false;
    this.socket = null;
  }

  record(metricParts) {
    const line = metricParts.join(' ') + '\n';
    if (this.connected) {
      this.socket.write(line, 'ascii');
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

  /**
   * Report an increment metric to Instrumental. See: https://instrumentalapp.com/docs/metrics#metric-types
   * @param {string} metric - metric to be incremented i.e. 'foo.bar'
   * @param {number} [value=1] - amount by which to increment
   * @param {number} [time=Date.now()] - time at which the increment is recorded - format: milliseconds since epoch
   * @param {number} [count=1] - integer number of increments this represents - useful in backfill situations where you report aggregated increment values and counts
   */
  increment(metric, value, time, count) {
    if (value === 0) { return; }
    if (value === null || value === undefined) { value = 1; }
    this.apiCall('increment', metric, value, time, count);
  }

  /**
   * Report a gauge metric to Instrumental. See: https://instrumentalapp.com/docs/metrics#metric-types
   * @param {string} metric - metric being measured i.e. 'foo.bar'
   * @param {number} value - value measured at point in time - for recording multiple (count > 1), the value should be the sum of all the measured points
   * @param {number} [time=Date.now()] - time at which the gauge is recorded - format: milliseconds since epoch
   * @param {integer} [count=1] - integer number of gauges this represents
   */
  gauge(metric, value, time, count) {
    this.apiCall('gauge', metric, value, time, count);
  }

  /**
   * Report a notice to Instrumental. See: https://instrumentalapp.com/docs/notices
   * @param {string} description - text of note to record
   * @param {number} [time=Date.now()] - time at which notice starts - format: milliseconds since epoch
   * @param {number} [duration=0] - the length of time the notice should span - format: seconds notice will span on graphs after the start time
   */
  notice(description, time, duration) {
    this.apiCall('notice', description, duration, time);
  }

}

module.exports = Instrumental;
