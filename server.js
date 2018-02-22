var express = require('express');
var app = express();
var path = require('path');
var request = require('request');
var lifx = require('lifx-http-api');
var bulbId = process.env.BULB_ID;
var googleKey = process.env.TRAFFIC_MATRIX_KEY;
var origin = process.env.ROUTE_ORIGIN;
var destination = process.env.ROUTE_DESTINATION;
var distanceMarixEndpoint = 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&mode=driving&departure_time=now&origins=' + origin + '&destinations=' + destination + '&key=' + googleKey;
var isBulbOn = false;
var bulbColors = {
  white: {
    power: 'on',
    color: 'kelvin:3000',
    brightness: 0.1
  },
  green: {
    power: 'on',
    color: 'hue:85 saturation:1.0',
    brightness: 0.1
  },
  yellowgreen: {
    power: 'on',
    color: 'hue:65 saturation:1.0',
    brightness: 0.1
  },
  yellow: {
    power: 'on',
    color: 'hue:55 saturation:1.0',
    brightness: 0.1
  },
  yellowred: {
    power: 'on',
    color: 'hue:48 saturation:1.0',
    brightness: 0.1
  },
  red: {
    power: 'on',
    color: 'hue:10 saturation:1.0',
    brightness: 0.1
  }
};
var currentTime = {
	hour: 0,
	minutes: 0
};
var isCommuteWindow = false;
var isDefaultWindow = false;
var isOffWindow = false;
var isWeekend = false;

var port = process.env.PORT || 3000;

// Init bulb
var bulb = new lifx({
  bearerToken: process.env.BEARER_TOKEN
});

function setup() {
	console.log('running setup...');
	console.log('starting loop');
  setInterval(loop, 60000); // loop every 1 min
}

function loop() {
  console.log('looping');
	bulb.listLights(bulbId).then(function(results) {
		// Exit function if bulb is not reachable
		if (results.connected === false) {
			console.log('light is not connected');
			return;
    }
    console.log('activating light based on time');
		setTimeWindows();
	}, errHandler);
}

// Log errors
var errHandler = function (err) {
  console.log(err);
}

// Resolve traffic data and update bulb color accordingly
function displayCommuteConditions() {
  var trafficDataPromise = getTrafficData(distanceMarixEndpoint);

  trafficDataPromise.then(JSON.parse, errHandler)
    .then(function (result) {
      userDetails = result;
      return userDetails;
    }, errHandler)
    .then(function (data) {
      travelTime = convertTrafficDurationValue(data);
      console.log('Travel time: ', travelTime);
      runTrafficProgram(travelTime);
    }, errHandler);
}

// Convert Google's duration in traffic to rounded minute value
function convertTrafficDurationValue(data) {
	console.log('converting traffic time');
	var value = data.rows[0].elements[0].duration_in_traffic.value;
	return Math.floor(value / 60);
}

// Get traffic data
function getTrafficData(url) {
  // Setting URL and headers for request
  var options = {
    url: url,
    headers: {
      'User-Agent': 'request'
    }
  };
  // Return new promise
  return new Promise(function (resolve, reject) {
    // Do async job
    request.get(options, function (err, resp, body) {
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    })
  })
}

// Set bulb color according to commute time
function runTrafficProgram(travelTime) {
  console.log('setting bulb color according to a travel time of ', travelTime);
  if (travelTime >= 48) {
    console.log('traffic sucks');
    setBulbColor(bulbColors.red);
  } else if (travelTime >= 41) {
    console.log('traffic sucks some');
    setBulbColor(bulbColors.yellowred);
  } else if (travelTime >= 34) {
    console.log('traffic sucks a little');
    setBulbColor(bulbColors.yellow);
  } else if (travelTime >= 28) {
    console.log('traffic is not that bad');
    setBulbColor(bulbColors.yellowgreen);
  } else {
    console.log('no traffic');
    setBulbColor(bulbColors.green);
  }
}

// Set bulb color
function setBulbColor(colorObj) {
	bulb.setState(bulbId, colorObj).then(console.log('color changed'), errHandler);
}

// Set time windows based on current time
function setTimeWindows() {
  console.log('setTimeWindow');
  getTime();

  // Check if it's the weekend, and if it is, turn the bulb off and exist the function
  if (isWeekend) {
    turnBulbOff();
    return;
  }

  if(currentTime.hour >= 1 && currentTime.hour < 9) {
    turnBulbOff();
  } else if (currentTime.hour >= 9 && currentTime.hour < 17) {
    if (currentTime.hour === 9 && currentTime.minutes < 30) {
      turnBulbOff();
    } else {
      turnBulbOn();
    }
  } else if (currentTime.hour >= 17 && currentTime.hour < 24) {
    if (currentTime.hour === 17 && currentTime.minutes < 30) {
      turnBulbOn();
    } else {
      displayCommuteConditions();
    }
  } else if (currentTime.hour === 24) {
    turnBulbOff();
  }
}

// Set current time object
function getTime() {
	now = new Date();
  console.log('get time: ', now);
	currentTime.hour = now.getHours();
	currentTime.minutes = now.getMinutes();
	dayOfTheWeek = now.getDay();

	if (dayOfTheWeek === 7 || dayOfTheWeek === 0) {
		isWeekend = true;
	} else {
		isWeekend = false;
	}
}

// Turn bulb on
function turnBulbOn() {
  console.log('turnBulbOn');
  setBulbColor(bulbColors.white);
}

// Turn bulb off
function turnBulbOff() {
  console.log('turnBulbOff');
	bulb.setState(bulbId, {power: 'off'}, errHandler);
}

app.route('/notification').get(function(req, res){
	console.log('PURPLE!');
	// flash bulb purple
	bulb.pulse(bulbId, {
		color: 'hue:295 saturation:1.0',
	    period: 0.5,
	    cycles: 3,
	    persist: false,
	    power_on: false,
	    peak: 0.8
	});

  res.sendStatus(200)
});

app.route('/').get(function(req, res){
  res.sendFile(path.join(__dirname + '/index.html'));
});

// Run app
app.listen(port);
setup();
