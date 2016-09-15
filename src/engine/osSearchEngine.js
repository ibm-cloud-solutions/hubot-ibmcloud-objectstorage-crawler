/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const async = require('async');
const fs = require('fs');
const path = require('path');
const TAG = path.basename(__filename);
const csvArrayToString = require('csv-stringify');
const NLCManager = require('hubot-ibmcloud-cognitive-lib').nlcManager;

const logger = require('../lib/logger');
const Objectstore = require('../lib/objectstorage');
let settings = require('../lib/env');  // not const to allow test code to provide settings

// The engine will be in one of these states.  Consumers can only scan and index if the engine is idle.
const RUN_STATE_IDLE = 0;
const RUN_STATE_INDEXING = 1; // Indicate we are actively gather data for NLC training.
const RUN_STATE_SCANNING = 2; // Indicates we are actively crawling objectstorage to determine pending changes.

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

function SearchEngine() {
	this.objectstore = new Objectstore();
	this.runState = RUN_STATE_IDLE;
	this.tagGenerators = [];
	this.initError;
	this.status = {
		scanStartTimestamp: null,
		indexStartTimestamp: null
	};

	let missingEnv;

	if (!settings.nlc_url || settings.nlc_url.length === 0) {
		missingEnv = 'HUBOT_WATSON_NLC_URL';
	}
	else if (!settings.nlc_username || settings.nlc_username.length === 0) {
		missingEnv = 'HUBOT_WATSON_NLC_USERNAME';
	}
	else if (!settings.nlc_password || settings.nlc_password.length === 0) {
		missingEnv = 'HUBOT_WATSON_NLC_PASSWORD';
	}

	if (missingEnv) {
		this.initError = i18n.__('missing.required.envs', missingEnv);
	}
	else if (!this.objectstore.initializedSuccessfully()) {
		this.initError = i18n.__('missing.required.envs', this.objectstore.getMissingEnv());
	}
	else {
		// Initialize any tag generators we fine in the ../generator directory.
		let jsSuffix = '.js';
		let generatorPath = __dirname + '/../generator';
		let generatorFiles = [];

		try {
			generatorFiles = fs.readdirSync(generatorPath);
		}
		catch (error) {
			logger.error(`${TAG}: Error while reading generators from directory '${generatorPath}'`, error);
			this.initError = i18n.__('unable.to.load.generators');
		}

		if (!this.initError) {
			for (let i = 0; i < generatorFiles.length; ++i) {
				if (generatorFiles[i].indexOf(jsSuffix, generatorFiles[i].length - jsSuffix.length) !== -1) {
					let fileName = generatorFiles[i].substr(0, generatorFiles[i].length - jsSuffix.length);

					try {
						let GeneratorModule = require('../generator/' + fileName);
						let generator = new GeneratorModule();

						if (generator.initializedSuccessfully()) {
							logger.debug(`${TAG}: Successfully initialized tag generator: ${fileName}`);
							this.tagGenerators.push(generator);
						}
						else {
							logger.warn(`${TAG}: Unable to initialize tag generator, ${fileName}.  Missing required envs: ${generator.getMissingEnv()}`);
						}
					}
					catch (generatorInitError) {
						logger.error(`${TAG}: Exception while dynamically loading generator from file: ${fileName}.`, generatorInitError);
					}
				}
			}

			if (!this.tagGenerators.length) {
				this.initError = i18n.__('no.configured.tag.generators');
			}

			// Initialize our NLC manager
			let nlcOptions = {
				url: settings.nlc_url,
				username: settings.nlc_username,
				password: settings.nlc_password,
				classifierName: settings.nlc_objectstorage_classifier,
				training_data: this._getTrainingData.bind(this),
				version: 'v1',
				maxClassifiers: 1
			};
			this.nlcManager = new NLCManager(nlcOptions);
		}
	}
}

