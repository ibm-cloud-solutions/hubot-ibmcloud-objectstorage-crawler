/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const expect = require('chai').expect;
const Objectstore = require('../src/lib/objectstorage');
const settings = require('../src/lib/env');

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
describe('Test object storage library', function() {

	beforeEach(function() {
	});

	afterEach(function() {
	});

	context('objectstorage initialization tests', function() {
		let backup_os_auth_url, backup_os_user_id, backup_os_password, backup_os_project_id, backup_os_bluemix_region;

		beforeEach(function() {
			backup_os_auth_url = settings.os_auth_url;
			backup_os_user_id = settings.os_user_id;
			backup_os_password = settings.os_password;
			backup_os_project_id = settings.os_project_id;
			backup_os_bluemix_region = settings.os_bluemix_region;
		});

		afterEach(function() {
			settings.os_auth_url = backup_os_auth_url;
			settings.os_user_id = backup_os_user_id;
			settings.os_password = backup_os_password;
			settings.os_project_id = backup_os_project_id;
			settings.os_bluemix_region = backup_os_bluemix_region;
		});

		it('objectstorage should initialize', function() {
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.true;
		});

		it('objectstorage should not initialize if missing HUBOT_OBJECT_STORAGE_AUTH_URL', function() {
			settings.os_auth_url = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;
			expect(os.getMissingEnv()).to.equal('HUBOT_OBJECT_STORAGE_AUTH_URL');
		});

		it('objectstorage should not initialize if missing HUBOT_OBJECT_STORAGE_USER_ID', function() {
			settings.os_user_id = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;
			expect(os.getMissingEnv()).to.equal('HUBOT_OBJECT_STORAGE_USER_ID');
		});

		it('objectstorage should not initialize if missing HUBOT_OBJECT_STORAGE_PASSWORD', function() {
			settings.os_password = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;
			expect(os.getMissingEnv()).to.equal('HUBOT_OBJECT_STORAGE_PASSWORD');
		});

		it('objectstorage should not initialize if missing HUBOT_OBJECT_STORAGE_PROJECT_ID', function() {
			settings.os_project_id = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;
			expect(os.getMissingEnv()).to.equal('HUBOT_OBJECT_STORAGE_PROJECT_ID');
		});

		it('objectstorage should not initialize if missing HUBOT_OBJECT_STORAGE_BLUEMIX_REGION', function() {
			settings.os_bluemix_region = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;
			expect(os.getMissingEnv()).to.equal('HUBOT_OBJECT_STORAGE_BLUEMIX_REGION');
		});

		it('objectstorage.checkAuth should fail if not initialized', function(done) {
			settings.os_auth_url = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;

			os.checkAuth().then(() => {
				done('ERROR: should not successed.');
			}).catch((error) => {
				if (error) {} // linter
				done();
			});
		});

		it('objectstorage.getContainers should fail if not initialized', function(done) {
			settings.os_auth_url = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;

			os.getContainers().then(() => {
				done('ERROR: should not successed.');
			}).catch((error) => {
				if (error) {} // linter
				done();
			});
		});

		it('objectstorage.getContainerDetails should fail if not initialized', function(done) {
			settings.os_auth_url = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;

			os.getContainerDetails().then(() => {
				done('ERROR: should not successed.');
			}).catch((error) => {
				if (error) {} // linter
				done();
			});
		});

		it('objectstorage.buildObjectRequest should fail if not initialized', function(done) {
			settings.os_auth_url = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;

			os.buildObjectRequest().then(() => {
				done('ERROR: should not successed.');
			}).catch((error) => {
				if (error) {} // linter
				done();
			});
		});

		it('objectstorage.getObject should fail if not initialized', function(done) {
			settings.os_auth_url = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;

			os.getObject().then(() => {
				done('ERROR: should not successed.');
			}).catch((error) => {
				if (error) {} // linter
				done();
			});
		});

		it('objectstorage.getObjectMetadata should fail if not initialized', function(done) {
			settings.os_auth_url = null;
			let os = new Objectstore();
			expect(os.initializedSuccessfully()).to.be.false;

			os.getObjectMetadata().then(() => {
				done('ERROR: should not successed.');
			}).catch((error) => {
				if (error) {} // linter
				done();
			});
		});
	});
});
