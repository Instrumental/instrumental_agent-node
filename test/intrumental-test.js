'use strict';

const Instrumental = require('../lib/instrumental');
const mitm = require('mitm');

require('should');

const VERSION    = require('../package.json').version;
const AUTH_LINES = [`hello version node/instrumental_agent/${VERSION}\nauthenticate test\n`, 'ok\nok\n'];

describe('Instrumental', () => {
  beforeEach(function () { this.mitm = mitm(); });
  afterEach(function () { this.mitm.disable(); });

  it('should send gauge calls correctly', function (done) {
    const expectedData = [
      AUTH_LINES,
      ['gauge test.metric 5 1455477257 1\n']];
    const I = new Instrumental();
    I.configure({ apiKey: 'test', enabled: true });

    let index = 0;

    this.mitm.on('connection', (socket) => {
      socket.on('data', (data) => {
        data.toString().should.equal(expectedData[index][0]);
        if (expectedData[index][1]) { socket.write(expectedData[index][1]); }

        index++;
        if (index === 2) {
          expectedData.push(['gauge test.metric2 0 ' +
                             Math.round(Date.now() / 1000) + ' 1\n']);
          I.gauge('test.metric2', 0);
        } else if (index === 3) {
          done();
        }
      });
    });

    I.gauge('test.metric', 5, new Date(1455477257165));
  });

  it('should send increment calls correctly', function (done) {
    const expectedData = [
      AUTH_LINES,
      ['increment test.metric 5 1455477257 1\n']];
    const I = new Instrumental();
    I.configure({ apiKey: 'test', enabled: true });

    let index = 0;

    this.mitm.on('connection', (socket) => {
      socket.on('data', (data) => {
        data.toString().should.equal(expectedData[index][0]);
        if (expectedData[index][1]) { socket.write(expectedData[index][1]); }

        index++;
        if (index === 2) {
          expectedData.push(['increment test.metric2 1 ' +
                             Math.round(Date.now() / 1000) + ' 1\n']);
          I.increment('test.metric2');
        } else if (index === 3) {
          expectedData.push(['increment test.metric3 1 ' +
                             Math.round(Date.now() / 1000) + ' 1\n']);
          //this should trigger addition to the socket queue.
          I.increment('test.metric3');
          I.increment('test.metric4');
        } else if (index === 4) {
          expectedData.push(['increment test.metric4 1 ' +
                             Math.round(Date.now() / 1000) + ' 1\n']);
        } else if (index === 5) {
          done();
        }
      });
    });

    I.increment('test.metric', 5, new Date(1455477257165));
    I.increment('discard.cause.zero', 0);
  });

  it('should time a function properly and return its result', function (done) {
    const expectedData = [
      AUTH_LINES,
      ['gauge test.metric 0.01 1455477257 1\n']];
    const I = new Instrumental();
    I.configure({ apiKey: 'test', enabled: true });

    let index = 0;

    this.mitm.on('connection', (socket) => {
      socket.on('data', (data) => {
        data.toString().should.equal(expectedData[index][0]);
        if (expectedData[index][1]) { socket.write(expectedData[index][1]); }

        index++;
        if (index === 2) { done(); }
      });
    });

    const testFunction = () => {
      function sleepFor(sleepDuration) {
        const now = new Date().getTime();
        while (new Date().getTime() < now + sleepDuration) { /* do nothing */ 0; }
      }
      sleepFor(10);
      return 42;
    };
    const returnValue = I.time('test.metric', testFunction, 1, new Date(1455477257165));
    returnValue.should.equal(42);
  });

  it('should send notice calls correctly', function (done) {
    const expectedData = [
      AUTH_LINES,
      ['notice 1455477257 0 test is good\n']];
    const I = new Instrumental();
    I.configure({ apiKey: 'test', enabled: true });

    let index = 0;

    this.mitm.on('connection', (socket) => {
      socket.on('data', (data) => {
        data.toString().should.equal(expectedData[index][0]);
        if (expectedData[index][1]) { socket.write(expectedData[index][1]); }
        index++;
        if (index === 2) { done(); }
      });
    });

    I.notice('test is good', new Date(1455477257165), 0);
  });

});
