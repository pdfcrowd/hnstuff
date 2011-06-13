//
//  Copyright (c) 2011 <redpill27@gmail.com>
//  This code is freely distributable under the MIT license
//

_ = require('./static/js/underscore');
hncharts = require('./static/js/hncharts');
assert = require('assert');
rest = require('restler');
pdfcrowd = require('pdfcrowd');
fs = require('fs');
http = require('http');
spawn = require('child_process').spawn;


//
// initialization & global variables
var reportTemplate, indexTemplate, reportHeader, reportFooter, cfg;


function readStaticResources() {
    console.log('reading config & layouts');
    reportTemplate = _.template(fs.readFileSync(__dirname + '/layout/report.rhtml').toString());
    indexTemplate = _.template(fs.readFileSync(__dirname + '/layout/index.rhtml').toString());
    reportHeader = _.template(fs.readFileSync(__dirname + '/layout/header.rhtml').toString());
    reportFooter = _.template(fs.readFileSync(__dirname + '/layout/footer.rhtml').toString());
    cfg = JSON.parse(fs.readFileSync('config.json'));
}

readStaticResources();
var parseTwitterUsername = /twitter.com\/([a-zA-Z0-9_]{1,15})| @([a-zA-Z0-9_]{1,15})/i;
var checkUsername = /^ *([a-zA-Z0-9_]+) *$/;
var reportCacheDir = __dirname + '/var/cached-reports/';
var port = process.argv.length == 3 ? parseInt(process.argv[2], 10) : cfg.port;


//
// server
var express = require('express');
var app = require('express').createServer(
    express.bodyParser()
);

app.configure(function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});


//
// main GET
app.get("/hn/best-of-ebook", function(req, res) {
    res.end(indexTemplate(getTemplateContext(req)));
});

function renderErrorResponse(req, res, err) {
    var ctx = getTemplateContext(req);
    ctx.c.error = err;
    res.end(indexTemplate(ctx));
}

function getTemplateContext(req) {
    return {c: { debug: req.param('debug', 0) }};
}



//
// main POST
app.post("/hn/best-of-ebook", function(req, res) {
    m = checkUsername.exec(req.body.username);
    if (m === null) {
        renderErrorResponse(req, res, "Enter a valid username");
        return;
    }
    var username = m[1];

    sendCachedPDF(res, username, function(sent) {
        if (sent === false) {
            // the requested pdf is not cached
            processReportRequest(req, res, username, function(reportData) {
                if (req.body.output === 'html') {
                    res.end(reportTemplate(reportData));
                } else {
                    // create, cache and send pdf
                    sendPdfReport(req, res, reportData);
                }
            });
        }
    });
});



//
// asynchronously calls the search API and the Twitter API
function processReportRequest(req, res, username, onDone) {
    var twitterImageUrl = null;
    var twitterUsername;
    var reportBody;
    var reportData;
    var errorMsg = null;

    // get comments from the search API
    rest.get("http://api.thriftdb.com/api.hnsearch.com/items/_search", {
        query: {
            "filter[fields][username][]" : username,
            "filter[fields][type][]" : "comment",
            "sortby" : "points desc",
            "limit" : 100
        },
        parser: rest.parsers.json
    }).on('error', function() {
        errorMsg = "Can't fetch comments. HN Search API call failed.";
    }).on('complete', function(data) {
        join();
    }).on('success', function(data) {
        if (data.hits > 0) {
            data.username = username;
            data.num_comments = data.results.length;
            _.extend(data, {chart1: hncharts.commentLengthAndPoints(data)});
            reportData = data;
        } else {
            errorMsg = "No comments found";
        }
    })

    // Get user profile from the search API, search for twitter info
    // and if found then get the twitter image URL.
    //
    // Errors are ignored here -> twitter profile image will be missing.
    rest.get("http://api.thriftdb.com/api.hnsearch.com/users/_search", {
        query: {"filter[fields][username][]" : username},
        parser: rest.parsers.json
    }).on('success', function(data) {
        if (data['hits'] == 1) {
            var match = parseTwitterUsername.exec(data.results[0].item.about);
            if (match !== null) {
                twitterUsername = match[1] ? match[1] : match[2];
                var req = http.request({
                    host: 'api.twitter.com',
                    port: 80,
                    path: '/1/users/profile_image/' + twitterUsername + '?size=bigger',
                    method: 'GET'
                }, function(res) {
                    if (res.statusCode == 302) {
                        twitterImageUrl = res.headers["location"];
                    }
                    join();
                });
                req.on('error', function(e) {
                    join(); // twitter API problem

                });
                req.end();
            } else {
                join(); // twitter username not found
            }
        }
        else {
            join(); // user not found
        }
    }).on('error', function(data) {
        join();
    });

    // finish the request (waits for the two async requests above)
    var join = _.after(2, function() {
        if (errorMsg === null) {
            reportData.twitter_image = twitterImageUrl;
            reportData.twitter_username = twitterUsername;
            onDone(reportData);
        } else {
            renderErrorResponse(req, res, errorMsg)
        }
    });
}