// Check to see if the search engine was initialized successfully.
SearchEngine.prototype.initializedSuccessfully = function() {
	return !this.initError;
};

// Get details about initialization error. Returns translated string explaining why initialization failed.
SearchEngine.prototype.initializationError = function() {
	return this.initError;
};

// Promise which will be resolved with useful status information about engine activity, or rejected with an error.
// Currently supported status info:
// {
//    scanStartTimestamp: ... // Date object indicating last time a scan took place (null if we never scanned).
//    indexStartTimestamp: ... // Last time we started indexing (null if we never indexed).
// }
//
// NOTE: If user restarts our process, these values will be estimates based on last NLC training.
SearchEngine.prototype.getEngineStatus = function() {
	let engine = this;
	logger.debug(`${TAG}: Retrieving engine status`);

	return new Promise((resolve, reject) => {
		try {
			if (engine.status.indexStartTimestamp) {
				// Either we have already computed indexStartTimestamp or user hasn't restarted our process since
				// last indexing.  Simply return our status.
				logger.debug(`${TAG}: Index start time already set.  Resolving with status object:`, engine.status);
				resolve(engine.status);
			}
			else {
				// User has never indexed or process was restarted.  Check by looking for existing NLC instance.
				engine.nlcManager.classifierList().then((classifiers) => {
					logger.debug(`${TAG}: Index start time not set.  Using existing classifier to compute index/scan times.`);
					let sortedClassifiers = classifiers.sort((a, b) => {
						return new Date(b.created) - new Date(a.created);
					});

					let mostRecentClassifier;

					for (let i = 0; i < sortedClassifiers.length; ++i) {
						if (sortedClassifiers[i].status === 'Training' || sortedClassifiers[i].status === 'Available') {
							mostRecentClassifier = sortedClassifiers[i];
							break;
						}
					}

					if (mostRecentClassifier) {
						logger.debug(`${TAG}: Found existing classifier to use for computing index/scan start times.`, mostRecentClassifier);
						engine.status.indexStartTimestamp = new Date(mostRecentClassifier.created);

						if (!engine.status.scanStartTimestamp) {
							engine.status.scanStartTimestamp = engine.status.indexStartTimestamp;
						}
					}

					logger.debug(`${TAG}: Resolving with status object:`, engine.status);
					resolve(engine.status);
				}).catch((err) => {
					logger.error(`${TAG}: Error while retrieving search engine status:`, err);
					reject(err);
				});
			}
		}
		catch (error) {
			logger.error(`${TAG}: Exception while retrieving search engine status:`, error);
			reject(error);
		}
	});
};

// Provides our training data to the NLC manager dynamically.  Allowing us to provide new training data
// each time we index.
SearchEngine.prototype._getTrainingData = function() {
	let engine = this;
	logger.silly(`${TAG}: Providing the following training data to NLC Manager: ${engine.indexResult.csv_training_data}`);

	return engine.indexResult.csv_training_data;
};

