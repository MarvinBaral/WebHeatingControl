#!/usr/bin/env node

//webserver to control a heating

const express = require('express');
const app = express();
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs'); //file-system
const exec = require('child_process').exec;

var html = '<h1>Test page</h1>'

app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function (req, res) {
	res.contentType('text/html');
	res.send(html);
})

http.createServer(app).listen(80);

