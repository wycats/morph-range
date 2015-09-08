/* jshint node:true */
var QUnit = require('qunitjs');

if (process.argv[2] === 'testem') {
  // TAP output for testem process runner
  var num = 1;
  QUnit.begin(function (details) {
    console.log('1..'+details.totalTests);
  });
  QUnit.testDone(function (details) {
    console.log((details.failed ? 'not ok ' : 'ok ') + (num++) + ' - ' + details.module + ' - ' + details.name);
  });
} else {
  var qe = require('qunit-extras');
  qe.runInContext(global);
}

require('../dist/test');

QUnit.load();

QUnit.start();
