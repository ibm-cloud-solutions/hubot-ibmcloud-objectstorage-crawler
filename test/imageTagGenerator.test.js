/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';
/* eslint quote-props:0, quotes:0, indent:0*/


const expect = require('chai').expect;
const ImageTagGenerator = require('../src/generator/imageTagGenerator');
const nock = require('nock');

const HUBOT_OBJECT_STORAGE_AUTH_URL = process.env.HUBOT_OBJECT_STORAGE_AUTH_URL;
const FAKE_OBJECT_STORAGE_ENDPOINT = 'http://storestuff.com';
const TEST_CONTAINER = {
	name: 'TestContainer',
	bytes: '1024',
	count: 54
};

const TEST_CONTAINER_OBJECTS_ATTACHMENT = {
	"attachments": [{
		"color": "#555",
		"fields": [{
			"short": true,
			"title": "size",
			"value": "1.00K"
		}, {
			"short": true,
			"title": "last modified",
			"value": "yesterday"
		}, {
			"short": true,
			"title": "content type",
			"value": "text"
		}, {
			"short": true,
			"title": "hash",
			"value": "ASDFdsfsdf"
		}],
		"title": "foo.txt"
	}]
};


// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Test imageTagGenerator', function() {

	beforeEach(function() {
		nock(HUBOT_OBJECT_STORAGE_AUTH_URL).post('/v3/auth/tokens', {}).reply(200, {
			token: {
				catalog: [{
					type: 'object-store',
					endpoints: [{
						region: 'dallas',
						interface: 'public',
						url: FAKE_OBJECT_STORAGE_ENDPOINT
					}]
				}]
			}
		}, {
			'x-subject-token': 'longrandomstring'
		});

		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[
			0].title).query({
			format: 'json'
		}).reply(200, 'This is the text');

		nock('https://gateway-a.watsonplatform.net/').post('/visual-recognition/api/v3/classify', {}).query({
			apikey: 'key',
			version: '2016-05-20'
		}).reply(200, {
			images: [{
				classifiers: [{
					classes: [{
						class: 'foo'
					}]
				}]
			}]
		});

		nock('https://gateway-a.watsonplatform.net/').post('/visual-recognition/api/v3/detect_faces', {}).query({
			apikey: 'key',
			version: '2016-05-20'
		}).reply(200, {
			images: [{
				faces: [{
					gender: {
						gender: 'MALE'
					},
					identity: {
						name: 'Todd'
					}
				}]
			}]
		});

		nock('https://gateway-a.watsonplatform.net/').post('/visual-recognition/api/v3/recognize_text', {}).query({
			apikey: 'key',
			version: '2016-05-20'
		}).reply(200, {
			images: [{
				words: [{
					word: 'Batman'
				}]
			}]
		});
	});

	afterEach(function() {});

	context('ImageTagGenerator initialization tests', function() {
		it('imageTagGenerator should initialize', function() {
			let imageTagGenerator = new ImageTagGenerator();
			expect(imageTagGenerator.initializedSuccessfully()).to.be.true;
		});

		it('imageTagGenerator not find missing content-type', function() {
			let imageTagGenerator = new ImageTagGenerator();
			expect(imageTagGenerator.initializedSuccessfully()).to.be.true;
			let supported = imageTagGenerator._getContentType({
				metadata: {
					'content-type': 'foobar'
				}
			});
			expect(supported).to.be.eql('');
		});

		it('imageTagGenerator not support invalid content type', function() {
			let imageTagGenerator = new ImageTagGenerator();
			expect(imageTagGenerator.initializedSuccessfully()).to.be.true;
			let supported = imageTagGenerator.isFileTypeSupported(undefined);
			expect(supported).to.be.false;
		});
		it('imageTagGenerator should generate tags superman tags', function(done) {
			let imageTagGenerator = new ImageTagGenerator();
			imageTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'image/jpeg;otherstuff'
					}
				})
				.then((result) => {
					expect(result).to.be.eql({
						objectInfo: {
							containerName: 'TestContainer',
							objectName: 'foo.txt',
							metadata: {
								'content-type': 'image/jpeg;otherstuff'
							}
						},
						tags: ['foo', 'MALE', 'Todd', 'Batman']
					});
					done();
				})
				.catch((error) => {
					done(error);
				});
		});

		it('imageTagGenerator should handle error', function(done) {
			let imageTagGenerator = new ImageTagGenerator();
			imageTagGenerator.visualRecognition.classify = function(params, cb) {
				cb(new Error('Service died'), {});
			};
			imageTagGenerator.visualRecognition.detectFaces = function(params, cb) {
				cb(new Error('Service died'), {});
			};
			imageTagGenerator.visualRecognition.recognizeText = function(params, cb) {
				cb(new Error('Service died'), {});
			};
			imageTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'image/jpeg;otherstuff'
					}
				})
				.then((result) => {
					expect(result.tags).to.be.eql([]);
					done();
				})
				.catch((error) => {
					done(error);
				});
		});

		it('imageTagGenerator should handle error in result', function(done) {
			let imageTagGenerator = new ImageTagGenerator();
			imageTagGenerator.visualRecognition.classify = function(params, cb) {
				cb(undefined, {
					images: [{
						error: {
							description: 'The service is unwell'
						}
					}]
				});
			};
			imageTagGenerator.visualRecognition.detectFaces = function(params, cb) {
				cb(undefined, {
					images: [{
						error: {
							description: 'The service is unwell'
						}
					}]
				});
			};
			imageTagGenerator.visualRecognition.recognizeText = function(params, cb) {
				cb(undefined, {
					images: [{
						error: {
							description: 'The service is unwell'
						}
					}]
				});
			};
			imageTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'image/jpeg;otherstuff'
					}
				})
				.then((result) => {
					expect(result.tags).to.be.eql([]);
					done();
				})
				.catch((error) => {
					done(error);
				});
		});

		it('imageTagGenerator should handle error with multiple images', function(done) {
			let imageTagGenerator = new ImageTagGenerator();
			imageTagGenerator.visualRecognition.classify = function(params, cb) {
				cb(undefined, {
					images: [{}, {}]
				});
			};
			imageTagGenerator.visualRecognition.detectFaces = function(params, cb) {
				cb(undefined, {
					images: [{}, {}]
				});
			};
			imageTagGenerator.visualRecognition.recognizeText = function(params, cb) {
				cb(undefined, {
					images: [{}, {}]
				});
			};
			imageTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'image/jpeg;otherstuff'
					}
				})
				.then((result) => {
					expect(result.tags).to.be.eql([]);
					done();
				})
				.catch((error) => {
					done(error);
				});
		});
	});
});
