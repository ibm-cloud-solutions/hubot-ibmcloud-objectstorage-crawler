/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const path = require('path');
const expect = require('chai').expect;
const nock = require('nock');
const settings = require('../src/lib/env');
const SearchEngine = require('../src/engine/osSearchEngine');
const FakeTagGenerator = require('./fakeTagGenerator');
const FAKE_OBJECT_STORAGE_ENDPOINT = 'http://storestuff.com';

const mockContainerList = require(path.resolve(__dirname, 'resources', 'objectstorage.container.list.json'));
const mockContainerDetails1 = require(path.resolve(__dirname, 'resources', 'objectstorage.container1.details.json'));
const mockContainerDetails2 = require(path.resolve(__dirname, 'resources', 'objectstorage.container2.details.json'));
const mockContainerDetails3 = require(path.resolve(__dirname, 'resources', 'objectstorage.container3.details.json'));
const mockObjectMetadata = require(path.resolve(__dirname, 'resources', 'objectstorage.object.metadata.json'));

const RUN_STATE_IDLE = 0;
const RUN_STATE_INDEXING = 1;
const RUN_STATE_SCANNING = 2;

const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../src/messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Test Object Storage Search Engine', function() {

	before(function() {
		nock.disableNetConnect();
	});

	beforeEach(function() {
		// setup common mock request for NLC
		nock(settings.nlc_url).get('/v1/classifiers').reply(200, function() {
			return {classifiers: []};
		});

		nock(settings.nlc_url).post('/v1/classifiers').reply(201, function() {
			return {
				classifier_id: 'test-classifier-id',
				name: 'test-classifier',
				language: 'en',
				created: '2016-09-02T18:30:02.148Z',
				url: settings.nlc_url + '/v1/classifiers/test-classifier-id',
				status: 'Training',
				status_description: 'The classifier instance is in its training phase, not yet ready to accept classify requests.'
			};
		});

		nock(settings.nlc_url).get('/v1/classifiers/test-classifier-id').reply(200, function() {
			return {
				classifier_id: 'test-classifier-id',
				name: 'test-classifier',
				language: 'en',
				created: '2016-09-02T18:30:02.148Z',
				url: settings.nlc_url + '/v1/classifiers/test-classifier-id',
				status: 'Available',
				status_description: 'The classifier instance is now available and is ready to take classifier requests.'
			};
		});

		// common mock request for object storage
		nock(settings.os_auth_url).post('/v3/auth/tokens', {}).reply(200, {
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

		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({format: 'json'}).reply(200, mockContainerList);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/container1').query({format: 'json'}).reply(200, mockContainerDetails1);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/container2').query({format: 'json'}).reply(200, mockContainerDetails2);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/container3').query({format: 'json'}).reply(200, mockContainerDetails3);

		nock(FAKE_OBJECT_STORAGE_ENDPOINT).head('/container1/Image1.jpg').reply(200, '', mockObjectMetadata);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).head('/container1/Image2.jpg').reply(200, '', mockObjectMetadata);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).head('/container1/Image3.jpg').reply(200, '', mockObjectMetadata);

		nock(FAKE_OBJECT_STORAGE_ENDPOINT).head('/container2/Doc%201').reply(200, '', mockObjectMetadata);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).head('/container2/Doc%202').reply(200, '', mockObjectMetadata);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).head('/container2/blog%20-%20Training%20Watson%20NLC%20with%20a%20Web%20Crawler.pdf').reply(200, '', mockObjectMetadata);
	});

	afterEach(function() {
	});

	context('search engine initialization tests', function() {
		let backup_nlc_url, backup_nlc_username, backup_nlc_password, backup_os_auth_url;

		beforeEach(function() {
			backup_nlc_url = settings.nlc_url;
			backup_nlc_username = settings.nlc_username;
			backup_nlc_password = settings.nlc_password;
			backup_os_auth_url = settings.os_auth_url;
		});

		afterEach(function() {
			settings.nlc_url = backup_nlc_url;
			settings.nlc_username = backup_nlc_username;
			settings.nlc_password = backup_nlc_password;
			settings.os_auth_url = backup_os_auth_url;
		});

		it('should initialize sucessfully', function() {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;
		});

		it('should not initialize if NLC url is not set', function() {
			settings.nlc_url = null;
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.false;
			expect(engine.initializationError()).to.equal(i18n.__('missing.required.envs', 'HUBOT_WATSON_NLC_URL'));
		});

		it('should not initialize if NLC username is not set', function() {
			settings.nlc_username = null;
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.false;
			expect(engine.initializationError()).to.equal(i18n.__('missing.required.envs', 'HUBOT_WATSON_NLC_USERNAME'));
		});

		it('should not initialize if NLC password is not set', function() {
			settings.nlc_password = null;
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.false;
			expect(engine.initializationError()).to.equal(i18n.__('missing.required.envs', 'HUBOT_WATSON_NLC_PASSWORD'));
		});

		it('should not initialize if objectstorage does not initialize', function() {
			settings.os_auth_url = null;
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.false;
			expect(engine.initializationError()).to.equal(i18n.__('missing.required.envs', 'HUBOT_OBJECT_STORAGE_AUTH_URL'));
		});

		it('should not be able to scan if not initialized', function(done) {
			settings.nlc_url = null;
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.false;
			engine.scan().then((scanResult) => {
				done('ERROR: expected scan to fail.');
			}).catch((error) => {
				if (error) {} // linter
				expect(engine.initializationError()).to.equal(i18n.__('missing.required.envs', 'HUBOT_WATSON_NLC_URL'));
				done();
			});
		});

		it('should not be able to index if not initialized', function(done) {
			settings.nlc_url = null;
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.false;
			engine.index().then((scanResult) => {
				done('ERROR: expected index to fail.');
			}).catch((error) => {
				if (error) {} // linter
				expect(engine.initializationError()).to.equal(i18n.__('missing.required.envs', 'HUBOT_WATSON_NLC_URL'));
				done();
			});
		});
	});

	context('search engine scan and indexing tests', function() {
		it('should scan successfully, index and start training', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;

			let tagGenerators = [];
			tagGenerators.push(new FakeTagGenerator());
			engine.tagGenerators = tagGenerators;

			engine.scan().then((scanResult) => {
				expect(engine.runState).to.equal(RUN_STATE_IDLE);
				expect(scanResult.scan_completed).to.be.true;
				expect(scanResult.description).to.eq(i18n.__('scan.completed.changes.yes', scanResult.additions, scanResult.deletions));
				expect(scanResult.additions).to.equal(6);
				expect(scanResult.deletions).to.equal(0);
				expect(scanResult.total_changes).to.equal(6);
				expect(scanResult.unchanged).to.equal(0);
			}).then(() => {
				return engine.index();
			}).then((indexResult) => {
				expect(engine.runState).to.equal(RUN_STATE_IDLE);
				expect(indexResult.training_started).to.be.true;
				expect(indexResult.description).to.eq(i18n.__('nlc.training.started'));
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should detected additions, deletions and unchanged objects', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;

			let tagGenerators = [];
			tagGenerators.push(new FakeTagGenerator());
			engine.tagGenerators = tagGenerators;

			// mock related NLC manager output to produce desired scan result when comparing NLC to objectstorage
			engine.nlcManager = {
				classifierList: function(searchString) {
					return Promise.resolve([
						{
							classifier_id: 'test-classifier-id-older',
							name: 'test-classifier-older',
							language: 'en',
							created: '2015-09-02T18:30:02.148Z',
							url: settings.nlc_url + '/v1/classifiers/test-classifier-id-older',
							status: 'Available',
							status_description: 'The classifier instance is now available and is ready to take classifier requests.'
						},
						{
							classifier_id: 'test-classifier-id-newer',
							name: 'test-classifier-newer',
							language: 'en',
							created: '2016-09-02T18:30:02.148Z',
							url: settings.nlc_url + '/v1/classifiers/test-classifier-id-newer',
							status: 'Available',
							status_description: 'The classifier instance is now available and is ready to take classifier requests.'
						}
					]);
				},

				getClassifierData: function(classifierId) {
					// our objectstorage container detail files (in resource folder) have 6 objects.
					// when compared against this classifier data we expect 4 additions, 1 deletion, 2 unchanged
					let classfierData = {};
					classfierData['/container1/Image1.jpg'] = ['fish', 'boat']; // in objectstorage (consider 'unchanged')
					classfierData['/container1/Image2.jpg'] = ['nfl', 'football', 'sport']; // in objectstorage (consider 'unchanged')
					classfierData['/old_container/old_object.jpg'] = ['nfl', 'football', 'sport']; // not in objectstorage (considered 'deletion')
					return Promise.resolve(classfierData);
				},

				train: function() {
					return Promise.resolve({
						classifier_id: 'test-classifier-id-training',
						name: 'test-classifier-training',
						language: 'en',
						created: '2016-09-02T18:30:02.148Z',
						url: settings.nlc_url + '/v1/classifiers/test-classifier-id-newer',
						status: 'Training',
						status_description: 'The classifier instance is now available and is ready to take classifier requests.'
					});
				},

				monitorTraining: function(classifier_id) {
					return Promise.resolve({});
				}
			};

			engine.scan().then((scanResult) => {
				expect(engine.runState).to.equal(RUN_STATE_IDLE);
				expect(scanResult.scan_completed).to.be.true;
				expect(scanResult.description).to.eq(i18n.__('scan.completed.changes.yes', scanResult.additions, scanResult.deletions));
				expect(scanResult.additions).to.equal(4);
				expect(scanResult.deletions).to.equal(1);
				expect(scanResult.total_changes).to.equal(5);
				expect(scanResult.unchanged).to.equal(2);
			}).then(() => {
				return engine.index();
			}).then((indexResult) => {
				expect(engine.runState).to.equal(RUN_STATE_IDLE);
				expect(indexResult.training_started).to.be.true;
				expect(indexResult.description).to.eq(i18n.__('nlc.training.started'));
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not be able to index before scan', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;

			engine.index().then((indexResult) => {
				expect(indexResult.training_started).to.be.false;
				expect(indexResult.description).to.eq(i18n.__('scan.before.index'));
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not be able to index when scan detects no changes', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;

			engine.tagGenerators = []; // will cause no changes to be detected by scan
			engine.scan().then((scanResult) => {
				expect(scanResult.scan_completed).to.be.true;
				expect(scanResult.description).to.eq(i18n.__('scan.completed.changes.no'));
				expect(scanResult.additions).to.equal(0);
				expect(scanResult.deletions).to.equal(0);
				expect(scanResult.total_changes).to.equal(0);
				expect(scanResult.unchanged).to.equal(0);
			}).then(() => {
				return engine.index();
			}).then((indexResult) => {
				expect(indexResult.training_started).to.be.false;
				expect(indexResult.description).to.eq(i18n.__('no.changes.to.index'));
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('search engine classify tests', function() {
		let engine;

		beforeEach(function() {
			engine = new SearchEngine();

			let nlcManagerMock = {
				classify: function(searchString) {
					return Promise.resolve({
						classifier_id: 'test-classifier-id',
						url: settings.nlc_url + '/v1/classifiers/test-classifier-id',
						text: searchString,
						top_class: '/container1/Image1.jpg',
						classes: [
							{
								class_name: '/container1/Image1.jpg',
								confidence: 1
							},
							{
								class_name: '/container1/Image2.jpg',
								confidence: 0
							}
						]
					});
				},

				currentClassifier: function() {
					return Promise.resolve({
						classifier_id: 'test-classifier-id',
						name: 'test-classifier',
						language: 'en',
						created: '2016-09-02T18:30:02.148Z',
						url: settings.nlc_url + '/v1/classifiers/test-classifier-id',
						status: 'Available',
						status_description: 'The classifier instance is now available and is ready to take classifier requests.'
					});
				},

				getClassifierData: function(classifierId) {
					let classfierData = {};
					classfierData['/container1/Image1.jpg'] = ['fish', 'boat'];
					classfierData['/container1/Image2.jpg'] = ['nfl', 'football', 'sport'];
					return Promise.resolve(classfierData);
				}
			};

			engine.nlcManager = nlcManagerMock;
		});

		it('should classify text and include training data', function(done) {
			engine.classify('fishing boat', true).then((classifyResult) => {
				expect(classifyResult).to.be.a('object');
				expect(classifyResult.search_successful).to.be.true;
				expect(classifyResult.description).to.equal(i18n.__('search.completed.successfully'));
				expect(classifyResult.classify_result).to.be.a('object');
				expect(classifyResult.classify_result.classes).to.have.lengthOf(2);
				expect(classifyResult.classify_result.classes[0].training_data).to.have.lengthOf(2);
				expect(classifyResult.classify_result.classes[1].training_data).to.have.lengthOf(3);
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should classify text but do not include training data', function(done) {
			engine.classify('fishing boat', false).then((classifyResult) => {
				expect(classifyResult).to.be.a('object');
				expect(classifyResult.search_successful).to.be.true;
				expect(classifyResult.description).to.equal(i18n.__('search.completed.successfully'));
				expect(classifyResult.classify_result).to.be.a('object');
				expect(classifyResult.classify_result.classes).to.have.lengthOf(2);
				expect(classifyResult.classify_result.classes[0].training_data).to.be.undefined;
				expect(classifyResult.classify_result.classes[1].training_data).to.be.undefined;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should classify even if error retreiving training data', function(done) {
			engine.nlcManager.getClassifierData = function() {
				return Promise.reject('test forced error when getting classifier data');
			};

			engine.classify('fishing boat', true).then((classifyResult) => {
				expect(classifyResult).to.be.a('object');
				expect(classifyResult.search_successful).to.be.true;
				expect(classifyResult.description).to.equal(i18n.__('search.completed.successfully'));
				expect(classifyResult.classify_result).to.be.a('object');
				expect(classifyResult.classify_result.classes).to.have.lengthOf(2);
				expect(classifyResult.classify_result.classes[0].training_data).to.be.undefined;
				expect(classifyResult.classify_result.classes[1].training_data).to.be.undefined;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should detect that nlc is currently training', function(done) {
			engine.nlcManager = {
				currentClassifier: function() {
					return Promise.resolve({
						classifier_id: 'test-classifier-id',
						name: 'test-classifier',
						language: 'en',
						created: '2016-09-02T18:30:02.148Z',
						url: settings.nlc_url + '/v1/classifiers/test-classifier-id',
						status: 'Training',
						status_description: 'The classifier instance is in its training phase, not yet ready to accept classify requests.'
					});
				}
			};

			engine.classify('fishing boat', false).then((classifyResult) => {
				expect(classifyResult).to.be.a('object');
				expect(classifyResult.search_successful).to.be.false;
				expect(classifyResult.description).to.equal(i18n.__('unable.to.search.still.training'));
				expect(classifyResult.classify_result).to.be.null;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should detect scan and index never ran', function(done) {
			engine.nlcManager = {
				currentClassifier: function() {
					return Promise.reject('No classifiers found');
				}
			};

			engine.classify('fishing boat', false).then((classifyResult) => {
				expect(classifyResult).to.be.a('object');
				expect(classifyResult.search_successful).to.be.false;
				expect(classifyResult.description).to.equal(i18n.__('unable.to.search.index.not.started'));
				expect(classifyResult.classify_result).to.be.null;
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('test internal runState prevents multiple actions', function() {
		it('should not start new scan if currently scanning', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;
			engine.runState = RUN_STATE_SCANNING;

			engine.scan().then((scanResult) => {
				expect(scanResult.scan_completed).to.be.false;
				expect(scanResult.description).to.eq(i18n.__('no.scan.while.scanning'));
				expect(engine.runState).to.eq(RUN_STATE_SCANNING);
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not start new scan if currently indexing', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;
			engine.runState = RUN_STATE_INDEXING;

			engine.scan().then((scanResult) => {
				expect(scanResult.scan_completed).to.be.false;
				expect(scanResult.description).to.eq(i18n.__('no.scan.while.indexing'));
				expect(engine.runState).to.eq(RUN_STATE_INDEXING);
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not start indexing if currently scanning', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;
			engine.runState = RUN_STATE_SCANNING;

			engine.index().then((indexResult) => {
				expect(indexResult.training_started).to.be.false;
				expect(indexResult.description).to.eq(i18n.__('no.index.while.scanning'));
				expect(engine.runState).to.eq(RUN_STATE_SCANNING);
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not start indexing if currently indexing', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;
			engine.runState = RUN_STATE_INDEXING;

			engine.index().then((indexResult) => {
				expect(indexResult.training_started).to.be.false;
				expect(indexResult.description).to.eq(i18n.__('no.index.while.indexing'));
				expect(engine.runState).to.eq(RUN_STATE_INDEXING);
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('search engine scan and index errors', function() {

		it('should fail to scan if errors retrieving classifier list', function(done) {
			let engine = new SearchEngine();

			engine.nlcManager = {
				classifierList: function() {
					return Promise.reject('unable to get list of classifiers');
				}
			};

			engine.scan().then((scanResult) => {
				done('ERROR: scan should not work if error while getting classifiers');
			}).catch((error) => {
				if (error) {} // linter
				expect(engine.runState).to.eq(RUN_STATE_IDLE);
			}).then(() => {
				engine.nlcManager.classifierList = function() {
					throw new Error('exception from test');
				};
				return engine.scan();
			}).then((scanResult) => {
				done('ERROR: scan should not work if exception while getting classifiers');
			}).catch((error) => {
				if (error) {} // linter
				expect(engine.runState).to.eq(RUN_STATE_IDLE);
				done();
			});
		});

		it('should fail to index if errors retrieving classifier list', function(done) {
			let engine = new SearchEngine();

			engine.scanResult = {
				added_objects: ['obj1'],
				deleted_objects: []
			};

			engine.nlcManager = {
				classifierList: function() {
					return Promise.reject('unable to get list of classifiers');
				}
			};

			engine.index().then((indexResult) => {
				done('ERROR: index should not work if error while getting classifiers');
			}).catch((error) => {
				if (error) {} // linter
				expect(engine.runState).to.eq(RUN_STATE_IDLE);
			}).then(() => {
				engine.nlcManager.classifierList = function() {
					throw new Error('exception from test');
				};
				return engine.index();
			}).then((indexResult) => {
				done('ERROR: index should not work if exception while getting classifiers');
			}).catch((error) => {
				if (error) {} // linter
				expect(engine.runState).to.eq(RUN_STATE_IDLE);
				done();
			});
		});

		it('should fail to index if NLC is already training', function(done) {
			let engine = new SearchEngine();

			engine.scanResult = {
				added_objects: ['obj1'],
				deleted_objects: []
			};

			engine.nlcManager = {
				classifierList: function() {
					return Promise.resolve([{
						classifier_id: 'test-classifier-id-training',
						name: 'test-classifier-training',
						language: 'en',
						created: '2016-09-02T18:30:02.148Z',
						url: settings.nlc_url + '/v1/classifiers/test-classifier-id-newer',
						status: 'Training',
						status_description: 'The classifier instance is now available and is ready to take classifier requests.'
					}]);
				}
			};

			engine.index().then((indexResult) => {
				expect(engine.runState).to.eq(RUN_STATE_IDLE);
				expect(indexResult.training_started).to.be.false;
				expect(indexResult.description).to.eq(i18n.__('classifier.already.training'));
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('tests to validate engine status', function() {
		it('scan and indexing should set start times in status', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;

			let tagGenerators = [];
			tagGenerators.push(new FakeTagGenerator());
			engine.tagGenerators = tagGenerators;

			engine.getEngineStatus().then((status) => {
				expect(status.scanStartTimestamp).to.be.null;
				expect(status.indexStartTimestamp).to.be.null;
				return engine.scan();
			}).then(() => {
				return engine.getEngineStatus();
			}).then((status) => {
				expect(typeof status.scanStartTimestamp).to.equal('object');
				expect(status.indexStartTimestamp).to.be.null;
				return engine.index();
			}).then(() => {
				return engine.getEngineStatus();
			}).then((status) => {
				expect(typeof status.scanStartTimestamp).to.equal('object');
				expect(typeof status.indexStartTimestamp).to.equal('object');
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should be able to compute status from previously trained classifier', function(done) {
			let engine = new SearchEngine();
			expect(engine.initializedSuccessfully()).to.be.true;

			// mock related NLC manager output to ensure index/scan startTime comes from latest classifier.
			let mostRecentClassifierCreated = '2016-09-02T18:30:02.148Z';

			engine.nlcManager = {
				classifierList: function(searchString) {
					return Promise.resolve([
						{
							classifier_id: 'test-classifier-id-older',
							name: 'test-classifier-older',
							language: 'en',
							created: '2015-09-02T18:30:02.148Z',
							url: settings.nlc_url + '/v1/classifiers/test-classifier-id-older',
							status: 'Available',
							status_description: 'The classifier instance is now available and is ready to take classifier requests.'
						},
						{
							classifier_id: 'test-classifier-id-newer',
							name: 'test-classifier-newer',
							language: 'en',
							created: mostRecentClassifierCreated,
							url: settings.nlc_url + '/v1/classifiers/test-classifier-id-newer',
							status: 'Available',
							status_description: 'The classifier instance is now available and is ready to take classifier requests.'
						}
					]);
				}
			};

			engine.getEngineStatus().then((status) => {
				expect(typeof status.scanStartTimestamp).to.equal('object');
				expect(typeof status.indexStartTimestamp).to.equal('object');
				expect(status.scanStartTimestamp.getTime()).to.equal(Date.parse(mostRecentClassifierCreated));
				expect(status.indexStartTimestamp.getTime()).to.equal(Date.parse(mostRecentClassifierCreated));
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should fail to retrieve status if unable to talk to NLC', function(done) {
			let engine = new SearchEngine();

			engine.nlcManager = {
				classifierList: function() {
					return Promise.reject('unable to get list of classifiers');
				}
			};

			engine.getEngineStatus().then((status) => {
				done('ERROR: get status should not work if error while getting classifiers');
			}).catch((error) => {
				if (error) {} // we expect this error.
			}).then((status) => {
				engine.nlcManager.classifierList = function() {
					throw new Error('exception from test');
				};
				return engine.getEngineStatus();
			}).then((status) => {
				done('ERROR: get status should not work if exception while getting classifiers');
			}).catch((error) => {
				if (error) {} // we expect this error.
				done();
			});
		});
	});
});
