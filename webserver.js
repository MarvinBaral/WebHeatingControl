#!/usr/bin/env node

//webserver to control a heating

//global constants
//====================================================

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs'); //file-system
const exec = require('shelljs').exec;
const serial = require('serialport-js');
const rootDir = '/root/heating/'
const fileHeader = rootDir + 'header.html';
const fileFooter = rootDir + 'footer.html';
const fileIndex = rootDir + 'index.html';
const fileLED = '/sys/class/leds/led0/brightness'; //for RaspberryPi
const dirGPIO = 'sys/class/gpio/';
const svgStorage = rootDir + 'storage.svg';
const svgGraph = rootDir + 'graph.svg';
const NUM_SENSORS = 5;
const RGB_TEMP_MIN = 10;
const RGB_TEMP_MAX = 80;
const RGB_TEMP_DIFF = RGB_TEMP_MAX - RGB_TEMP_MIN
const RGBPerTemp = 255 / RGB_TEMP_DIFF;
const calcRGB = function(rgb_temperature) {
	if (rgb_temperature > RGB_TEMP_MAX) {
		rgb_temperature = RGB_TEMP_MAX;
	} else if (rgb_temperature < RGB_TEMP_MIN) {
		rgb_temperature = RGB_TEMP_MIN;
	}
	var rgb_red = Math.round((rgb_temperature - RGB_TEMP_MIN) * RGBPerTemp);
	return rgb_red + ', 0, ' + (255 - rgb_red); 	
};
const assemblePage = function(fileToEmbed) {
	var content = fs.readFileSync(fileHeader, 'utf-8') + fs.readFileSync(fileToEmbed, 'utf-8') + fs.readFileSync(fileFooter, 'utf-8');
	return content;
};
const fillWithVariables = function(string) { //http://www.w3schools.com/jsref/jsref_obj_regexp.asp
	var matches = string.match(/__<<\S*>>__/g);
	if (matches !== null) {
		for (i = 0; i < matches.length; i++) {
			var match = matches[i];
			match = match.replace('__<<', '').replace('>>__', '');
			var matchValue = properties[match];
			string = string.replace(matches[i], matchValue);
		}
	}
	return string;
};
const fillStorageWithVariables = function(string) { //http://www.w3schools.com/jsref/jsref_obj_regexp.asp
	string = string.toString();
	var matches = string.match(/__<<\S*>>__/g);
	if (matches !== null) {
		console.log("occurences: " + matches.length);
		for (i = 0; i < matches.length; i++) {
			var match = matches[i];
			match = match.replace('__<<', '').replace('>>__', '');
			var matchValue = storage[match];
			string = string.replace(matches[i], matchValue);
		}
	}
	return string;
};
const toggleLED = function() {
	statusLED = 1 - statusLED;	
	fs.writeFileSync(fileLED, statusLED);
};
const initGPIO_Async = function(pin, direction) { //direction: 'in' or 'out' 
	fs.writeFile(dirGPIO + 'export', pin, function() {
		fs.writeFile(dirGPIO + 'gpio' + pin + '/' + 'direction', direction, function() {
		});
	});
};
const writeGPIO = function(gpio, value) {
	fs.writeFileSync(dirGPIO + 'gpio' + gpio + '/' + 'value', value);
};
const readGPIO = function(gpio) {
	return fs.readFileSync(dirGPIO + 'gpio' + gpio + '/' + 'value');
};
const updateTempCPU = function() {
	exec('/opt/vc/bin/vcgencmd measure_temp', function (error, stdout, stderr) {
		var temp = stdout;
		temp = temp.replace('temp=', '');
		temp = temp.replace("'C", '');
		properties.cpu_temp = temp;
	});
};
//global variables
//====================================================

var statusLED = 0;
var properties = { //Object
	cpu_temp: 0,
	burner_status: 0,
	pump_status: 0,
	temp_outside: 0,
	temp_storage_top: 0,
	temp_storage_mid: 0,
	temp_storage_bot: 0,
	temp_to_heating_circle: 0
};
var storage = {
	temp_top: 0,
	temp_mid: 0,
	temp_bot: 0,
	rgb_top: "255, 255, 255",
	rgb_mid: "255, 255, 255",
	rgb_bot: "255, 255, 255"
};
var pinsIndex = { //Object
	LED: 0,
	pump: 1,
	burner: 2
};
var pins = [ //Array
	3,
	21,
	20
];
var sensors = [ //mapping of indexes to positions
	'temp_outside',
	'temp_storage_top',
	'temp_storage_mid',
	'temp_storage_bot',
	'temp_to_heating_circle'
];

//serialPort: https://www.npmjs.com/package/serialport2
//====================================================

serial.open('/dev/ttyACM0', start, '\n');

function start(port) {
	console.log("SerialPort opened");

	port.on('error', function(err) {
		console.log(err);
	});
 
	port.on('data', function(data) {
		var sData = data.toString();
		console.log(sData);
		var aData = sData.split(': ');
		if (aData[0] < NUM_SENSORS) {
			properties[sensors[aData[0]]] = aData[1];
		}
		
	});
};
 
//init
//====================================================

for (i = 0; i < pins.length; i++) {
	initGPIO_Async(pins[i], 'out');
}

//the temperature regulation
//====================================================

var main = function () {
	updateTempCPU();
	toggleLED(); //to visualize activity (like heartbeat, but only for this application)
};
setInterval(main, 1000);

//the normal webserver stuff
//====================================================

//app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function (req, res) {
	res.contentType('text/html');
	res.send(fillWithVariables(assemblePage(fileIndex, properties)));
});

app.get('/*.css', function (req, res) {
	res.contentType('text/css');
	var filename = req.path;
	res.sendFile(rootDir + filename);
});

app.get('/storage.svg', function (req, res) {
	storage.temp_top = properties.temp_storage_top;
	storage.temp_mid = properties.temp_storage_mid;
	storage.temp_bot = properties.temp_storage_bot;
	storage.rgb_top = calcRGB(storage.temp_top); 
	storage.rgb_mid = calcRGB(storage.temp_mid);
	storage.rgb_bot = calcRGB(storage.temp_bot);
	
	res.contentType('image/svg+xml');
	var content = fs.readFileSync(svgStorage);
	content = fillStorageWithVariables(content);

	res.send(content);
});

app.get('/graph.svg', function (req, res) {
	res.contentType('image/svg+xml');
	var content = fs.readFileSync(svgGraph);
	res.send(content);
});

app.get('/temp', function (req, res) {
	res.contentType('text/plain');
	res.send(properties["cpu_temp"]);
});

app.all('/pump', function (req, res) {
	properties.pump_status = 1 - properties.pump_status;
	writeGPIO(pins[pinsIndex.pump], properties.pump_status);
	console.log('pump');
	res.redirect(303, '/');
});

app.all('/burn', function (req, res) {
	properties.burner_status = 1 - properties.burner_status;
	writeGPIO(pins[pinsIndex.burner], properties.burner_status);
	console.log('burn');
	res.redirect(303, '/');
});

app.listen(80);
