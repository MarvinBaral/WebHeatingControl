#!/usr/bin/env node

//webserver to control a heating

//global constants
//====================================================

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs'); //file-system
const exec = require('shelljs').exec;
const rootDir = '/root/heating/'
const fileHeader = rootDir + 'header.html';
const fileFooter = rootDir + 'footer.html';
const fileIndex = rootDir + 'index.html';
const fileLED = '/sys/class/leds/led0/brightness'; //for RaspberryPi
const dirGPIO = 'sys/class/gpio/';
const assemblePage = function(fileToEmbed) {
	var content = fs.readFileSync(fileHeader, 'utf-8') + fs.readFileSync(fileToEmbed, 'utf-8') + fs.readFileSync(fileFooter, 'utf-8');
	return content;
};
const fillWithVariables = function(content) { //http://www.w3schools.com/jsref/jsref_obj_regexp.asp
	var matches = content.match(/__<<\S*>>__/g);
	if (matches !== null) {
		console.log("occurences: " + matches.length);
		for (i = 0; i < matches.length; i++) {
			var match = matches[i];
			match = match.replace('__<<', '').replace('>>__', '');
			var matchValue = properties[match];
			content = content.replace(matches[i], matchValue);
			console.log("replaced " + matches[i] + " with " + matchValue);	
		}
	}
	return content;
};
const toggleLED = function() {
	statusLED = 1 - statusLED;	
	fs.writeFileSync(fileLED, statusLED);
};
const initGPIO_Async = function(pin, direction) { //direction: 'in' or 'out' 
	fs.writeFile(dirGPIO + 'export', pin, function() {
		console.log('wrote into export');
		fs.writeFile(dirGPIO + 'gpio' + pin + '/' + 'direction', direction, function() {
			console.log('wrote into direction');
		});
	});
};
const writeGPIO = function(gpio, value) {
	fs.writeFileSync(dirGPIO + 'gpio' + gpio + '/' + 'value', value);
	console.log('wrote into value');
};
const readGPIO = function(gpio) {
	return fs.readFileSync(dirGPIO + 'gpio' + gpio + '/' + 'value');
};

//global variables
//====================================================

var statusLED = 0;
var properties = { //Object
	cpu_temp: 0,
	burner_status: 0,
	pump_status: 0
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

//init
//====================================================

console.log("short befor initing gpios");
for (i = 0; i < pins.length; i++) {
	initGPIO_Async(pins[i], 'out');
	console.log("inited gpio " + i);
}

//the temperature regulation
//====================================================

var main = function () {
	exec('/opt/vc/bin/vcgencmd measure_temp', function (error, stdout, stderr) {
		var temp = stdout;
		temp = temp.replace('temp=', '');
		temp = temp.replace("'C", '');
		properties.cpu_temp = temp;
	});
	toggleLED(); //to visualize activity (like heartbeat, but only for this application)
};
setInterval(main, 1000);

//the normal webserver stuff
//====================================================

//app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function (req, res) {
	res.contentType('text/html');
	res.send(fillWithVariables(assemblePage(fileIndex)));
});

app.get('/*.css', function (req, res) {
	res.contentType('text/css');
	var filename = req.path;
	res.sendFile(rootDir + filename);
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
