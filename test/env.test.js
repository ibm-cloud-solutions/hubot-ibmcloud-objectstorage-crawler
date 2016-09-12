/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const expect = require('chai').expect;

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Test env library loades settings from env vars', function() {

	function validateOnlyDefaultKeysSet(settings) {
		return settings.log_level === 'info' &&
			settings.nlc_objectstorage_classifier === 'cloudbot-obj-storage-classifier' &&
			settings.os_bluemix_region === 'dallas' && !settings.os_auth_url && !settings.os_user_id && !settings.os_password && !settings.os_project_id && !settings.nlc_url && !settings.nlc_username && !settings.nlc_password && !settings.visual_recognition_api_key && !settings.visual_recognition_version_date && !settings.doc_conversion_username && !settings.doc_conversion_password && !settings.doc_conversion_version_date && !settings.alchemy_api_key;
	};

	function validateAllKeysSet(settings) {
		return settings.log_level === 'info' &&
			settings.os_auth_url === process.env.HUBOT_OBJECT_STORAGE_AUTH_URL &&
			settings.os_user_id === process.env.HUBOT_OBJECT_STORAGE_USER_ID &&
			settings.os_password === process.env.HUBOT_OBJECT_STORAGE_PASSWORD &&
			settings.os_project_id === process.env.HUBOT_OBJECT_STORAGE_PROJECT_ID &&
			settings.os_bluemix_region === process.env.HUBOT_OBJECT_STORAGE_BLUEMIX_REGION &&
			settings.nlc_url === process.env.HUBOT_WATSON_NLC_URL &&
			settings.nlc_username === process.env.HUBOT_WATSON_NLC_USERNAME &&
			settings.nlc_password === process.env.HUBOT_WATSON_NLC_PASSWORD &&
			settings.nlc_objectstorage_classifier === 'cloudbot-obj-storage-classifier' &&
			settings.visual_recognition_api_key === process.env.HUBOT_VISUAL_RECOGNITION_API_KEY &&
			settings.visual_recognition_version_date === process.env.HUBOT_VISUAL_RECOGNITION_VERSION_DATE &&
			settings.doc_conversion_username === process.env.HUBOT_DOC_CONVERSION_USERNAME &&
			settings.doc_conversion_password === process.env.HUBOT_DOC_CONVERSION_PASSWORD &&
			settings.doc_conversion_version_date === process.env.HUBOT_DOC_CONVERSION_VERSION_DATE &&
			settings.alchemy_api_key === process.env.HUBOT_ALCHEMY_API_KEY;
	};

	context('validation of settings behavior when missing expected env vars.', function() {

		let hubotEnvBackup;

		beforeEach(function() {
			hubotEnvBackup = {};

			// backup the keys
			for (let key in process.env) {
				if (key.indexOf('HUBOT') >= 0) {
					hubotEnvBackup[key] = process.env[key];
				}
			}

			// remove then from process module
			for (let key in hubotEnvBackup) {
				delete process.env[key];
			}

			// clear the node cache of our env mod.
			delete require.cache[require.resolve('../src/lib/env')];
		});

		afterEach(function() {
			// add the backed up keys back into process.env
			for (let key in hubotEnvBackup) {
				process.env[key] = hubotEnvBackup[key];
			}
		});

		it('should pass', function() {
			const settings = require('../src/lib/env');
			expect(validateOnlyDefaultKeysSet(settings)).to.be.true;
		});
	});

	context('validate all settings are set to expected env vars.', function() {

		beforeEach(function() {
			// clear the node cache of our env mod.
			delete require.cache[require.resolve('../src/lib/env')];
		});

		it('should pass', function() {
			const settings = require('../src/lib/env');
			expect(validateAllKeysSet(settings)).to.be.true;
		});
	});
});
