var browserify = require("browserify"),
    concat     = require("gulp-concat"),
    del        = require("del"),
    fs         = require("fs"),
    gulp       = require("gulp"),
    less       = require("gulp-less"),
    liveReload = require("gulp-livereload"),
    minifyCss  = require("gulp-minify-css"),
    minifyHtml = require("gulp-minify-html"),
    path       = require("path"),
    sourcemaps = require("gulp-sourcemaps"),
    uglify     = require("gulp-uglify"),
    util       = require("gulp-util"),
    source     = require("vinyl-source-stream"),
    watchify   = require("watchify");

var useLiveReload = !!util.env["live-reload"];

var paths = {
    html:      "html/*.html",
    builtHtml: "out",

    scriptGovernor: "./script/index.js", // must be relative for Browserify
    scriptLocal:    "script/local.js",   // additional local configuration
    scriptVendorIe: [
        "bower_components/html5shiv/dist/html5shiv.js",
        "bower_components/respond/dest/respond.src.js"
    ],
    builtScript:          "out/js",
    builtScriptGovernor:  "governor.min.js",
    builtScriptVendorIe:  "vendor-ie.min.js",
    builtScriptSourcemap: ".",

    style:               "less/*.less",
    builtStyle:          "out/css",
    builtStyleAll:       "all.min.css",
    builtStyleSourcemap: "."
};

paths.builtLiveReload = [
    paths.builtHtml   + "/*",
    paths.builtScript + "/*",
    paths.builtStyle  + "/*"
];

/**
 * Source a set of paths, perform non-browserify transforms and return a stream.
 *
 * @param string srcPath
 * @param string targetPath
 *
 * @return stream
 */
function sourceScript(srcPath, targetPath) {
    return gulp.src(srcPath)
               .pipe(sourcemaps.init())
                   .pipe(concat(targetPath))
                   .pipe(uglify())
                   .pipe(sourcemaps.write(paths.builtScriptSourcemap));
}

function processScript(stream) {
    stream.pipe(gulp.dest(paths.builtScript));

    return stream;
}

/*
 * Clean up the build directory
 */
gulp.task("clean", function(cb) {
    del("out", cb);
});

/*
 * Static HTML
 */
gulp.task("html", function() {
    var minifyOptions = {
        comments: true // minimize hangs the build if we enable conditionals
    };

    return gulp.src(paths.html)
               .pipe(minifyHtml(minifyOptions))
               .pipe(gulp.dest(paths.builtHtml));
});

/*
 * Cross-browser script (via Browserify)
 */
gulp.task("script", function() {
    var bundler = browserify(paths.scriptGovernor),
        stream  = bundler.bundle().pipe(source(paths.builtScriptGovernor));

    if (fs.readFileSync(paths.scriptLocal).toString() !== "") {
        util.log(util.colors.red("modified local.js found") + " -- don't ship this build to production!");
    }

    return processScript(stream);
});

/**
 * Cross-browser script (via Watchify).
 */
gulp.task("script-watch", function() {
    var bundler = watchify(browserify(paths.scriptGovernor, watchify.args));

    bundler.on("update", function() {
        util.log(util.colors.cyan("'script-watch'") + " handled change");
        var stream = bundler.bundle()
                            .on("error", util.log.bind(util, "Browserify error"))
                            .pipe(source(paths.builtScriptGovernor));
        processScript(stream);
    });
});

/*
 * Poly fill script for IE
 */
gulp.task("script-vendor-ie", function() {
    var stream = sourceScript(paths.scriptVendorIe, paths.builtScriptVendorIe);

    return processScript(stream);
});

/*
 * LESS to CSS
 */
gulp.task("style", function() {
    return gulp.src(paths.style)
               .pipe(less())
               .pipe(minifyCss())
               .pipe(concat(paths.builtStyleAll))
               .pipe(gulp.dest(paths.builtStyle));
});

/*
 * Default task
 */
gulp.task("default", ["html", "script", "script-vendor-ie", "style"]);

/*
 * Watch for changes, build immediately and (optionally) live reload
 */
gulp.task("watch", ["script-watch"], function() {
    gulp.watch(paths.html,     ["html"]);
    gulp.watch(paths.scriptIe, ["script-ie"]);
    gulp.watch(paths.style,    ["style"]);

    /* Add another watcher on build artefacts -- this will ensure LR doesn't
     * handle the change events before Gulp has finished outputting them. */
    if (useLiveReload) {
        liveReload.listen();

        gulp.watch(paths.builtLiveReload, function(file) {
            var relativePath = path.relative(".", file.path);
            util.log(util.colors.magenta(relativePath) + " live reloaded");

            liveReload.changed(file.path);
        });
    }
});