function getPdfNames(username) {
    return {
        pdf: username + '.pdf',
        cachedPath: reportCacheDir + username + '.pdf'
    };
}

//
// send the cached version and return true; if the pdf is not in the
// cache then return false
function sendCachedPDF(res, username, callback) {
    name = getPdfNames(username);
    if (cfg.useCache) {
        var cachedPdfStream = fs.createReadStream(name.cachedPath);
        cachedPdfStream.on('error', function(err) {
            callback(false);
        });
        cachedPdfStream.on('open', function() {
            sendPdfHeaders(res, name.pdf);
            cachedPdfStream.pipe(res);
        });
        cachedPdfStream.on('end', function() {
            spawn('touch', [name.cachedPath]);
            callback(true);
        });
    } else {
        callback(false); // cache is turned off
    }
}


//
// send HTTP headers for the pdf response
function sendPdfHeaders(res, pdfName) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("Content-Disposition", 'attachment; filename="' + pdfName + '"');
}


//
// to avoid race conditions or corrupted pdfs, the pdf is saved to a
// temp location first and then moved to the cache
var tmpPdfCounter = 0;
function getCachedPdfWriteStream(name) {
    if (cfg.useCache) {
        tmpName = '/tmp/' + name.pdf + '-' + tmpPdfCounter++ + '-' + process.pid;
        var cachedPdfStream = fs.createWriteStream(tmpName, { flags: 'w+' });
        cachedPdfStream.on('close', function() {
            fs.rename(tmpName, name.cachedPath, function(err) { if (err) throw err; });
        });
    } else {
        // cache is off - noop stream
        var cachedPdfStream = { write: function(){}, destroy: function(){} }
    }
    return cachedPdfStream;
}



//
// Creates the pdf and send it back to the client. The generated pdf
// is cached if the cache is enabled.
function sendPdfReport(req, res, reportData) {
    var client = new pdfcrowd.Pdfcrowd(cfg.pdfcrowdAccount.username,
                                       cfg.pdfcrowdAccount.apikey);
    client.convertHtml(reportTemplate(reportData), {
        pdf: function(pdfStream) {
            var name = getPdfNames(reportData.username);
            var cachedPdfStream = getCachedPdfWriteStream(name);
            sendPdfHeaders(res, name.pdf);
            pdfStream.on('data', function(data) {
                res.write(data);
                cachedPdfStream.write(data);
            });
            pdfStream.on('end', function() {
                res.end();
                cachedPdfStream.destroy();
            });
        },
        error: function(errMsg, statusCode) {
            renderErrorResponse(req, res, "PDF generation error");
            console.error("Pdfcrowd error:", errMsg);
        },
        end: function() {
        }
    }, 
    {
        width: "11in",
        height: "8.5in",
        vmargin: ".4in",
        hmargin: ".6in",
        pdf_scaling_factor: "1.0",
        html_zoom: "200",
        initial_pdf_zoom_type: "3",
        page_layout: "1",
        footer_html: reportFooter(reportData)
        // header_html: reportHeader(reportData)
    });
}




console.log("[%d] listening on %d", process.pid, port);
app.listen(port);

process.on('SIGHUP', function() { readStaticResources(); });
process.on('SIGINT', function() { 
    console.log("closing the server");
    app.close(); 
});