// Starts the process of training NLC.  Sets indexResult training flag according and resolves the
// promise immediately after training starts.  Rejects the promise if training couldn't start.
SearchEngine.prototype._startTrainingNLC = function(trainingCompleteCallback, trainingCompleteCallbackContext) {
	let engine = this;

	// @TODO ensure we have enough training data.  If not fail and set indexResult description accordingly.
	return new Promise((resolve, reject) => {
		csvArrayToString(engine.indexResult.nlc_training_data, (err, csvString) => {
			if (err) {
				logger.error(`${TAG}: Error while converting NLC training data to CSV:`, err);
				reject(err);
			}
			else {
				// initiate nlc training process.
				logger.info(`${TAG}: Initiating NLC training process for object storage search.`);
				engine.indexResult.csv_training_data = csvString;

				engine.nlcManager.train().then((classifier) => {
					if (classifier.status === 'Training') {
						engine.indexResult.training_started = true;
						engine.indexResult.description = i18n.__('nlc.training.started');

						// monitoring the training so that nlc manager will automatically switch to use the newly
						// trained classifier once training completes.  But don't wait for training to actually complete,
						// so don't return this promise to chain.
						engine.nlcManager.monitorTraining(classifier.classifier_id).then((classifier) => {
							logger.info(`${TAG}: NLC training has completed for object storage classifier.`);
							logger.debug(classifier);

							if (typeof trainingCompleteCallback === 'function') {
								trainingCompleteCallback(trainingCompleteCallbackContext);
							}
						}).catch((err1) => {
							logger.error(`${TAG}: Error while monitoring training of objectstorage classifier (${classifier.classifier_id}): `, err1);

							if (typeof trainingCompleteCallback === 'function') {
								trainingCompleteCallback(trainingCompleteCallbackContext, err1);
							}
						});

						resolve();
					}
					else {
						logger.error(`${TAG}: Object Storage classifier did not start training as expected.  classifier: ${JSON.stringify(classifier)}`);
						reject(`Object Storage classifier did not start training as expected.  classifier: ${JSON.stringify(classifier)}`);
					}
				}).catch((error) => {
					logger.error(`${TAG}: Error initiating training process:`, error);
					reject(error);
				});
			}
		});
	});
};

// Adds new text and class to structure used for NLC training.
SearchEngine.prototype._addTrainingData = function(nlcText, nlcClass) {
	let engine = this;
	let trainingStatement = [nlcText, nlcClass];

	// @ TODO checks to ensure length of text doesn't exceed limits of NLC.
	logger.debug(`${TAG}: adding nlc training data - ${JSON.stringify(trainingStatement)}`);
	engine.indexResult.nlc_training_data.push(trainingStatement);
};

/*
 * Uses NLC to classify the provided search string into classes where each class is a path to an object in object storage.
 * If includeTrainingData is true, then the returned NLC classify result will contain training data for each of the returned
 * classes (if available).  Allows for consumers of this method to show what training data (aka tags) resulted in a match.
 *
 * Returns a promise, that will either be rejected with an error or resolved with a result object with the following attributes:
 * {
 *    search_successful: boolean, // indicates if training started or not.
 *    description: string // informative description of actions taken during indexing. (translated)
 *    classify_result: object // Object following the same format as NLC classify result, with optional training data.
 * }
 *
 * NOTE: Just because this promise is resolved doesn't mean classify was successful. You must check search_successful flag.
 * This helps distinguish between an unexpected error or a known limitation.
 */
SearchEngine.prototype.classify = function(searchString, includeTrainingData) {
	let engine = this;

	if (!searchString || !searchString.length) {
		return Promise.reject(i18n.__('missing.search.string'));
	}
	else {
		return new Promise((resolve, reject) => {
			try {
				engine.nlcManager.currentClassifier().then((currentClassifier) => {
					logger.debug(`${TAG}: current classifier used for search:`, currentClassifier);

					if (currentClassifier.status === 'Training') {
						resolve({
							search_successful: false,
							description: i18n.__('unable.to.search.still.training'),
							classify_result: null
						});
					}
					else {
						engine.nlcManager.classify(searchString).then((nlcClassifyResponse) => {
							logger.debug(`${TAG}: classifier response: ${JSON.stringify(nlcClassifyResponse, null, 2)}`);

							if (!includeTrainingData) {
								resolve({
									search_successful: true,
									description: i18n.__('search.completed.successfully'),
									classify_result: nlcClassifyResponse
								});
							}
							else {
								logger.debug(`${TAG}: attempting to augment NLC classify response with training data.`);

								engine.nlcManager.getClassifierData(nlcClassifyResponse.classifier_id).then((classifierData) => {
									nlcClassifyResponse.classes.forEach((nlcClass) => {
										if (classifierData[nlcClass.class_name]) {
											nlcClass.training_data = classifierData[nlcClass.class_name];
										}
										else {
											logger.warn(`${TAG}: unable to find training data for NLC class '${nlcClass.class_name}'`);
										}
									});

									resolve({
										search_successful: true,
										description: i18n.__('search.completed.successfully'),
										classify_result: nlcClassifyResponse
									});
								}).catch((err2) => {
									// log, but still resolve with classifier results.  Better to show search results without tags.
									logger.warn(`${TAG}: Unable to retrieve training data used to train NLC classifier used for objectstorage search (${nlcClassifyResponse.classifier_id}).  Search result will not include training data.`);
									resolve({
										search_successful: true,
										description: i18n.__('search.completed.successfully'),
										classify_result: nlcClassifyResponse
									});
								});
							}
						}).catch((err1) => {
							logger.error(`${TAG}: error performing NLC classify for search string: ${searchString}`, err1);
							reject(err1);
						});
					}
				}).catch((err2) => {
					// currentClassifier rejects promise when no NLC classifier has been created yet.  We resolve with descriptive error message.
					logger.error(`${TAG}: attempting to search before scan and index.  error: `, err2);
					resolve({
						search_successful: false,
						description: i18n.__('unable.to.search.index.not.started'),
						classify_result: null
					});
				});
			}
			catch (error) {
				logger.error(`${TAG}: exception while classifying search string: ${searchString}`, error);
				reject(error);
			}
		});
	}
};

