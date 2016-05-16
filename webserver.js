#!/usr/bin/env node

//webserver to control a heating

const express = require('express');
const app = express();
const http = require('http');
//const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs'); //file-system
const exec = require('child_process').exec;
const rootDir = '/root/heating/'
const fileHeader = rootDir + 'header.html';
const fileFooter = rootDir + 'footer.html';
const fileIndex = rootDir + 'index.html';
const assemblePage = function (fileToEmbed) {
	var content = fs.readFileSync(fileHeader, 'utf-8') + fs.readFileSync(fileToEmbed, 'utf-8') + fs.readFileSync(fileFooter, 'utf-8');
	return content;
};


//the normal webserver stuff
//====================================================

//app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function (req, res) {
	res.contentType('text/html');
	res.send(assemblePage(fileIndex));
})

app.get('/*.css', function (req, res) {
	res.contentType('text/css');
	var filename = req.path;
	res.sendFile(rootDir + filename);
})

http.createServer(app).listen(80);

