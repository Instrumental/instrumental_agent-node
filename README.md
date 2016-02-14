# Instrumental for Node

A node.js agent for instrumentalapp.com.

## Installation

````
npm install instrumental-node
````

## Usage

You will need to set the api key to your api key.  Use 'enabled' to control if the agent actually reports (useful for disabling for dev/staging environments).

````javascript
var I = require('instrumental')
I.configure({
	// from here: https://instrumentalapp.com/docs/setup
	apiKey			: 'your_api_key',

	// optional, default shown
	host				: 'collector.instrumentalapp.com',

	// optional, default shown
	enabled			: true,
});

I.increment('metric.name' /*, value = 1, time = now, count = 1 */);

I.gauge('metric.name', 82.12 /*, time = now, count = 1 */);
````