// Index an individual object by getting it's tags from a tag generator and adding
// them to the the overall nlc_training_data.
SearchEngine.prototype._indexObject = function(objectPath, objectMetadata) {
	logger.debug(`${TAG}: indexing object.  objectPath: '${objectPath}'`);
	let engine = this;
	let tokens = objectPath.match(/\/(.*)\/(.*)/);
	let containerName, objectName;

	if (!tokens) {
		logger.error(`${TAG}: internal error indexing an object.  Unable to extract container and object names from path: ${objectPath}`);
		return Promise.reject(`unable to extract container and object names from path: ${objectPath}`);
	}
	else {
		containerName = tokens[1];
		objectName = tokens[2];
	}

	return new Promise((resolve, reject) => {
		try {
			// construct input for tag generators in established format.
			let objectInfo = {
				containerName: containerName,
				objectName: objectName,
				metadata: objectMetadata
			};
			logger.debug(`${TAG}: objectInfo for tag generation: ${JSON.stringify(objectInfo)}`);

			let supportingTagGenerators = [];

			for (let i = 0; i < engine.tagGenerators.length; ++i) {
				if (engine.tagGenerators[i].isFileTypeSupported(objectInfo)) {
					supportingTagGenerators.push(engine.tagGenerators[i]);
				}
			}

			if (!supportingTagGenerators.length) {
				logger.debug(`${TAG}: no tag generator supports object '${objectPath}' - type: ${objectMetadata['content-type']}`);
				resolve();
			}
			else {
				// index the object by running all applicable tag generators and contribute tags to nlc training data.
				async.eachSeries(supportingTagGenerators, (tagGenerator, callback) => {
					tagGenerator.generateTags(objectInfo).then((generatorOutput) => {
						if (generatorOutput.tags.length) {
							logger.info(`${TAG}: indexing new objectstorage file at path: '${objectPath}'`);
						}

						generatorOutput.tags.forEach((tag) => {
							engine._addTrainingData(tag, objectPath);
						});

						callback();
					}).catch((err1) => {
						callback(err1);
					});
				}, (err) => {
					// async completed handler.
					if (err) {
						logger.error(`${TAG}: error while generating tags for object '${objectPath}':`, err);
						reject(err);
					}
					else {
						resolve();
					}
				});
			}
		}
		catch (err2) {
			logger.error(`${TAG}: exception while indexing object '${objectPath}':`, err2);
			reject(err2);
		}
	});
};

