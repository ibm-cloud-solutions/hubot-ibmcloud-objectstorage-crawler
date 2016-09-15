/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

let settings = {
	log_level: process.env.HUBOT_LOG_LEVEL || process.env.OBJECTSTORAGE_LOG_LEVEL || 'info',

	os_auth_url: process.env.HUBOT_OBJECT_STORAGE_AUTH_URL,
	os_user_id: process.env.HUBOT_OBJECT_STORAGE_USER_ID,
	os_password: process.env.HUBOT_OBJECT_STORAGE_PASSWORD,
	os_project_id: process.env.HUBOT_OBJECT_STORAGE_PROJECT_ID,
	os_bluemix_region: process.env.HUBOT_OBJECT_STORAGE_BLUEMIX_REGION || 'dallas',

	nlc_url: process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_URL || process.env.HUBOT_WATSON_NLC_URL,
	nlc_username: process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_USERNAME || process.env.HUBOT_WATSON_NLC_USERNAME,
	nlc_password: process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_PASSWORD || process.env.HUBOT_WATSON_NLC_PASSWORD,
	nlc_objectstorage_classifier: process.env.HUBOT_WATSON_NLC_OJBECTSTORAGE_CLASSIFIER_NAME ||
		'cloudbot-obj-storage-classifier',

	visual_recognition_api_key: process.env.HUBOT_VISUAL_RECOGNITION_API_KEY,
	visual_recognition_version_date: process.env.HUBOT_VISUAL_RECOGNITION_VERSION_DATE,

	doc_conversion_username: process.env.HUBOT_DOC_CONVERSION_USERNAME,
	doc_conversion_password: process.env.HUBOT_DOC_CONVERSION_PASSWORD,
	doc_conversion_version_date: process.env.HUBOT_DOC_CONVERSION_VERSION_DATE,

	alchemy_api_key: process.env.HUBOT_ALCHEMY_API_KEY
};

// services bound to application, overrides any other settings.
if (process.env.VCAP_SERVICES) {
	if (JSON.parse(process.env.VCAP_SERVICES)["Object-Storage"]) {
		let credentials = JSON.parse(process.env.VCAP_SERVICES)["Object-Storage"][0].credentials;
		settings.os_auth_url = credentials.auth_url;
		settings.os_user_id = credentials.userId;
		settings.os_password = credentials.password;
		settings.os_project_id = credentials.projectId;
		settings.os_bluemix_region = credentials.region;
	}
	if (JSON.parse(process.env.VCAP_SERVICES).natural_language_classifier) {
		let credentials = JSON.parse(process.env.VCAP_SERVICES).natural_language_classifier[0].credentials;
		settings.nlc_url = credentials.url;
		settings.nlc_username = credentials.username;
		settings.nlc_password = credentials.password;
	}
	if (JSON.parse(process.env.VCAP_SERVICES).watson_vision_combined) {
		let credentials = JSON.parse(process.env.VCAP_SERVICES).watson_vision_combined[0].credentials;
		settings.visual_recognition_api_key = credentials.api_key;

	}
	if (JSON.parse(process.env.VCAP_SERVICES).document_conversion) {
		let credentials = JSON.parse(process.env.VCAP_SERVICES).document_conversion[0].credentials;
		settings.doc_conversion_username = credentials.username;
		settings.doc_password = credentials.password;
		settings.doc_conversion_username = credentials.username;
	}
}

// gracefully output message and exit if any required config is undefined
if (!settings.os_auth_url) {
	console.error('HUBOT_OBJECT_STORAGE_AUTH_URL not set');
}

if (!settings.os_user_id) {
	console.error('HUBOT_OBJECT_STORAGE_USER_ID not set');
}

if (!settings.os_password) {
	console.error('HUBOT_OBJECT_STORAGE_PASSWORD not set');
}

if (!settings.os_project_id) {
	console.error('HUBOT_OBJECT_STORAGE_PROJECT_ID not set');
}

if (!settings.os_bluemix_region) {
	console.error('HUBOT_OBJECT_STORAGE_BLUEMIX_REGION not set');
}

if (!settings.nlc_url) {
	console.log('HUBOT_WATSON_NLC_URL not set');
}

if (!settings.nlc_username) {
	console.log('HUBOT_WATSON_NLC_USERNAME not set');
}

if (!settings.nlc_password) {
	console.log('HUBOT_WATSON_NLC_PASSWORD not set');
}

if (!settings.nlc_objectstorage_classifier) {
	console.log('HUBOT_WATSON_NLC_OJBECTSTORAGE_CLASSIFIER_NAME not set');
}

if (!settings.visual_recognition_api_key) {
	console.log('HUBOT_VISUAL_RECOGNITION_API_KEY not set');
}

if (!settings.visual_recognition_version_date) {
	console.log('HUBOT_VISUAL_RECOGNITION_VERSION_DATE not set');
}

if (!settings.doc_conversion_username) {
	console.log('HUBOT_DOC_CONVERSION_USERNAME not set');
}

if (!settings.doc_conversion_password) {
	console.log('HUBOT_DOC_CONVERSION_PASSWORD not set');
}

if (!settings.doc_conversion_version_date) {
	console.log('HUBOT_DOC_CONVERSION_VERSION_DATE not set');
}

if (!settings.alchemy_api_key) {
	console.log('HUBOT_ALCHEMY_API_KEY not set');
}

module.exports = settings;
