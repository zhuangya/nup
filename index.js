'use strict';

var path = require('path');
var fs = require('fs');
var program = require('commander');
var Package = require('./package');

program.version(Package.version)
  .option('-p, --parallel [parallel]', 'Set Parallel')
  .option('-i, --indent [indent]', 'Set indent')
  .option('-f, --file <file>', 'target file(package.json)')
  .option('-w, --writeback [writeback]', 'writeback to <file>')
  .parse(process.argv);

var target = require(path.join(__dirname, program.file));

var co = require('co');
var chalk = require('chalk');
var request = require('co-request');
var parallel = require('co-parallel');

function *sending (url) {
  console.log(chalk.blue(`GET ${url}`));
  return (yield request(`https://registry.npmjs.org/${url}`)).body;
}

var deps = target.dependencies;

co(function * () {
  var reqs = Object.keys(deps).map(sending);
  var res = yield parallel(reqs, program.parallel || 2);
  var newDep = res.reduce(function (soFar, r) {
    r = JSON.parse(r);
    soFar[r.name] = r['dist-tags'].latest;
    return soFar;
  }, {});

  console.log(chalk.green(formatJSON(newDep, program.indent)));

  if (program.writeback) {
    console.log('writing back to %s', program.file);
    target.dependencies = newDep;
    var writeFile = program.writeback || program.file;
    try {
      fs.writeFileSync(writeFile, formatJSON(target, program.indent));
      fs.appendFileSync(writeFile, '\n');
    } catch (e) {
      console.log(chalk.red(formatJSON(e, program.indent)));
      process.exit(1);
    }
  }

}).catch((err) => {
  console.err(chalk.red(err));
  process.exit(1);
});

function formatJSON (json, indent) {
  indent = +indent;
  try {
    return JSON.stringify(json, null, indent || 2);
  } catch (e) {
    throw e;
  }
}