// Scans an individual object.  First check to see if our current training data already knows about the object.
// If not, get the object metadata and see if the object is supported by one of our generators.  If so, added to the
// list of additions.
SearchEngine.prototype._scanObject = function(container, object) {
	let engine = this;
	let objectPath = `/${container.name}/${object.name}`;
	logger.debug(`${TAG}: scanning object.  path: '${objectPath}'`);

	return new Promise((resolve, reject) => {
		try {
			if (engine.scanResult.mostRecentClassifierData[objectPath]) {
				// we already know about this object, so reuse existing training data.
				engine.scanResult.unchanged_objects.push(objectPath);
				resolve();
			}
			else {
				// if we have a supporting tag generator, then this is a newly added object.
				engine.objectstore.getObjectMetadata(container.name, object.name).then((objectMetadata) => {
					// construct input for tag generators in established format.
					let objectInfo = {
						containerName: container.name,
						objectName: object.name,
						metadata: objectMetadata
					};
					logger.debug(`${TAG}: looking for tag generator using objectInfo: ${JSON.stringify(objectInfo)}`);

					let foundSupportingTagGenerator = false;

					for (let i = 0; i < engine.tagGenerators.length; ++i) {
						if (engine.tagGenerators[i].isFileTypeSupported(objectInfo)) {
							foundSupportingTagGenerator = true;
							break;
						}
					}

					if (!foundSupportingTagGenerator) {
						logger.debug(`${TAG}: no tag generator supports object '${objectPath}' - type: ${objectMetadata['content-type']}.  Omitting from scan result.`);
						resolve();
					}
					else {
						logger.debug(`${TAG}: scan detected new supported object at path: '${objectPath}'`);
						engine.scanResult.added_objects.push({
							objectPath: objectPath,
							objectMetadata: objectMetadata
						});
						resolve();
					}
				}).catch((error) => {
					logger.error(`${TAG}: scan failed to get metadata for object: '/${container.name}/${object.name}':`, error);
					reject(error);
				});
			}
		}
		catch (err2) {
			logger.error(`${TAG}: scan hit exception while scanning object '${objectPath}':`, err2);
			reject(err2);
		}
	});
};

// Scan individual container by retrieving all it's objects and scanning each one in chunks.
SearchEngine.prototype._scanContainer = function(container) {
	logger.debug(`${TAG}: scanning container: '${container.name}'`);
	let engine = this;

	return new Promise((resolve, reject) => {
		try {
			engine.objectstore.getContainerDetails(container.name).then((containerDetails) => {
				if (!containerDetails.objects || !containerDetails.objects.length) {
					logger.debug(`${TAG}: details for container '${container.name}' does not contain any objects.`);
					resolve();
				}
				else {
					logger.debug(`${TAG}: scanning ${containerDetails.objects.length} container objects for container '${container.name}'`);
					async.eachLimit(containerDetails.objects, 10, (object, callback) => {
						engine._scanObject(container, object).then(() => {
							callback();
						}).catch((error) => {
							logger.error(`${TAG}: error while scanning container object at path: '/${container.name}/${object.name}'`, error);
							callback();
						});
					}, (err) => {
						// async completed handler.
						if (err) {
							// NOTE: we never run callback with error, so that failure to scan a single object
							// doesn't stop overall processing of this container.
						}
						resolve();
					});
				}
			}).catch((err1) => {
				logger.error(`${TAG}: error while scanning container '${container.name}':`, err1);
				reject(err1);
			});
		}
		catch (err2) {
			logger.error(`${TAG}: exception while scanning container '${container.name}':`, err2);
			reject(err2);
		}
	});
};

// Retrieve all containers and scan each one in series.
SearchEngine.prototype._scanAllContainers = function(containers) {
	logger.debug(`${TAG}: scanning all containers.  container count: ${containers.length}`);
	let engine = this;

	return new Promise((resolve, reject) => {
		if (!containers.length) {
			resolve();
		}
		else {
			async.eachSeries(containers, (container, callback) => {
				engine._scanContainer(container).then(() => {
					callback();
				}).catch((error) => {
					callback(error);
				});
			}, (err) => {
				// async completed handler.
				if (err) {
					reject(err);
				}
				else {
					resolve();
				}
			});
		}
	});
};

