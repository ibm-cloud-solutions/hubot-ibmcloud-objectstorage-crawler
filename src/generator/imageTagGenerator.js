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
const Objectstore = require('../lib/objectstore');

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

function ImageTagGenerator() {
	this.initSuccess = false;
	this.missingEnv;
	if (!settings.visual_recognition_api_key || settings.visual_recognition_api_key.length === 0) {
		this.missingEnv = 'HUBOT_VISUAL_RECOGNITION_API_KEY';
	}

	if (!settings.visual_recognition_version_date || settings.visual_recognition_version_date.length === 0) {
		this.missingEnv = 'HUBOT_VISUAL_RECOGNITION_VERSION_DATE';
	}

	if (!this.missingEnv) {
		this.objectstore = new Objectstore();
		if (this.objectstore.initializedSuccessfully) {
			this.visualRecognition = watson.visual_recognition({
				api_key: settings.visual_recognition_api_key,
				version: 'v3',
				version_date: settings.visual_recognition_version_date
			});
			this.supportedFileTypes = ['image/jpeg', 'image/png'];
			this.initSuccess = true;
		}
		else {
			this.missingEnv = this.objectstore.getMissingEnv;
		}
	}


	return this;
}

ImageTagGenerator.prototype.initializedSuccessfully = function() {
	return this.initSuccess;
};

ImageTagGenerator.prototype.getMissingEnv = function() {
	return this.missingEnv;
};

ImageTagGenerator.prototype._getContentType = function(originalContentType) {
	if (originalContentType && _.isString(originalContentType) && originalContentType.length > 0) {
		let originalContentElements = originalContentType.toLowerCase().split(';');
		if (originalContentElements.length > 0) {
			return originalContentElements[0];
		}
	}
	return '';
};

ImageTagGenerator.prototype.isFileTypeSupported = function(objectInfo) {
	if (objectInfo && objectInfo.metadata && objectInfo.metadata['content-type']) {
		let contextType = this._getContentType(objectInfo.metadata['content-type']);
		return this.supportedFileTypes.indexOf(contextType) >= 0;
	}

	return false;
};

ImageTagGenerator.prototype._classifyImage = function(objectInfo) {
	let os = this.objectstore;
	return new Promise((resolve, reject) => {
		// GET request will be piped to POST
		let params = {
			images_file: os.buildObjectRequest(objectInfo.containerName, objectInfo.objectName)
		};

		this.visualRecognition.classify(params, function(err, classifyResult) {
			let imageTags = [];
			let tagResult = {
				objectInfo: objectInfo,
				tags: imageTags
			};
			try {
				if (err) {
					logger.error(`${TAG}: Could not extract tags using Visual Recognition service`, err);
					resolve(tagResult);
				}
				else {
					logger.silly(`${TAG}: Classification classifyResult: ` + JSON.stringify(classifyResult, null, 2));
					if (classifyResult.images && classifyResult.images.length === 1) {
						let imageResult = classifyResult.images[0];
						if (!imageResult.error) {
							let classifiers = imageResult.classifiers;
							_.forEach(classifiers, (classifier) => {
								let classes = classifier.classes;
								_.forEach(classes, (imageClass) => {
									imageTags.push(imageClass.class);
								});
							});

							logger.debug(
								`${TAG}: generateTags result for /${objectInfo.containerName}/${objectInfo.objectName}.  Result: ` +
								JSON.stringify(imageTags, null, 2));
							resolve(tagResult);
						}
						else {
							logger.error(`${TAG}: ${imageResult.error.description}`);
							resolve(tagResult);
						}
					}
					else {
						logger.error(`${TAG}: There was more than 1 image classified.  Result: ` + JSON.stringify(classifyResult.images,
							null, 2));
						resolve(tagResult);
					}
				}
			}
			catch (error) {
				logger.error(`${TAG}: There an unexpected error.  Error: `, error);
				resolve(tagResult);
			}
		});
	});
};

