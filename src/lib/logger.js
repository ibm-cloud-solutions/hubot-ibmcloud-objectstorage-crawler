/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const settings = require('../lib/env');
const winston = require('winston');

module.exports = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({
			level: settings.log_level,
			silent: Boolean(process.env.SUPPRESS_ERRORS) || false,
			prettyPrint: true,
			colorize: true,
			timestamp: function(){
				return '[' + new Date().toDateString() + ' ' + new Date().toTimeString() + ']';
			}
		})
	]
});
