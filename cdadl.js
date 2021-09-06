process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // hell with protection

const https = require('https')
const spawn = require('child_process').spawn;
var moment = require('moment');
var fs = require('fs');
var util = require('util');
var Crawler = require("crawler");
var request = require('request').defaults({ jar: true });
var progress = require('request-progress');
var readlineSync = require('readline-sync');

var downloads = {};
var filenamePrefix = "";
var title;
var savedResult = "";

function downloadMovie(movieURL) {
    if (movieURL === null || movieURL === "" || movieURL.indexOf(".mp4") === -1) {
        console.log("aborting, bad videourl:", movieURL);
        fs.writeFileSync('result.html', savedResult, {
            flags: 'w+'
        });
        return;
    }
    console.log("v.url:\t", movieURL);

    var startTime = process.hrtime();
    var fl = movieURL.split("?")[0].split("/").pop().trim();

    filenamePrefix = title.replace(/[^a-z0-9]/gi, '.');

    fl = filenamePrefix + "." + fl.split("/").pop().trim();
    fl = fl.replace(/\.\./g, ".");
    console.log("outfile:", fl);

    console.log("aria2c ", movieURL, " -o ", fl);

    if (process.argv[process.argv.length - 1].includes("aria")) {
        console.log("calling aria...");
        spawn('aria2c', [movieURL, "-o", fl], {
            detached: true,
            shell: true
        });
        console.log("bye bye...");
        process.exit();
    }

    var fileSizeInBytes = 0;
    try {
        var stats = fs.statSync(fl);
        fileSizeInBytes = stats.size;
    } catch (e) {}

    var headers = {
        'User-Agent': 'CDADL',
        'Cookie': '',
        'Accept-Ranges': 'bytes',
    };

    request({
        url: movieURL,
        method: "HEAD",
        headers: headers
    }, function callback(err, inc, res) {
        //    try {        
        if (inc == undefined) {
            console.log("inc:", inc);
            console.log("err:", err);
            process.exit();
        }
        var conlen = inc.headers['content-length'];
        //console.log("conlen"+conlen);
        if (fileSizeInBytes < conlen) {
            rng = 'bytes=' + fileSizeInBytes + '-' + (conlen - 1);
            headers.Range = rng;
            //console.log(rng);
            //console.log(headers);
            progress(request({
                    url: movieURL,
                    headers: headers
                }), {
                    throttle: 1000, // Throttle the progress event to 2000ms, defaults to 1000ms
                    delay: 500, // Only start to emit after 1000ms delay, defaults to 0ms
                    startSize: fileSizeInBytes,
                    totalSize: conlen
                })
                .on('response', function (resp) {
                    if (resp.statusCode != 200) {
                        //console.error("statusCode:", resp.statusCode);
                        //process.exit();
                        //console.log("e:", err);
                        //console.log("i:", inc);
                        //console.log("resp:", resp);
                        //console.log("resp:", resp.headers);
                    }
                })
                .on('progress', function (state) {
                    var diffTime = process.hrtime(startTime);
                    var ETA = diffTime[0] / state.size.transferred * (state.size.total - state.size.transferred);
                    ETA = "ETA " + moment("2015-01-01").startOf('day').seconds(ETA).format('H:mm:ss');
                    //ETA = "ETA "+moment.duration(ETA, "seconds").humanize();

                    status =
                        //("      "+(state.percentage*100).toFixed(2)).slice(-6) + "% " +  // this request percentage
                        ("      " + ((fileSizeInBytes + state.size.transferred) * 100 / conlen).toFixed(2)).slice(-6) + "% " + // total file percentage
                        ("               " + ((fileSizeInBytes + state.size.transferred) / 1024 / 1024).toFixed(1) + "/" + ((fileSizeInBytes + state.size.total) / 1024 / 1024).toFixed(1)).slice(-15) + "MB " +
                        " @" + (state.speed / 1024).toFixed(1) + "kB/s " + ETA;
                    //console.log(status);
                    downloads[fl] = status;
                    //console.log('\x1B[2J');
                    //util.print("\u001b[2J\u001b[0;0H");

                    var dls = 0;
                    for (var property in downloads) {
                        //console.log(downloads[property] + "\t" + property+"\r");
                        process.stdout.clearLine();
                        process.stdout.write(downloads[property] + "\t" + property);
                        process.stdout.write("\r");
                        dls++;
                    }
                    //console.log('\x1B['+dls+'A');
                    //console.log(state);
                })
                .on('error', function (err) {
                    fs.writeFileSync('error', util.inspect(result, true, null), {
                        flags: 'w+'
                    });
                    console.error("ERROR!", err);
                })
                .pipe(fs.createWriteStream(fl, {
                    flags: 'a'
                }))
                .on('close', function (err) {});
        } else {

            try {
                var stats = fs.statSync(fl);
                fileSizeInBytes = stats.size;
                if (fileSizeInBytes < conlen) {
                    console.log("\n\ndownload incomplete");
                    process.exit();
                }
            } catch (e) {
                console.log("\n\nerror while fs.statSync()", fl, e);
                process.exit();
            }

            console.log("\n\ndownload complete");
            process.exit();
        }
        //    }
        //    catch (ex) {
        //        console.log("downloadUrl failed, exiting");
        //           process.exit();
        //    }
    });
}