ImageTagGenerator.prototype._detectFaces = function(classifyResult) {
	let os = this.objectstore;
	let objectInfo = classifyResult.objectInfo;
	let previousImageTags = classifyResult.tags ? classifyResult.tags : [];
	return new Promise((resolve, reject) => {
		// GET request will be piped to POST
		let params = {
			images_file: os.buildObjectRequest(objectInfo.containerName, objectInfo.objectName)
		};

		this.visualRecognition.detectFaces(params, function(err, faceDetectResult) {
			let faceTags = _.cloneDeep(previousImageTags);
			let tagResult = {
				objectInfo: objectInfo,
				tags: faceTags
			};
			try {
				if (err) {
					logger.error(`${TAG}: Could not extract tags using Visual Recognition service`, err);
					resolve(tagResult);
				}
				else {
					logger.silly(`${TAG}: Classification faceDetectResult: ` + JSON.stringify(faceDetectResult, null, 2));
					if (faceDetectResult.images && faceDetectResult.images.length === 1) {
						let imageResult = faceDetectResult.images[0];
						if (!imageResult.error) {
							let faces = imageResult.faces;
							_.forEach(faces, (face) => {
								if (face.gender && face.gender.gender && face.gender.gender.length > 0)
									faceTags.push(face.gender.gender);
								if (face.identity && face.identity.name && face.identity.name.length > 0)
									faceTags.push(face.identity.name);
							});

							logger.debug(
								`${TAG}: generateTags result for /${objectInfo.containerName}/${objectInfo.objectName}.  Result: ` +
								JSON.stringify(tagResult.tags, null, 2));
							resolve(tagResult);
						}
						else {
							logger.error(`${TAG}: ${imageResult.error.description}`);
							resolve(tagResult);
						}
					}
					else {
						logger.error(`${TAG}: There was more than 1 image classified.  Result: ` + JSON.stringify(faceDetectResult.images,
							null, 2));
						resolve(tagResult);
					}
				}
			}
			catch (error) {
				logger.error(`${TAG}: There an unexpected error.  Error: `, error);
				resolve(tagResult);
			}
		});
	});
};

ImageTagGenerator.prototype._detectText = function(faceDetectResult) {
	let os = this.objectstore;
	let objectInfo = faceDetectResult.objectInfo;
	let previousImageTags = faceDetectResult.tags ? faceDetectResult.tags : [];
	return new Promise((resolve, reject) => {
		// GET request will be piped to POST
		let params = {
			images_file: os.buildObjectRequest(objectInfo.containerName, objectInfo.objectName)
		};

		this.visualRecognition.recognizeText(params, function(err, textDetectResult) {
			let wordTags = _.cloneDeep(previousImageTags);
			let tagResult = {
				objectInfo: objectInfo,
				tags: wordTags
			};
			try {
				if (err) {
					logger.error(`${TAG}: Could not extract tags using Visual Recognition service`, err);
					resolve(tagResult);
				}
				else {
					logger.silly(`${TAG}: Classification textDetectResult: ` + JSON.stringify(textDetectResult, null, 2));
					if (textDetectResult.images && textDetectResult.images.length === 1) {
						let imageResult = textDetectResult.images[0];
						if (!imageResult.error) {
							let words = imageResult.words;
							_.forEach(words, (word) => {
								if (word.word && word.word.length > 0)
									wordTags.push(word.word);
							});

							logger.debug(
								`${TAG}: generateTags result for /${objectInfo.containerName}/${objectInfo.objectName}.  Result: ` +
								JSON.stringify(tagResult.tags, null, 2));
							resolve(tagResult);
						}
						else {
							logger.error(`${TAG}: ${imageResult.error.description}`);
							resolve(tagResult);
						}
					}
					else {
						logger.error(`${TAG}: There was more than 1 image classified.  Result: ` + JSON.stringify(textDetectResult.images,
							null, 2));
						resolve(tagResult);
					}
				}
			}
			catch (error) {
				logger.error(`${TAG}: There an unexpected error.  Error: `, error);
				resolve(tagResult);
			}
		});
	});
};

ImageTagGenerator.prototype.generateTags = function(objectInfo) {
	if (!this.isFileTypeSupported(objectInfo))
		return Promise.reject(new Error(
			`${TAG}: /${objectInfo.containerName}/${objectInfo.objectName} with content-type '${objectInfo.metadata['content-type']} is not valid for this generator.'`
		));

	return this.objectstore.checkAuth()
		.then(() => {
			return this._classifyImage(objectInfo);
		})
		.then((classifyResult) => {
			return this._detectFaces(classifyResult);
		})
		.then((faceDetectResult) => {
			return this._detectText(faceDetectResult);
		})
		.catch((err) => {
			logger.error(`${TAG}: Unexpected failure during image tag generation `, err);
			return Promise.reject(err);
		});

};

exports = module.exports = ImageTagGenerator;
