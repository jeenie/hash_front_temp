// var gulp = require('gulp');
// var del = require('del');
// const { series } = require('gulp');

// gulp.task('default',  series(clean, copyIndex));

// function clean(done) {
//   del(['dist']);
//   done(); 
// };

// function copyIndex(done) {
//   return gulp.src('./src/app/app.component.html').pipe(gulp.dest('./dist',
//    {overwrite: true}));
// }

// function copyVendor(done) {
//   var vendor_files = ['./bower_components/angular-cli'];
//   return gulp.src(vendor_files, {base: './node_modules'}).pipe(gulp.dest('./dist/vendor', {overwrite: true}));
//   done();
// }


var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var tsc = require('gulp-typescript');
var tslint = require('gulp-tslint')
var gulpConfig = require('./gulp.config');
const browserSync = require('browser-sync');
var tsProject = tsc.createProject('tsconfig.json');
var superstatic = require('superstatic');

gulp.task('ts-lint',function(){
  return gulp.src('./src/app/*.ts'
  ).pipe(tslint())
})

gulp.task('compile-ts',function(){
  // var sourceTsFiles =[
  //   gulpConfig.config.allTs
  // ];

  var tsResult = gulp.src('./src/app/*.ts'
    ).pipe(sourcemaps.init()
    ).pipe(tsc(tsProject));

  return tsResult.js.pipe(sourcemaps.write('.')
  ).pipe(gulp.dest('./dist/'));
});

gulp.task('serve',function(){
  gulp.watch(['./src/app/*.ts'],['ts-lint','compile-ts']);

  browserSync({
      port:3000,
      file:['index.html','**/*.js'],
      injectChanges :true,
      logFileChanges:false,
      logLevel:'silent',
      notify:true,
      reloadDelay:0,
      server:{
        baseDir:'./dist',
        middleware:superstatic({debug:false})
      }
  });
});

gulp.task('default',gulp.parallel(['serve']));