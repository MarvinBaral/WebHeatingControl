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
const assemblePage = function (fileToEmbed) {
	var content = fs.readFileSync(fileHeader, 'utf-8') + fs.readFileSync(fileToEmbed, 'utf-8') + fs.readFileSync(fileFooter, 'utf-8');
	return content;
};
const toggleLED = function() {
	statusLED = 1 - statusLED;	
	fs.writeFileSync(fileLED, statusLED);
};

//global variables
//====================================================

var statusLED = 0;

//the temperature regulation
//====================================================

var main = function () {
	/* example code
	if (temp >= targetTemp) {
		//burner off
	} else {
		//burner on
	}
	*/
	toggleLED(); //to visualize activity (like heartbeat, but only for this application)
};
setInterval(main, 1000);

//the normal webserver stuff
//====================================================

//app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function (req, res) {
	res.contentType('text/html');
	res.send(assemblePage(fileIndex));
});

app.get('/*.css', function (req, res) {
	res.contentType('text/css');
	var filename = req.path;
	res.sendFile(rootDir + filename);
});

app.get('/temp', function (req, res) {
	res.contentType('text/plain');
	exec('/opt/vc/bin/vcgencmd measure_temp', function (error, stdout, stderr) {
		var temp = stdout;
		temp = temp.replace('temp=', '');
		temp = temp.replace("'C", '');
		res.send(temp);
	});
});

app.listen(80);

