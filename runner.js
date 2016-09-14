/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const readline = require('readline');
const fs = require('fs');
const env = require('./src/lib/env');
const SearchEngine = require('./src/engine/osSearchEngine');
const engine = new SearchEngine();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function usage() {
	console.log('Supported commands:');
	console.log('\tscan - scan objectstorage for changes since last training.');
	console.log('\tindex - index objectstorage using NLC.');
	console.log('\tsearch <string> - run search with the provided search string');
	console.log('\tstatus - show status of search engine');
	console.log('\texit - end this program.');
}

function doScan() {
	return engine.scan().then((result) => {
		console.log(JSON.stringify(result, null, 2));
	}).catch((error) => {
		console.error(JSON.stringify(error, null, 2));
	});
}

function doIndex() {
	return engine.index().then((result) => {
		console.log(JSON.stringify(result, null, 2));
	}).catch((error) => {
		console.error(JSON.stringify(error, null, 2));
	});
}

function doSearch(searchString) {
	return engine.classify(searchString, true).then((result) => {
		console.log(JSON.stringify(result, null, 2));
	}).catch((error) => {
		console.error(JSON.stringify(error, null, 2));
	});
}

function doStatus(searchString) {
	return engine.getEngineStatus().then((result) => {
		console.log(JSON.stringify(result, null, 2));
	}).catch((error) => {
		console.error(JSON.stringify(error, null, 2));
	});
}

function runCommand(command, args) {
	if(command === 'scan') {
		return doScan()
	} else if(command === 'index') {
		return doIndex()
	} else if(command === 'search') {
			return doSearch(args);
	} else if(command === 'status') {
		return doStatus(args);
	} else if(command === 'exit') {
		process.exit(0);
	} else {
		usage();
		return Promise.resolve();
	}
}

function promptForInput() {
	rl.question('> ', (line) => {
		let matches = line.match(/(\w+)(\s*)(.*)/);
		if(matches) {
			let command = matches[1];
			let args = matches[3];

			runCommand(command, args).catch((error) => {
				console.error(`error running command - ${command}: `, error);
			}).then(() => {
				promptForInput();
			});
		} else {
			usage();
			promptForInput();
		}
	});
}

promptForInput();