// Sum of all changes in the current scanResult.  Zero if no scan result.
SearchEngine.prototype._getChangeTotal = function() {
	let engine = this;
	let totalChanges = 0;

	if (engine.scanResult) {
		totalChanges = engine.scanResult.added_objects.length + engine.scanResult.deleted_objects.length;
	}

	return totalChanges;
};

// Indexes all additions in the pending scanResult.
SearchEngine.prototype._indexAdditions = function() {
	let engine = this;

	if (engine.scanResult.added_objects.length) {
		logger.debug(`${TAG}: indexing ${engine.scanResult.added_objects.length} additions...`);
		return new Promise((resolve, reject) => {
			try {
				async.eachLimit(engine.scanResult.added_objects, 5, (addedObject, callback) => {
					let objectPath = addedObject.objectPath;
					let objectMetadata = addedObject.objectMetadata;

					engine._indexObject(objectPath, objectMetadata).then(() => {
						callback();
					}).catch((error) => {
						logger.error(`${TAG}: error while indexing added object at path: '${objectPath}'`, error);
						callback();
					});
				}, (err) => {
					// async completed handler.
					if (err) {
						// NOTE: we never run callback with error, so that failure to index a single object
						// doesn't stop overall processing of this container.
					}
					resolve();
				});
			}
			catch (err1) {
				logger.error(`${TAG}: exception while indexing additions.  error:`, err1);
				reject(err1);
			}
		});
	}
	else {
		return Promise.resolve();
	}
};

/*
 * Scans Object Storage for documents that we support.  Then compares this to the documents our classifier is already trained to use.
 *
 * Returns a promise, that will either be rejected with an error or resolved with a result object with the following attributes:
 * {
 *    scan_completed: boolean, // indicates if the scan successfully completed.
 *    description: string // informative description of scan result (translated)
 *    additions: integer // how many objects were added since we last indexed.
 *    deletions: integer // how many objects were removed since we last indexed.
 *    total_changes: integer // sum of additions and deletions
 *    unchanged: integer // how many objects haven't changed since we last indexed.
 * }
 *
 * NOTE: Just because this promise is resolved doesn't mean the scan completed.  You must check scan_completed flag.
 * This helps distinguish between an unexpected error or a known limitation.
 */