var c = new Crawler({
    userAgent: 'cdadl', // Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.87 Safari/537.36
    encoding: null,
    maxConnections: 1,
    // This will be called for each crawled page
    callback: function (error, result, $) {

        savedResult = result.body;

        try {
            // first get the formats
            var playerDataJSON = $("div[player_data]").attr("player_data") || "";
            if (playerDataJSON=="") {
                throw "player_data JSON not found";
            }
            var playerData = JSON.parse(playerDataJSON);
            if (!playerData || !playerData.video || !playerData.video.qualities) throw "player_data has no qualities";
            var qs = playerData.video.qualities;
            var formats = Object.keys(qs).concat(Object.keys(qs).map(k=>qs[k])); // old node has no Object.values() 
            console.log("formats:  "+formats.join(" "));

            if (formats.length==0) throw "no formats found";

            var fmt = formats[formats.length-1];
            // if format is passed into command line
            if (process.argv.length > 3 && formats.indexOf(process.argv[3]) > -1) fmt = process.argv[3];
            fmt = Object.keys(qs).map(k=>qs[k]).find(v => v == fmt || v == qs[fmt]) ;

            title = $("title").text();
            console.log("title:    " + title);
            console.log("fetching: " + result.uri);

            // get the video link with jsonrpc request via https
            console.log("req...");
            const data = `{"jsonrpc":"2.0","method":"videoGetLink","params":["${playerData.video.id}","${fmt}",${playerData.video.ts},"${playerData.video.hash2}",{}],"id":1}`;

            https.request(
            				{host: "www.cda.pl", port:443, path:"/", method:'POST',headers:{'User-Agent':'Chrome'}},
            				res => {
                            		res.on('data', d => { 
                            			// videoGetLink response received
                            			d = d.toString();
                            			var r = JSON.parse(d);
                            			if (r.result.status!="ok") {
                            				console.error("-------------------");
                            				console.error(res.req._header+data);
                            				console.error("-------------------");
                            				console.error(d);
                            				console.error("-------------------");
                            				throw "videoGetLink status not ok";
                            			}
                            			downloadMovie(r.result.resp); 
                            		})
                			})
                .on('error', error => { throw "videoGetLink error "+error;})
                .end(data);
        } 
        catch (ex) {
            console.error("unexpected error happened, see result.html and investigate the website");
            fs.writeFileSync('result.html', result.body, { flags: 'w+' });
            console.log(ex);
            process.exit();
        }
    }
});


// start
if (process.argv.length < 3) {
    console.log("syntax: cdadl URL [format] [filename-prefix] [aria]");

    // process.argv[0] exe
    // process.argv[1] script
    // process.argv[2] url
    // process.argv[3] format
    // process.argv[4] prefix

    process.exit();
}

paramurl = process.argv[2];
if (process.argv.length > 3 && !process.argv[process.argv.length - 1].includes("aria")) filenamePrefix = process.argv[process.argv.length - 1] || "";

if (paramurl.substring(0, 4) != "http") {
    console.error("O gosh, there is no URL");
    var paramurl = readlineSync.question('Enter URL or video ID now:');
}

if (paramurl.length > 0) {
    var s = paramurl.split("/");
    paramurl = "http://ebd.cda.pl/666x666/" + s.pop();
    //console.log(paramurl);
    c.queue(paramurl);
} else {
    process.exit();
}