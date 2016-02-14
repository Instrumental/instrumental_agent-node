# Instrumental for Node

A [Node.js](https://nodejs.org/en/) agent for [Instrumental](https://instrumentalapp.com/).

## Installation

````
npm install instrumental-node
````

## Usage

You will need to set the api key to your api key. API keys can be found on [the setup page](https://instrumentalapp.com/docs/setup) or in your project's settings page. Use the 'enabled' flag to control if the agent actually reports. This is useful for not reporting in dev/test/staging/etc. environments.

````javascript
var I = require('instrumental-node');
I.configure({
	// from here: https://instrumentalapp.com/docs/setup
	apiKey			: 'your_api_key',

	// optional, default shown
	host			: 'collector.instrumentalapp.com',

	// optional, default shown
	enabled			: true,
});

I.increment('metric.name' /*, value = 1, time = now, count = 1 */);

I.gauge('metric.name', 82.12 /*, time = now, count = 1 */);
````

# Contributing

Make a PR! Say roughly what you've changed, why you did so, and any ancillary data you have like gotchas, issues you suspect, awesomeness, etc.

# Releasing

* Sign up for npmjs.com
* merge PR into master
* bump version
* update Changelog
* `npm publish` !
