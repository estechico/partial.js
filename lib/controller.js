var util = require('util');
var utils = require('./utils');
var generatorView = require('./view');
var generatorTemplate = require('./template');
var internal = require('./internal');
var path = require('path');

function Controller(name, subscribe, req, res, options, repository) {
	
	this.name = name;
	this.subscribe = subscribe;
	this.app = subscribe.app;
	this.req = req;
	this.res = res;
	this.isLayout = false;
	this.isAjax = req.isAjax;
	this.options = { layout: subscribe.app.options.defaultLayout, isChild: false, callback: null, callbackId: '', model: null, contentType: 'text/html' };
	util._extend(this.options, options);

	// dočasné úložisko
	this.repository = repository || {};
	
	// dočasný model
	this.model = {};

	// render output
	this.output = '';
	this.outputTMP = '';

	// v request.prefix je uložený prefix z handlera onPrefix
	this.prefix = req.prefix;

	if (typeof(this.prefix) === 'undefined' || this.prefix.length === 0)
		this.prefix = '';
	else
		this.prefix = '#' + this.prefix;

	this.$controller = function (id, url, flags, model, options) {
		self.$controllerVisible(id, true, url, flags, model, options);
	};

	// náročné na spracovanie
	// slowly
	this.$controllerVisible = function (id, visible, url, flags, model, options) {
		var cb = function (id, html) {
			self.output = self.output.replace(id, html);
			self.async.next();
		};

		var opt = { isChild: true, callback: cb, callbackId: id, model: model || null, layout: '' };
		util._extend(opt, options);

		self.subscribe.lookup(url, flags, opt);
	};

	this.$partial = function (id, name, model) {
		self.$partialVisible(id, true, name, model);
	};

	// náročné na spracovanie
	// slowly
	this.$partialVisible = function (id, visible, name, model) {

		var callback = function (id, html) {
			self.output = self.output.replace(id, html);
			self.async.next();
		};

		if (!visible) {
			callback(id, '');
			return;
		};

		var partial = new Controller(self.name, self.subscribe, self.req, self.res, { isChild: true, callback: callback, callbackId: id, layout: '' }, self.repository);
		partial.view(name, model);
	};

	this.$template = function (id, name, model, nameEmpty) {
		self.$templateVisible(id, true, name, model, nameEmpty);
	};

	// náročné na spracovanie
	// slowly
	this.$templateVisible = function (id, visible, name, model, nameEmpty) {

		var callback = function (id, html) {
			self.output = self.output.replace(id, html);
			self.async.next();
		};

		if (!visible) {
			callback(id, '');
			return;
		};

		generatorTemplate.render(self, id, name, nameEmpty, self.prefix, model, callback);
	};

	this.$layout = function (id, cb) {
		self.output = self.output.replace(id, self.outputTMP);
		cb();
	};

	this.$routeJS = function(id, name, isPrefix) {
		routeStatic(id, name, self.app.options.staticUrlJS, isPrefix);
	};

	this.$routeCSS = function(id, name, isPrefix) {
		routeStatic(id, name, self.app.options.staticUrlCSS, isPrefix);
	};

	this.$routeImage = function(id, name, isPrefix) {
		routeStatic(id, name, self.app.options.staticUrlImage, isPrefix);
	};

	this.$routeVideo = function(id, name, isPrefix) {
		routeStatic(id, name, self.app.options.staticUrlVideo, isPrefix);
	};

	this.$routeFont = function(id, name, isPrefix) {
		routeStatic(id, name, self.app.options.staticUrlFont, isPrefix);
	};

	this.$routeDocument = function(id, name, isPrefix) {
		routeStatic(id, name, self.app.options.staticUrlDocument, isPrefix);
	};

	this.$route = function(id, name) {
		routeStatic(id, name, self.app.options.staticUrl, false);
	};

	this.$if = function(bool, ifTrue, ifFalse) {
		return (bool ? ifTrue : ifFalse) || '';
	};

	this.resource = function(name, key, def) {
		return self.app.resource(name, key, def);
	};

	this.json = function(obj) {
		self.subscribe.returnContent(JSON.stringify(obj || {}), 'application/json');
	};

	this.content = function(contentBody, contentType) {
		self.subscribe.returnContent(contentBody, contentType);
	};

	this.view = function(name, model) {

		if (self.async.isBusy())
			return;

		var callback = function(obj) {
			
			self.output = obj.html;
			self.model = model;

			obj.generator.forEach(function(o) {
				self.async.add(function(cb) {
					eval(o);
				});
			});

			// voláme funkcie v poole
			self.async.run();
		};

		generatorView.render(self.subscribe, name, self.prefix, callback);
	};

	this.onValue = function(id, value) {
		this.output = this.output.replace(id, value || '');
		self.async.next();
	};

	this.onComplete = function() {

		if (self.options.isChild) {
			self.options.callback(self.options.callbackId, self.output);
			return;
		}

 		if (self.isLayout || utils.isNullOrEmpty(self.options.layout)) {
			// ukončujeme response
			// ukončujeme request
			self.subscribe.returnContent(self.output, self.options.contentType);
			return;
		}

		// ukladáme render do TEMPu
		self.outputTMP = self.output;
		self.isLayout = true;

		// ešte layout
		self.view(self.options.layout);
	};

	// náročné na spracovanie
	// slowly
	this.template = function(name, model, nameEmpty, cb) {
		var callback = function (id, html) {
			cb(html);
		};

		generatorTemplate.render(self, '', name, nameEmpty, self.prefix, model, callback);
	};

	// náročné na spracovanie
	// slowly
	this.controller = function (url, flags, model, options, cb) {
		
		var cb = function (id, html) {
			cb(html);
		};

		var opt = { isChild: true, callback: cb, callbackId: '', model: model || null, layout: '' };
		util._extend(opt, options);
		self.subscribe.lookup(url, flags, opt);
	};

	// náročné na spracovanie
	// slowly
	this.partial = function (name, model, cb) {

		var callback = function (id, html) {
			cb(html);
		};

		var partial = new Controller(self.name, self.subscribe, self.req, self.res, { isChild: true, callback: callback, callbackId: '', layout: '' }, self.repository);
		partial.view(name, model);
	};

	// private functions
	function routeStatic(id, name, directory, isPrefix) {
		
		if (isPrefix) {
			var extension = path.extname(name);
			name = name.replace(extension, '-' + self.prefix + extension);
		}

		var fileName = self.app.onVersion == null ? name : self.app.onVersion(name) || name;

		self.output = self.output.replace(id, directory + fileName);
		self.async.next();
	};

	this.async = new asyncController(this);
	var self = this;
};

function asyncController(obj) {
	this.obj = obj;
	this.arr = [];

	this.clear = function () {
		self.arr = [];
	};

	this.add = function (fn) {
		self.arr.push(fn);
	};

	this.isBusy = function() {
		return self.arr.length > 0;
	};

	this.run = function() { 
		process.nextTick(self.next);
	};

	this.next = function() {
		var obj = self.arr.shift();

		if (typeof(obj) === 'undefined') {
			self.obj.onComplete();
			return;
		}
		
		process.nextTick(function() {
			obj.call(self.obj, self.next);
		});
	};

	var self = this;
};

// inicializácia Controllera
// index.onLookup volá funkciu load();
exports.load = function(name, subscribe, req, res, options) {
	return new Controller(name, subscribe, req, res, options);
};