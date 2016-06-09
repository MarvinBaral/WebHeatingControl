#!/usr/bin/env node

//webserver to control a heating

//general
//====================================================
const NUM_SENSORS = 5;

//modules
//====================================================

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs'); //file-system
const exec = require('shelljs').exec;
const serial = require('serialport-js');

//paths
//====================================================
const rootDir = '/root/heating/'
const fileHeader = rootDir + 'header.html';
const fileFooter = rootDir + 'footer.html';
const fileIndex = rootDir + 'index.html';
const fileLED = '/sys/class/leds/led0/brightness'; //for RaspberryPi
const dirGPIO = 'sys/class/gpio/';
const svgStorage = rootDir + 'storage.svg';
const svgGraph = rootDir + 'graph.svg';

//color
//====================================================
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

//templating
//====================================================
const TEMPLATING_SIGN_BEGIN = '__{{';
const TEMPLATING_SIGN_END = '}}__';
const TEMPLATING_REGEX = /__\{\{\S*\}\}__/g;
const assemblePage = function(fileToEmbed) {
	var content = fs.readFileSync(fileHeader, 'utf-8') + fs.readFileSync(fileToEmbed, 'utf-8') + fs.readFileSync(fileFooter, 'utf-8');
	return content;
};
const fillWithVariables = function(string, variables) { //http://www.w3schools.com/jsref/jsref_obj_regexp.asp
	string = string.toString();
	var matches = string.match(TEMPLATING_REGEX);
	if (matches !== null) {
		for (i = 0; i < matches.length; i++) {
			var match = matches[i];
			match = match.replace(TEMPLATING_SIGN_BEGIN, '').replace(TEMPLATING_SIGN_END, '');
			var matchValue = variables[match];
			string = string.replace(matches[i], matchValue);
		}
	}
	return string;
};

//embedded
//====================================================
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

//svg
//====================================================
var graph = {
	content: "",
	height: 0,
	width: 0,
	pDrawingArea_margin: 10,
	pDrawingArea_size: 0,
	init: function() {
		this.height = 600;
		this.width = 1200;
		this.pDrawingArea_size = (100 - (2 * this.pDrawingArea_margin));
	},
	initGraph: function() {
		//temp
		const temp_min = -20;
		const temp_max = 100;
		const temp_steps = 10;

		//general
		const drawingArea_margin_percent = this.pDrawingArea_margin;
		const drawingArea_size_percent = this.pDrawingArea_size;
		const NUM_HORIZONTAL_LINES = (temp_max - temp_min) / temp_steps;
		const PERCENT_PER_HORIZONTAL_LINE = drawingArea_size_percent / NUM_HORIZONTAL_LINES;
		const label_steps = 2; //e.g. 2 means: only every 2nd line has a label
		const label_annex = ' °C';
		const label_start_value = temp_min;
		const label_end_value = temp_max;
		const label_step_value = temp_steps;
		const label_offset = -5;
		const label_fontsize = 3; //per cent
		var label_value = label_end_value;

		graph.content += graph.svgRect(drawingArea_margin_percent + '%', drawingArea_margin_percent + '%', drawingArea_size_percent + '%' , drawingArea_size_percent + '%', 'drawingArea');

		var cssClass = "";
		for (var i = 0; i <= NUM_HORIZONTAL_LINES; i++) {
			var height = drawingArea_margin_percent + i * PERCENT_PER_HORIZONTAL_LINE; 
			if (i % label_steps == 0) {
				graph.content += graph.svgText((drawingArea_margin_percent + label_offset) + '%', (height + label_fontsize / 2) + '%', label_value + label_annex);
			}
			if (label_value == 0) {
				cssClass = "fat";
			} else {
				cssClass = "";
			}
			graph.content += graph.svgLine(drawingArea_margin_percent + '%', height + '%', (100 - drawingArea_margin_percent) + '%', height + '%', cssClass);
			label_value -= label_step_value;
		} 
	},
	svgLine: function(x1, y1, x2, y2, cssClass) {
		if (cssClass === undefined) {
			cssClass = '';
		}
		return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="' + cssClass + '"/>';
	},
	svgRect: function(x, y, width, height, cssClass) {
		if (cssClass === undefined) {
			cssClass = '';
		}
		return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" class="' + cssClass + '"/>';
	},
	svgCircle: function(x, y, r, cssClass) {
		if (cssClass === undefined) {
			cssClass = '';
		}
		return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" class="' + cssClass + '"/>';
	},
	svgText: function(x, y, text, cssClass) {
		if (cssClass === undefined) {
			cssClass = '';
		}
		return '<text x="' + x + '" y="' + y + '" class="' + cssClass + '">' + text + '</text>';
	},
	drawValues: function(values) {}	
};
graph.init();
graph.initGraph();

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
	res.send(fillWithVariables(assemblePage(fileIndex), properties));
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
	content = fillWithVariables(content, storage);

	res.send(content);
});

app.get('/graph.svg', function (req, res) {
	res.contentType('image/svg+xml');
	var content = fs.readFileSync(svgGraph);
	content = fillWithVariables(content, graph);
	res.send(content);
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
