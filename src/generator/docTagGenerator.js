/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2015. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

'use strict';

const path = require('path');
const TAG = path.basename(__filename);
const _ = require('lodash');
const logger = require('../lib/logger');
const watson = require('watson-developer-cloud');
const settings = require('../lib/env');
const Objectstore = require('../lib/objectstorage');
const fs = require('fs');

const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});

// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

function DocTagGenerator() {
	this.initSuccess = false;
	this.missingEnv;
	if (!settings.doc_conversion_username || settings.doc_conversion_username.length === 0) {
		this.missingEnv = 'HUBOT_DOC_CONVERSION_USERNAME';
	}

	if (!settings.doc_conversion_password || settings.doc_conversion_password.length === 0) {
		this.missingEnv = 'HUBOT_DOC_CONVERSION_PASSWORD';
	}

	if (!settings.doc_conversion_version_date || settings.doc_conversion_version_date.length === 0) {
		this.missingEnv = 'HUBOT_DOC_CONVERSION_VERSION_DATE';
	}

	if (!settings.alchemy_api_key || settings.alchemy_api_key.length === 0) {
		this.missingEnv = 'HUBOT_ALCHEMY_API_KEY';
	}

	if (!this.missingEnv) {
		this.objectstore = new Objectstore();
		if (this.objectstore.initializedSuccessfully) {
			this.documentConversion = watson.document_conversion({
				username: settings.doc_conversion_username,
				password: settings.doc_conversion_password,
				version: 'v1',
				version_date: settings.doc_conversion_version_date
			});

			this.alchemyLanguage = watson.alchemy_language({
				api_key: settings.alchemy_api_key
			});

			this.supportedFileTypes = ['text/plain', 'text/html', 'text/xhtml+xml', 'application/pdf', 'application/msword',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
			];

			this.initSuccess = true;
		}
		else {
			this.missingEnv = this.objectstore.getMissingEnv;
		}
	}


	return this;
}

DocTagGenerator.prototype.initializedSuccessfully = function() {
	return this.initSuccess;
};

DocTagGenerator.prototype.getMissingEnv = function() {
	return this.missingEnv;
};

DocTagGenerator.prototype._getContentType = function(originalContentType) {
	if (originalContentType && _.isString(originalContentType) && originalContentType.length > 0) {
		let originalContentElements = originalContentType.toLowerCase().split(';');
		if (originalContentElements.length > 0) {
			return originalContentElements[0];
		}
	}
	return '';
};

DocTagGenerator.prototype.isFileTypeSupported = function(objectInfo) {
	if (objectInfo && objectInfo.metadata && objectInfo.metadata['content-type']) {
		let contextType = this._getContentType(objectInfo.metadata['content-type']);
		return this.supportedFileTypes.indexOf(contextType) >= 0;
	}

	return false;
};

DocTagGenerator.prototype._convertDocumentToText = function(objectInfo) {
	let os = this.objectstore;
	return new Promise((resolve, reject) => {
		// GET request will be piped to POST

		if (this._getContentType(objectInfo.metadata['content-type']) === 'text/plain') {
			os.getObject(objectInfo.containerName, objectInfo.objectName)
			.then((downloadedObject) => {
				let fileData = fs.readFileSync(downloadedObject.path, { encoding: 'utf8' });
				resolve(fileData);
			})
			.catch((error) => {
				logger.error(`${TAG}: There an unexpected error.  Error: `, error);
				reject(error);
			});
		}
		else {
			let config = {};
			let params = {
				file: os.buildObjectRequest(objectInfo.containerName, objectInfo.objectName),
				conversion_target: 'NORMALIZED_TEXT',
				config: config
			};

			this.documentConversion.convert(params, function(err, textResult) {
				try {
					if (err) {
						logger.error(
							`${TAG}: Watson document conversion failed.  Could not convert /${objectInfo.containerName}/${objectInfo.objectName} to text`,
							err);
						reject(err);
					}
					else {
						logger.silly(`${TAG}: Document conversion result: ` + JSON.stringify(textResult, null, 2));
						resolve(textResult);
					}
				}
				catch (error) {
					logger.error(`${TAG}: There an unexpected error.  Error: `, error);
					reject(error);
				}
			});
		}
	});
};

DocTagGenerator.prototype._analyzeText = function(textResult) {
	let objectInfo = textResult.objectInfo;
	return new Promise((resolve, reject) => {
		let parameters = {
			extract: 'keywords',
			text: textResult.text
		};

		this.alchemyLanguage.combined(parameters, function(err, languageResult) {
			try {
				if (err) {
					logger.error(
						`${TAG}: Alchemy language failed to analyze  /${objectInfo.containerName}/${objectInfo.objectName}`, err);
					reject(err);
				}
				else if (languageResult.status !== 'OK') {
					let errorMessage =
						`${TAG}: Alchemy language failed to analyze  /${objectInfo.containerName}/${objectInfo.objectName}.  `;
					if (languageResult.statusInfo)
						errorMessage += `Status Info: ${languageResult.statusInfo}`;
					let error = new Error(errorMessage);
					logger.error(error);
					reject(error);
				}
				else {
					logger.silly(`${TAG}: Alchemy Language analysis result: ` + JSON.stringify(languageResult, null, 2));
					let docTags = [];

					_.forEach(languageResult.keywords, (keyword) => {
						docTags.push(keyword.text);
					});

					let tagResult = {
						objectInfo: objectInfo,
						tags: docTags
					};
					logger.silly(`${TAG}: Tag Result: ` + JSON.stringify(tagResult, null, 2));
					resolve(tagResult);
				}
			}
			catch (error) {
				logger.error(`${TAG}: There an unexpected error.  Error: `, error);
				reject(error);
			}

		});
	});
};

DocTagGenerator.prototype.generateTags = function(objectInfo) {
	if (!this.isFileTypeSupported(objectInfo))
		return Promise.reject(new Error(
			`${TAG}: /${objectInfo.containerName}/${objectInfo.objectName} with content-type '${objectInfo.metadata['content-type']} is not valid for this generator.'`
		));

	return this.objectstore.checkAuth()
		.then(() => {
			return this._convertDocumentToText(objectInfo);
		})
		.then((textResult) => {
			return this._analyzeText({
				objectInfo: objectInfo,
				text: textResult
			});
		})
		.catch((err) => {
			logger.error(`${TAG}: Unexpected failure during document tag generation `, err);
			return Promise.reject(err);
		});

};

exports = module.exports = DocTagGenerator;