SearchEngine.prototype.scan = function() {
	logger.info(`${TAG}: starting object storage scanning...`);

	let engine = this;
	if (!engine.initializedSuccessfully()) {
		return Promise.reject(engine.initializationError());
	}

	if (engine.runState) {
		let reason = i18n.__('engine.is.busy');

		if (engine.runState === RUN_STATE_SCANNING) {
			reason = i18n.__('no.scan.while.scanning');
		}
		else if (engine.runState === RUN_STATE_INDEXING) {
			reason = i18n.__('no.scan.while.indexing');
		}

		// Engine doesn't allow user to do 2 things at once.  Not error but limitation.  Set result accordingly and resolve.
		return Promise.resolve({
			scan_completed: false,
			description: reason,
			additions: 0,
			deletions: 0,
			total_changes: 0,
			unchanged: 0
		});
	}

	engine.runState = RUN_STATE_SCANNING;
	engine.status.scanStartTimestamp = new Date();
	engine.scanResult = {
		added_objects: [], // array of objects with thes attributes {objectPath:..., objectMetadata:...}.  One for each new objectstorage object.
		deleted_objects: [], // array of strings, which are paths for all objectstorage objects that were removed.
		unchanged_objects: [], // array of strings, which are paths for all objectstorage objects that were unchanged.
		mostRecentClassifierData: {} // training data from most recent classifier that's either training or available.
	};

	return new Promise((resolve, reject) => {
		try {
			// start by finding the most recent data that NLC was trained with.
			engine.nlcManager.classifierList().then((classifiers) => {
				logger.debug(`${TAG}: scan is looking for most recent training data to compare against.`);
				let sortedClassifiers = classifiers.sort((a, b) => {
					return new Date(b.created) - new Date(a.created);
				});

				let mostRecentClassifier;

				for (let i = 0; i < sortedClassifiers.length; ++i) {
					if (sortedClassifiers[i].status === 'Training' || sortedClassifiers[i].status === 'Available') {
						mostRecentClassifier = sortedClassifiers[i];
						break;
					}
				}

				if (mostRecentClassifier) {
					logger.debug(`${TAG}: found most recent classifier - ${JSON.stringify(mostRecentClassifier)}`);
					return engine.nlcManager.getClassifierData(mostRecentClassifier.classifier_id).catch((err0) => {
						// will happen if training data isn't available.  Typically not the case, but if so we shouldn't fail the scan.
						logger.warn(`${TAG}: A classifier (${mostRecentClassifier.classifier_id}) used for objectstorage scanning is missing training data.  Scan will treat all objects as additions.`);
					});
				}
				else {
					logger.debug(`${TAG}: scan did not find an existing classifier to compare.`);
				}
			}).then((mostRecentClassifierData) => {
				if (mostRecentClassifierData) {
					logger.debug(`${TAG}: most recent classifier is trained with ${Object.keys(mostRecentClassifierData).length} objects.`);
					engine.scanResult.mostRecentClassifierData = mostRecentClassifierData;
				}

				return engine.objectstore.getContainers();
			}).then((containers) => {
				return engine._scanAllContainers(containers);
			}).then(() => {
				// At this point the unchanged_objects are those that are in both object storage and our existing NLC data.
				// Use this to compute which objects have been deleted (i.e. those in NLC but not object storage).
				for (let objectPath in engine.scanResult.mostRecentClassifierData) {
					if (engine.scanResult.unchanged_objects.indexOf(objectPath) < 0) {
						engine.scanResult.deleted_objects.push(objectPath);
					}
				}
			}).then(() => {
				logger.info(`${TAG}: Object Storage scan has completed successfully.`);
				logger.silly(`${TAG}: Scan result: `, engine.scanResult);

				engine.runState = RUN_STATE_IDLE;
				resolve({
					scan_completed: true,
					description: engine._getChangeTotal() ?
						i18n.__('scan.completed.changes.yes', engine.scanResult.added_objects.length, engine.scanResult.deleted_objects.length) :
						i18n.__('scan.completed.changes.no'),
					additions: engine.scanResult.added_objects.length,
					deletions: engine.scanResult.deleted_objects.length,
					total_changes: engine._getChangeTotal(),
					unchanged: engine.scanResult.unchanged_objects.length
				});
			}).catch((err1) => {
				logger.error(`${TAG}: Error during scan:`, err1);
				engine.runState = RUN_STATE_IDLE;
				reject(err1);
			});
		}
		catch (err) {
			logger.error(`${TAG}: Exception during scan:`, err);
			engine.runState = RUN_STATE_IDLE;
			reject(err);
		}
	});
};

/*
 * Start the process of indexing object storage by generating tags and training NLC.
 *
 * Returns a promise, that will either be rejected with an error or resolved with a result object with the following attributes:
 * {
 *    training_started: boolean, // indicates if training started or not.
 *    description: string // informative description of actions taken during indexing. (translated)
 * }
 *
 * NOTE: Just because this promise is resolved doesn't mean training has started.  You must check training_started flag.
 * This helps distinguish between an unexpected error or a known limitation.
 *
 * Optionally, you can provide a callback function and callback context object, that will be invoked when training is complete.
 * The callback will be called with context as first parameter and optional an error in case an error happens.  This callback
 * will only be called if the original promised returned by this method set training_started to true.
 *
 */
