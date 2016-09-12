#!/usr/bin/env node
/*
 * script for publishing our modules.
 * called by npm run release
 * creates/pushes GH pages resources from gh-pages/.
 * for now, automatically patches and publishes
 */
'use strict';

var sh = require('shelljs')
  , path = require('path')
  , pkg = require('../package.json');

// scope without @ becomes first slug in reponame
var scope = pkg.name.split('/')[0];
scope = scope.split('@')[1];

// scope + - + name = repo name
var name = pkg.name.split('/')[1];

sh.echo('Getting artifacts..');
if (!sh.test('-d', './gh-pages/coverage/')) sh.exec('npm run coverage');

sh.echo('Publishing to Github Pages');
sh.pushd('gh-pages');

sh.exec('git init');
sh.exec('git config user.name "travis"');
sh.exec('git config user.email "travis"');
sh.exec('git add . --force');
sh.exec('git commit -m "Publish to GH Pages"');
sh.exec('git push --force "https://pici:' + process.env.GHE_TOKEN + '@github.ibm.com/BluemixSolutions/"' + name + ' master:gh-pages');
sh.echo('done like dinner');
sh.popd();

//------------------------------------------------------------------------------
// AUTOMATIC PATCH PUBLISHING FOR PRERELEASE VERSIONS.

sh.echo('cutting version');
// redeclare ourselves because we are back in other repo
sh.exec('git checkout master');
sh.exec('git config user.name "travis"');
sh.exec('git config user.email "travis"');
sh.exec('npm version patch -m "Automatic patch & publish. [ci skip]"');
sh.exec('git push --force "https://pici:' + process.env.GHE_TOKEN + '@github.ibm.com/BluemixSolutions/"' + name + ' master && git push "https://pici:' + process.env.GHE_TOKEN + '@github.ibm.com/BluemixSolutions/"' + name + ' --tags');
