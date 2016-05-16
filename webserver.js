#!/usr/bin/env node

//webserver to control a heating

const express = require('express');
const app = express();
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs'); //file-system
const exec = require('child_process').exec;
const rootDir = '/root/heating/'
const fileHeader = rootDir + 'header.html';
const fileFooter = rootDir + 'footer.html';
const assemblePage = function (html) {
	var content = fs.readFileSync(fileHeader, 'utf-8') + html + fs.readFileSync(fileFooter, 'utf-8');
	return content;
};

var html = '<h1>Test page</h1>\n'


app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function (req, res) {
	res.contentType('text/html');
	res.send(assemblePage(html));
})

http.createServer(app).listen(80);