SearchEngine.prototype.index = function(trainingCompleteCallback, trainingCompleteCallbackContext) {
	logger.info(`${TAG}: starting object storage index...`);

	let engine = this;
	if (!engine.initializedSuccessfully()) {
		return Promise.reject(engine.initializationError());
	}

	let reasonToNotIndex;

	if (engine.runState) {
		// Engine doesn't allow user to do 2 things at once.
		reasonToNotIndex = i18n.__('engine.is.busy');

		if (engine.runState === RUN_STATE_SCANNING) {
			reasonToNotIndex = i18n.__('no.index.while.scanning');
		}
		else if (engine.runState === RUN_STATE_INDEXING) {
			reasonToNotIndex = i18n.__('no.index.while.indexing');
		}
	}
	else if (!engine.scanResult) {
		reasonToNotIndex = i18n.__('scan.before.index');
	}
	else if (engine._getChangeTotal() === 0) {
		reasonToNotIndex = i18n.__('no.changes.to.index');
	}

	// These are more so limitations not unexpected errors.  Set result accordingly and resolve.
	if (reasonToNotIndex) {
		return Promise.resolve({
			training_started: false,
			description: reasonToNotIndex
		});
	}

	engine.runState = RUN_STATE_INDEXING;
	engine.status.indexStartTimestamp = new Date();
	engine.indexResult = {
		training_started: false,
		description: i18n.__('nlc.training.not.started'),
		nlc_training_data: []
	};

	return new Promise((resolve, reject) => {
		try {
			// start by making sure another classifier isn't already training.
			engine.nlcManager.classifierList().then((classifiers) => {
				let alreadyTraining = false;

				classifiers.forEach((classifier) => {
					if (classifier.status === 'Training') {
						alreadyTraining = true;
					}
				});

				if (alreadyTraining) {
					engine.runState = RUN_STATE_IDLE;
					resolve({
						training_started: false,
						description: i18n.__('classifier.already.training')
					});
				}
				else {
					// not training so proceed with indexing process. start by indexing all additions
					engine._indexAdditions().then(() => {
						// now reuse existing training data for any unchanged objects
						engine.scanResult.unchanged_objects.forEach((objectPath) => {
							let existingTrainingData = engine.scanResult.mostRecentClassifierData[objectPath];

							if (existingTrainingData) {
								logger.debug(`${TAG}: indexing will reuse existing training data.  objectPath: ${objectPath} existingTrainingData: ${existingTrainingData}`);
								existingTrainingData.forEach((nlcText) => {
									engine._addTrainingData(nlcText, objectPath);
								});
							}
						});
					}).then(() => {
						return engine._startTrainingNLC(trainingCompleteCallback, trainingCompleteCallbackContext);
					}).then(() => {
						// Once NLC starts training clear existing scanResult, to force user to rescan before attempting to index again.
						logger.debug(`${TAG}: NLC has started training, so clear existing scanResult.`);
						engine.scanResult = null;
					}).then(() => {
						logger.info(`${TAG}: Object Storage indexing has completed successfully.`);
						logger.silly(`${TAG}: Indexing result: `, engine.indexResult);

						engine.runState = RUN_STATE_IDLE;
						resolve({
							training_started: engine.indexResult.training_started,
							description: engine.indexResult.description
						});
					}).catch((error) => {
						logger.error(`${TAG}: Error while running objectstorage indexing:`, error);
						engine.runState = RUN_STATE_IDLE;
						reject(error);
					});
				}
			}).catch((err1) => {
				logger.error(`${TAG}: Error during indexing:`, err1);
				engine.runState = RUN_STATE_IDLE;
				reject(err1);
			});
		}
		catch (err) {
			logger.error(`${TAG}: Exception during indexing:`, err);
			engine.runState = RUN_STATE_IDLE;
			reject(err);
		}
	});
};

exports = module.exports = SearchEngine;
