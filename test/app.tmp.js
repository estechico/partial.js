var urlParser = require('url');
var http = require('http');
var https = require('https');
var util = require('util');
var path = require('path');
var fs = require('fs');
var events = require('events');
var crypto = require('crypto');

var BOUNDARY = '----' + Math.random().toString(16).substring(2);

function send(url) {

	var uri = urlParser.parse(url);
	var h = {};
	var indexer = 0;

	h['Content-Type'] = 'multipart/x-mixed-replace; boundary=' + BOUNDARY;
	//h['Content-Type'] = 'multipart/form-data; boundary=' + BOUNDARY;
	
	var options = { protocol: uri.protocol, auth: uri.auth, method: 'POST', hostname: uri.hostname, port: uri.port, path: uri.path, agent: false, headers: h };

	var response = function(res) {
		var buffer = '';

		res.on('data', function(chunk) {
			buffer += chunk.toString('utf8');
		});

		res.on('end', function() {
			console.log(res.statusCode, buffer);
		});

		res.resume();
		console.log('response');
	};

	var con = http;


	var req = con.request(options, response);

	req.on('error', function(error) {
		console.log('ERROR', error, error.stack);
	});

	function sendfile(filename, cb) {
		console.log(filename);
		var header = '\r\n\r\n--' + BOUNDARY + '\r\nContent-Disposition: form-data; name="File"; filename="'+path.basename(filename)+'"\r\nContent-Type: image/jpeg\r\n\r\n';
		req.write(header);
		var stream = fs.createReadStream(filename);
		stream.pipe(req, { end: false });
		stream.on('end', cb);
	}

	function run() {
		indexer++;

		if (indexer > 5) {
			req.end('\r\n\r\n--' + BOUNDARY + '--');
			console.log('END');
			return;
		}

		setTimeout(function() {
			sendfile('/users/petersirka/desktop/aaaaa/' + indexer + '.jpg', run);	
		}, 500);
		
	}

	run();
};

//send('http://127.0.0.1:8004/');
send('http://127.0.0.1:8001/live/incoming/');