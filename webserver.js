#!/usr/bin/env node

//webserver to control a heating

//modules
//====================================================

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs'); //file-system
const exec = require('child_process').exec;
const serial = require('serialport-js');

//paths
//====================================================
const rootDir = '/root/heating/';
const httpRootDir = rootDir + 'http/';
const fileHeader = httpRootDir + 'header.html';
const fileFooter = httpRootDir + 'footer.html';
const fileIndex = httpRootDir + 'index.html';
const fileLED = '/sys/class/leds/led0/brightness'; //for RaspberryPi
const dirGPIO = '/sys/class/gpio/';
const svgDir = httpRootDir;
const svgStorage = svgDir + 'storage.svg';
const svgGraph = svgDir + 'graph.svg';

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
			if (matchValue != undefined) {
				if (matchValue === true) {
					string = string.replace(matches[i], 'Ein');
				} else if (matchValue === false) {
					string = string.replace(matches[i], 'Aus');
				} else {
					string = string.replace(matches[i], matchValue);
				}
			}
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
var tempsCPU = Array(20);
var ctrTempCPU = -1;
const updateTempCPU = function() {
	exec('/opt/vc/bin/vcgencmd measure_temp', function (error, stdout, stderr) {
		var temp = stdout;
		temp = temp.replace('temp=', '');
		temp = temp.replace("'C", '');
		
		//handle the array
		if (ctrTempCPU == -1) {
			for (var i = 0; i < tempsCPU.length; i++) {
				tempsCPU[i] = temp;	
			}
		}
		ctrTempCPU++;
		if (ctrTempCPU >= tempsCPU.length) {
			ctrTempCPU = 0;
		}
		tempsCPU[ctrTempCPU] = temp;

		//calc over time average
		var avgTemp = 0;
		for (var i = 0; i < tempsCPU.length; i++) {
			avgTemp += parseFloat(tempsCPU[i]);
		}
		avgTemp /= tempsCPU.length;
		avgTemp = avgTemp.toFixed(1); //fixed number of digits after comma

		properties.cpu_temp = avgTemp;
		testArray[0].push(avgTemp);
		if (testArray[0].length > 20) {
			testArray[0].shift();
		}
	});
};

