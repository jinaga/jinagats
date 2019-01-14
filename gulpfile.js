var del = require('del');
var gulp = require('gulp');

var { compileClient } = require('./tasks/client');
var { compileServer } = require('./tasks/server');
var { test, watchTest } = require('./tasks/test');

function clean() {
    return del([ './dist/' ]);
}

gulp.task('clean', clean);

gulp.task('default', gulp.parallel([ compileClient, compileServer ]));