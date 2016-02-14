'use strict';

var Instrumental = require('../lib/instrumental');
var mitm = require('mitm');
require('should');

describe('Instrumental', function() {
  beforeEach(function() { this.mitm = mitm(); });
  afterEach(function() { this.mitm.disable(); });

  it('should send gauge calls correctly', function(done) {
    var expectedData = [
      ['hello version node/instrumental_agent/0.1.0\nauthenticate test\n', 'ok\nok\n'],
      ['gauge test.metric 5 1455477257 1\n']];
    var index = 0;

    var I = new Instrumental();
    I.configure({apiKey: 'test', enabled: true});

    this.mitm.on('connection', (socket) => {
      socket.on('data', (data) => {
        data.toString().should.equal(expectedData[index][0]);
        if(expectedData[index][1])
        { socket.write(expectedData[index][1]); }

        index++;
        if(index === 2) {
          expectedData.push(['gauge test.metric2 0 ' +
            Math.round(Date.now()/1000) + ' 1\n']);
          I.gauge('test.metric2', 0);
        } else if(index === 3) {
          done();
        }
      });
    });

    I.gauge('test.metric', 5, new Date(1455477257165));
  });

  it('should send increment calls correctly', function(done) {
    var expectedData = [
      ['hello version node/instrumental_agent/0.1.0\nauthenticate test\n', 'ok\nok\n'],
      ['increment test.metric 5 1455477257 1\n']];
    var index = 0;

    var I = new Instrumental();
    I.configure({apiKey: 'test', enabled: true});

    this.mitm.on('connection', (socket) => {
      socket.on('data', (data) => {
        data.toString().should.equal(expectedData[index][0]);
        if(expectedData[index][1])
        { socket.write(expectedData[index][1]); }

        index++;
        if(index === 2) {
          expectedData.push(['increment test.metric2 1 ' +
            Math.round(Date.now()/1000) + ' 1\n']);
          I.increment('test.metric2');
        } else if(index === 3) {
          done();
        }
      });
    });

    I.increment('test.metric', 5, new Date(1455477257165));
    I.increment('discard.cause.zero', 0);
  });

});