//svg
//====================================================
var graph = {
	content: "",
	height: 0,
	width: 0,
	pDrawingArea_margin: 0,
	pDrawingArea_size: 0,
	value_min: 0,
	value_max: 0,
	value_diff: 0,
	value_steps: 0,
	label_annex: "",
	label_steps: 1,
	circle_radius: 5,
	indexToLabel: Array(),
	init: function(pValue_min, pValue_max, pValue_steps, pLabel_steps, pLabel_annex, pIndexToLabel) {
		this.height = 600;
		this.width = 1200;
		this.pDrawingArea_margin = 10;
		this.pDrawingArea_size = (100 - (2 * this.pDrawingArea_margin));
		this.value_min = pValue_min;
		this.value_max = pValue_max;
		this.value_diff = this.value_max - this.value_min;
		this.value_steps = pValue_steps;
		this.label_annex = pLabel_annex;
		this.label_steps = pLabel_steps;
		this.indexToLabel = pIndexToLabel;
	},
	initGraph: function() {
		const NUM_HORIZONTAL_LINES = (this.value_max - this.value_min) / this.value_steps;
		const PERCENT_PER_HORIZONTAL_LINE = this.pDrawingArea_size / NUM_HORIZONTAL_LINES;
		const label_offset = -5;
		const label_fontsize = 3; //per cent
		var label_value = this.value_max;
		var cssClass = "";

		graph.content += graph.svgRect(this.pDrawingArea_margin + '%', this.pDrawingArea_margin + '%', this.pDrawingArea_size + '%' , this.pDrawingArea_size + '%', 'drawingArea');

		for (var i = 0; i <= NUM_HORIZONTAL_LINES; i++) {
			var height = this.pDrawingArea_margin + i * PERCENT_PER_HORIZONTAL_LINE; 
			if (i % this.label_steps == 0) {
				graph.content += graph.svgText((this.pDrawingArea_margin + label_offset) + '%', (height + label_fontsize / 2) + '%', label_value + this.label_annex);
			}
			if (label_value == 0) {
				cssClass = "fat";
			} else {
				cssClass = "";
			}
			graph.content += graph.svgLine(this.pDrawingArea_margin + '%', height + '%', (100 - this.pDrawingArea_margin) + '%', height + '%', cssClass);
			label_value -= this.value_steps;
		}
		var NUM_VALUE_LABELS = this.indexToLabel.length;
		const OFFSET_VALUE_LABELS = -label_offset;
		const HORIZ_SPACE_VALUE_LABELS = 30;
		const START_HEIGHT = this.height * 0.5 - (NUM_VALUE_LABELS * 0.5 * HORIZ_SPACE_VALUE_LABELS);
		for (var i = 0; i < NUM_VALUE_LABELS; i++) {
			graph.content += graph.svgText(String(100 - this.pDrawingArea_margin + OFFSET_VALUE_LABELS) + '%', START_HEIGHT + i * HORIZ_SPACE_VALUE_LABELS, this.indexToLabel[i], 'color' + i);
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
	svgPolyline: function(points, cssClass) {
		if (cssClass === undefined) {
			cssClass = '';
		}
		var sPoints = "";
		for (var i = 0; i < points.length; i++) {
			sPoints += points[i][0] + ',' + points[i][1] + ' ';
		}
		return '<polyline points="' + sPoints + '" class="' + cssClass + '"/>';
	},
	drawValues: function(values, colorIndex) {
		const absolute_margin_x = this.pDrawingArea_margin / 100 * this.width;
		const absolute_margin_y = this.pDrawingArea_margin / 100 * this.height;
		const absolute_width = this.pDrawingArea_size / 100 * this.width;
		const absolute_height = this.pDrawingArea_size / 100 * this.height;
		var points = new Array();
		for (var i = 0; i < values.length; i++) {
			points[i] = new Array();
			points[i][0] = (absolute_margin_x + i / (values.length - 1) * absolute_width);
			points[i][1] = (this.height - (absolute_margin_y + (values[i] - this.value_min) / this.value_diff * absolute_height));
			this.content += this.svgCircle(points[i][0], points[i][1], this.circle_radius, 'color' + colorIndex);
		}
		this.content += this.svgPolyline(points, 'color' + colorIndex);
	},
	drawGraph: function(values) {
		this.content = "";
		this.initGraph();
		if (values[0].constructor === Array) {
			for (var i = 0; i < values.length; i++) {
				this.drawValues(values[i], i);
			}
		} else {
			this.drawValues(values, 0);
		}
	}	
};

const indexToNameGraph = [
	'CPU',
	'outside',
	'store top',
	'store mid',
	'store bot',
	'to heat-c',
	'N/A',
	'N/A',
	'to burner',
	'fr burner',
	'N/A',
	'fr heat-c',
	'N/A',
	'N/A',
	'N/A',
	'burner'
];

graph.init(-10, 80, 10, 1, '°C', indexToNameGraph);

//global variables
//====================================================

const NUM_ELEMENTS = 16;
const LENGTH_ARRAY = 20;
var testArray = new Array(NUM_ELEMENTS);
for (var i = 0; i < NUM_ELEMENTS; i++) {
	testArray[i] = new Array(LENGTH_ARRAY);
}

const enum_triple = {
	off: 0,
	mid: 0,
	right: 1,
	left: 2
};

var statusLED = 0;
const CONSTANTS = {
	FALLOUT_TEMP_SLIME: 58
};
var configuration = {
	target_temp_control_used_water_temp_min: 20,
	target_temp_control_used_water_temp_max: CONSTANTS.FALLOUT_TEMP_SLIME - 3,
	target_temp_control_used_water_temp_burner_offset: 3,
	target_temp_control_heating_water_temp_min: 20,
	target_temp_control_heating_water_temp_max: CONSTANTS.FALLOUT_TEMP_SLIME - 3,
	target_temp_control_heating_water_temp_burner_offset: 5,
	target_temp_heating_water_to_heaters: 35,
	target_temp_heating_water_to_heaters_offset: 2
};
var properties = { //Object
	cpu_temp: 0,
	status_burner: false,
	status_pump_burner_circle: false,
	status_mixer: enum_triple.off,
	status_valve: enum_triple.mid,
	status_pump_heating_circle: false,
	temp_outside: 0,
	temp_storage_top: 0,
	temp_storage_mid: 0,
	temp_storage_bot: 0,
	temp_to_heating_circle: 0,
	temp_from_heating_circle: 0,
	temp_to_burner: 0,
	temp_from_burner: 0,
	temp_burner: 0,
	target_temp_used_water: configuration.target_temp_control_used_water_temp_min,
	target_temp_control_used_water_status: false,
	target_temp_heating_water: configuration.target_temp_control_heating_water_temp_min,
	target_temp_heating_water_to_heaters: configuration.target_temp_heating_water_to_heaters,
	target_temp_control_heating_water_status: false
};
var storage = {
	temp_top: 0,
	temp_mid: 0,
	temp_bot: 0,
	rgb_top: "255, 255, 255",
	rgb_mid: "255, 255, 255",
	rgb_bot: "255, 255, 255"
};
var legend = {
	temp_min: 0,
	temp_max: 0,
	rgb_min: "255, 255, 255",
	rgb_max: "255, 255, 255"
};
const pinsIndex = { //Object
	LED: 0,
	pump_burner_circle: 1,
	burner: 2,
	ventil_left: 3,
	ventil_right: 4,
	mixer_left: 5,
	mixer_right: 6,
	pump_heating_circle: 7
};
const pins = [ //Array
	3,
	21,
	20,
	22,
	23,
	24,
	25,
	26
];
const sensors = [ //mapping of indexes to positions
	'temp_outside',
	'temp_storage_mid',
	'temp_storage_top',
	'temp_storage_bot',
	'temp_to_heating_circle',
	'',
	'',
	'temp_to_burner',
	'temp_from_burner',
	'',
	'temp_from_heating_circle',
	'',
	'',
	'',
	'temp_burner'
];

//serialPort: https://www.npmjs.com/package/serialport2
//====================================================

serial.open('/dev/ttyACM0', start, '\n');

function start(port) {
	console.log("Serial Port opened");

	port.on('error', function(err) {
		console.log('Error from Serial Port: ' + err);
	});
 
	port.on('data', function(data) {
		var sData = data.toString();
		var aData = sData.split(': ');
		if (aData[0] < 15 && aData.length == 2 && !isNaN(aData[0]) && !isNaN(aData[1]) && aData[1] !== undefined) {
			aData[0] = parseInt(aData[0]);
			aData[1] = parseFloat(aData[1]).toFixed(1);
			if (sensors[aData[1]] != '') {
				properties[sensors[aData[0]]] = aData[1];
				var index = aData[0] + 1;
				testArray[index].push(aData[1]);
				if (testArray[index].length > 20) {
					testArray[index].shift();
				}
			}
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

var setThreestateHardwareSavely = function(gpio0, gpio1, value) {
	//just don't cause a shortcut.
	switch (value) {
		case 0:
			writeGPIO(gpio0, 0);
			writeGPIO(gpio1, 0);
			break;
		case 1:
			writeGPIO(gpio1, 0);
			writeGPIO(gpio0, 1);
			break;
		case 2:
			writeGPIO(gpio0, 0);
			writeGPIO(gpio1, 1);
			break;
		default:
			client.log('Wrong value for threestate-hardware');
			break;				
	}
};

//main control area
var updateInputs = function() {
	updateTempCPU();
};
setInterval(updateInputs, 1000);

var checkAndControlBurner = function () {
	//target temp control
	var doNotSetLow = false;
	if (properties.target_temp_control_used_water_status) {
		if (properties.temp_storage_top < properties.target_temp_used_water) {
			properties.status_burner = true;
			doNotSetLow = true;
		} else {
			properties.status_burner = false;
		}
	}
	if (properties.target_temp_control_heating_water_status) {
		if (properties.temp_storage_mid < properties.target_temp_heating_water) {
			properties.status_burner = true;
		} else if (!doNotSetLow) {
			properties.status_burner = false;
		}
	}
	toggleLED(); //to visualize activity (like heartbeat, but only for this application, placed at most important part of the system)
	writeGPIO(pins[pinsIndex.burner], properties.status_burner ? 1 : 0);
};
setInterval(checkAndControlBurner, 120000); //2min

var checkAndControlPumpBurnerCircle = function() {
	if (properties.temp_storage_mid < properties.temp_burner) {
		properties.status_pump_burner_circle = true;
	} else {
		properties.status_pump_burner_circle = false;
	}
	writeGPIO(pins[pinsIndex.pump_burner_circle], properties.status_pump_burner_circle ? 1 : 0);
};
setInterval(checkAndControlPumpBurnerCircle, 1000);

var checkAndControlPumpHeatingCircle = function () {
	properties.status_pump_heating_circle = properties.target_temp_control_heating_water_status;
	writeGPIO(pins[pinsIndex.pump_heating_circle], properties.status_pump_heating_circle ? 1: 0);
};
setInterval(checkAndControlPumpHeatingCircle, 1000);

var checkAndControlMixer = function() {
	if (properties.target_temp_control_heating_water_status) {
		if (properties.temp_to_heating_circle > properties.target_temp_heating_water_to_heaters + configuration.target_temp_heating_water_to_heaters_offset) {
			properties.status_mixer = enum_triple.left //take more from backflow of heating circle - cool
		} else if (properties.temp_to_heating_circle < properties.target_temp_heating_water_to_heaters - configuration.target_temp_heating_water_to_heaters_offset) {
			properties.status_mixer = enum_triple.right //take more from storage - heat
		} else {
			//mixer is in perfect position, let him there
			properties.status_mixer = enum_triple.off;
		}
	} else {
		properties.status_mixer = enum_triple.off;
	}
	setThreestateHardwareSavely(pins[pinsIndex.mixer_right], pins[pinsIndex.mixer_left], properties.status_mixer);
};
setInterval(checkAndControlMixer, 3000); //TODO: make it stepwise


//the normal webserver stuff
//====================================================

app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function (req, res) {
	res.contentType('text/html');
	var content = assemblePage(fileIndex);
	content = content.replace(TEMPLATING_SIGN_BEGIN + 'manual_things' + TEMPLATING_SIGN_END, fs.readFileSync(httpRootDir + 'manualThings.html'));
	content = fillWithVariables(content, properties);
	content = fillWithVariables(content, configuration);
	res.send(content);
});

app.get('/dir', function (req, res) {
	fs.mkdirSync(rootDir + 'Year/');
	fs.mkdirSync(rootDir + 'Year/Month/');
	fs.writeFileSync(rootDir + 'Year/Month/day.txt', 'testcontent');
	res.sendFile(rootDir + 'Year/Month/day.txt');
});

app.get('/*.html', function (req, res) {
	res.contentType('text/html');
	var content = fillWithVariables(assemblePage(httpRootDir + req.path), properties);
	content = fillWithVariables(content, configuration);
	res.send(content);
});

app.get('/*.css', function (req, res) {
	res.contentType('text/css');
	var filename = req.path;
	res.sendFile(httpRootDir + filename);
});

app.get('/*.ico', function (req, res) {
	res.contentType('image/x-icon');
	var filename = req.path;
	res.sendFile(httpRootDir + filename);
});

app.get('/*storage.svg*', function (req, res) {
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

app.get('/legend.svg', function (req, res) {
	legend.temp_min = RGB_TEMP_MIN;
	legend.temp_max = RGB_TEMP_MAX;
	legend.rgb_min = calcRGB(legend.temp_min);
	legend.rgb_max = calcRGB(legend.temp_max);
	
	res.contentType('image/svg+xml');
	var content = fs.readFileSync(svgDir + 'legend.svg');
	content = fillWithVariables(content, legend);

	res.send(content);
});

app.get('/*graph.svg*', function (req, res) {
	graph.drawGraph(testArray);
	res.contentType('image/svg+xml');
	var content = fs.readFileSync(svgGraph);
	content = fillWithVariables(content, graph);
	res.send(content);
});

app.post('/pump_burner_circle', function (req, res) {
	properties.status_pump_burner_circle = (req.body.status === 'on');
	console.log('pump burner circle ' + req.body.status);
	res.redirect(303, '/');
});

app.post('/burner', function (req, res) {
	properties.status_burner = (req.body.status === 'on');
	console.log('burner ' + req.body.status);
	res.redirect(303, '/');
});

app.post('/pump_heating_circle', function (req, res) {
	properties.status_pump_heating_circle = (req.body.status === 'on');
	console.log('pump heating circle ' + req.body.status);
	res.redirect(303, '/');
});

app.post('/mixer', function (req, res) {
	var num_status = Number(req.body.status);
	if (num_status <= 2) {
		properties.status_mixer = num_status; 
		console.log('mixer ' + req.body.status);
	} else {
		console.log('Error: wrong input for mixer status');
	}
	res.redirect(303, '/');
});

app.post('/target_temp_control_used_water', function (req, res) {
	properties.target_temp_control_used_water_status = (req.body.status === 'on');
	if (properties.target_temp_control_used_water_status) {
		var target_temp = Number(req.body.target_temp_used_water);
		if (properties.target_temp_control_used_water_status && target_temp != undefined && target_temp != NaN) {
			properties.target_temp_used_water = target_temp;
			if (properties.target_temp_used_water > configuration.target_temp_control_used_water_temp_max) {
				properties.target_temp_used_water = configuration.target_temp_control_used_water_temp_max;
			}
			if (properties.target_temp_used_water < configuration.target_temp_control_used_water_temp_min) {
				properties.target_temp_used_water = configuration.target_temp_control_used_water_temp_min;
			}
		}	
		if (properties.temp_storage_top < properties.target_temp_used_water) {
			properties.status_burner = true;
			writeGPIO(pins[pinsIndex.burner], properties.status_burner ? 1 : 0);
		}
		console.log('target temp control for used water started: ' + properties.target_temp_used_water);
	} else {
		console.log('target temp control for used water stopped');
	}
	res.redirect(303, '/');
});

app.post('/target_temp_control_heating_water', function (req, res) {
	properties.target_temp_control_heating_water_status = (req.body.status === 'on');
	if (properties.target_temp_control_heating_water_status) {
		var target_temp = Number(req.body.target_temp_heating_water);
		if (properties.target_temp_control_heating_water_status && target_temp != undefined && target_temp != NaN) {
			properties.target_temp_heating_water = target_temp;
			if (properties.target_temp_heating_water > configuration.target_temp_control_heating_water_temp_max) {
				properties.target_temp_heating_water = configuration.target_temp_control_heating_water_temp_max;
			}
			if (properties.target_temp_heating_water < configuration.target_temp_control_heating_water_temp_min) {
				properties.target_temp_heating_water = configuration.target_temp_control_heating_water_temp_min;
			}
		}
		properties.target_temp_heating_water_to_heaters = properties.target_temp_heating_water;
		if (properties.temp_storage_mid < properties.target_temp_heating_water) {
			properties.status_burner = true;
			writeGPIO(pins[pinsIndex.burner], properties.status_burner ? 1 : 0);
		}
		console.log('target temp control for heating water started: ' + properties.target_temp_heating_water);
	} else {
		console.log('target temp control for heating water stopped');
	}
	res.redirect(303, '/');
});

app.listen(80);
