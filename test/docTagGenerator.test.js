/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

/* eslint quote-props:0, quotes:0, indent:0*/

const expect = require('chai').expect;
const DocTagGenerator = require('../src/generator/docTagGenerator');
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
describe('Test object storage library', function() {

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

		nock('https://gateway.watsonplatform.net').post('/document-conversion/api/v1/convert_document', {}).query({
			version: '2015-12-15'
		}).reply(200, 'Hello');

		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[
			0].title).query({
			format: 'json'
		}).reply(200, 'This is the text');

	});

	context('DocTagGenerator conversion tests', function() {
		it('docTagGenerator should initialize', function() {
			let docTagGenerator = new DocTagGenerator();
			expect(docTagGenerator.initializedSuccessfully()).to.be.true;
		});

		it('docTagGenerator not find missing content-type', function() {
			let docTagGenerator = new DocTagGenerator();
			expect(docTagGenerator.initializedSuccessfully()).to.be.true;
			let supported = docTagGenerator._getContentType({
				metadata: {
					'content-type': 'foobar'
				}
			});
			expect(supported).to.be.eql('');
		});

		it('docTagGenerator not support invalid content type', function() {
			let docTagGenerator = new DocTagGenerator();
			expect(docTagGenerator.initializedSuccessfully()).to.be.true;
			let supported = docTagGenerator.isFileTypeSupported(undefined);
			expect(supported).to.be.false;
		});

		it('docTagGenerator should generate tags superman tags with pdf', function(done) {

			let docTagGenerator = new DocTagGenerator();
			docTagGenerator.alchemyLanguage.combined = function(params, cb) {
				cb(undefined, {
					status: 'OK',
					keywords: [{
						text: 'superman'
					}]
				});
			};
			docTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'application/pdf'
					}
				})
				.then((result) => {
					expect(result).to.be.eql({
						objectInfo: {
							containerName: 'TestContainer',
							objectName: 'foo.txt',
							metadata: {
								'content-type': 'application/pdf'
							}
						},
						tags: [

							'superman'
						]
					});
					done();
				})
				.catch((error) => {
					done(error);
				});
		});

		it('docTagGenerator should generate tags superman tags with plain text', function(done) {

			let docTagGenerator = new DocTagGenerator();
			docTagGenerator.alchemyLanguage.combined = function(params, cb) {
				cb(undefined, {
					status: 'OK',
					keywords: [{
						text: 'superman'
					}]
				});
			};
			docTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'text/plain'
					}
				})
				.then((result) => {
					expect(result).to.be.eql({
						objectInfo: {
							containerName: 'TestContainer',
							objectName: 'foo.txt',
							metadata: {
								'content-type': 'text/plain'
							}
						},
						tags: [

							'superman'
						]
					});
					done();
				})
				.catch((error) => {
					done(error);
				});
		});

		it('docTagGenerator should generate handle error in callback', function(done) {

			let docTagGenerator = new DocTagGenerator();
			docTagGenerator.alchemyLanguage.combined = function(params, cb) {
				cb(new Error('Service died'), {});
			};
			docTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'text/plain'
					}
				})
				.then((result) => {
					done(new Error('should have failed'));
				})
				.catch((error) => {
					if (error)
						done();
				});
		});

		it('docTagGenerator should handle error in status code', function(done) {

			let docTagGenerator = new DocTagGenerator();
			docTagGenerator.alchemyLanguage.combined = function(params, cb) {
				cb(undefined, {status: 'ERROR', statusInfo: 'Service unwell but not dead'});
			};
			docTagGenerator.generateTags({
					containerName: 'TestContainer',
					objectName: 'foo.txt',
					metadata: {
						'content-type': 'text/plain'
					}
				})
				.then((result) => {
					done(new Error('should have failed'));
				})
				.catch((error) => {
					if (error)
						done();
				});
		});
	});
});
