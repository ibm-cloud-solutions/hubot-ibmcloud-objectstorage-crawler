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
describe('Test env library overrides settings from VCAP_SERVICES', function() {

	function validateAllKeysSet(settings) {
		return settings.log_level === 'info' &&
			settings.os_auth_url === 'https://authUrlOverride.com' &&
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

	context('validate all settings are set to expected env vars.', function() {

		beforeEach(function() {
			// clear the node cache of our env mod.
			delete require.cache[require.resolve('../src/lib/env')];
		});
		it('should pass', function() {
			process.env.VCAP_SERVICES = '{"Object-Storage": [{"credentials": {"auth_url": "https://authUrlOverride.com","password": "passw0rd","projectId": "theprojectid","region": "dallas","userId": "theuserid"}}],"document_conversion": [{"credentials": {"password": "password","url": "https://gateway.watsonplatform.net/document-conversion/api","username": "user"}}],"watson_vision_combined": [{"credentials": {"api_key": "key","url": "https://gateway-a.watsonplatform.net/visual-recognition/api"}}], "alchemy_api": [{"credentials": {"api_key": "somekey"}}]}';
			const settings = require('../src/lib/env');
			expect(validateAllKeysSet(settings)).to.be.true;
			/* eslint-disable */
			delete process.env['VCAP_SERVICES'];
			/* eslint-enable */
		});
	});
});
