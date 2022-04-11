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
var paramurls = [];
var savedResult = "";

function downloadMovie(movieURL, title="") {
    if (movieURL === null || movieURL === "" || movieURL.indexOf(".mp4") === -1) {
        console.log("aborting, bad videourl:", movieURL);
        fs.writeFileSync('result.html', savedResult, {
            flags: 'w+'
        });
        return;
    }
    //console.log("v.url:\t", movieURL);

    var startTime = process.hrtime();
    var fl = movieURL.split("?")[0].split("/").pop().trim();

    title = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    fl = filenamePrefix + title.replace(/[^a-z0-9]/gi, '.') + "." + fl.split("/").pop().trim();
    fl = fl.replace(/\.+/g, ".");
    console.log("outfile:", fl);

    console.log("aria2c", movieURL, "-o", fl);

    if (process.argv[process.argv.length - 1].includes("aria")) {
        console.log("calling aria...");
        spawn('aria2c', [movieURL, "-o", fl], {
            detached: true,
            shell: true
        });
        console.log("bye bye...");
        return;
        //process.exit();
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
                    
                    downloads[fl] = state;
                    downloads[fl].info = 
                    ("      " + ((fileSizeInBytes + state.size.transferred) * 100 / conlen).toFixed(2)).slice(-6) + "% " + // total file percentage
                    ("               " + ((fileSizeInBytes + state.size.transferred) / 1024 / 1024).toFixed(1) + "/" + ((fileSizeInBytes + state.size.total) / 1024 / 1024).toFixed(1)).slice(-15) + "MB " +
                    " @" + (state.speed / 1024).toFixed(1) + "kB/s " + ETA;
                    downloads[fl].startSize = fileSizeInBytes;
                    var keysSorted = Object.keys(downloads).sort();
                    var t = { rec: 0, tot: 0, per:0 };
                    downloadStatus = "";
                    for (var dls = 0; dls < keysSorted.length; dls++) {
                        var curdown = downloads[keysSorted[dls]];
                        process.stdout.clearLine();
                        downloadStatus += "\033[2K"+curdown.info + "\t" + keysSorted[dls] + "\n";
                        if (curdown.size) t.rec += curdown.size.transferred + curdown.startSize;
                        if (curdown.size) t.tot += curdown.size.total + curdown.startSize;
                    }
                    t.per = ("   " + parseInt(t.rec * 100 / t.tot) * 1).substr(-3);
                    if (dls>1) {
                        downloadStatus += "------------------------------------------------------------------------------------------------------------------\n";
                        downloadStatus += (t.rec / 1024 / 1024).toFixed(2) + "/" + (t.tot / 1024 / 1024).toFixed(2) + "M \t" + t.per + "% TOTAL\n";
                    }
                    downloadStatus = downloadStatus.split("\n").map(s=>s.substring(0,process.stdout.columns-2)).join("\n");
                    // dls += 3;
                    // console.log('\033[' + dls + 'A');
                    console.log(downloadStatus+'\033[' + ((downloadStatus.match(/\n/g) || []).length+1) + 'A')
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
    maxConnections: 100,
    // This will be called for each crawled page
    callback: function (error, result, done) {
        var $ = result.$;
        savedResult = result.body;

        try {
            console.log("fetching: " + result.uri);
            var title = $("title").text();
            console.log("title:    " + title);

            // first get the formats
            var playerDataJSON = $("div[player_data]").attr("player_data") || "";
            if (playerDataJSON=="") {
                console.error("player_data JSON not found at "+result.uri);
                return;
            }
            var playerData = JSON.parse(playerDataJSON);
            if (!playerData || !playerData.video || !playerData.video.qualities) throw "player_data has no qualities";
            var qs = playerData.video.qualities;
            var formats = Object.keys(qs).concat(Object.keys(qs).map(k=>qs[k])); // old node has no Object.values() 
            console.log("formats:  "+formats.join(" "));

//            console.log(">>>",process.argv.slice().pop());
//            console.log(">>>",process.argv.slice());
    		if (process.argv.slice().pop()=="info") return;
            if (formats.length==0) throw "no formats found";

            var fmt = formats[formats.length-1];
            // if format is passed into command line
            if (process.argv.length > 3 && formats.indexOf(process.argv[3]) > -1) fmt = process.argv[3];
            fmt = Object.keys(qs).map(k=>qs[k]).find(v => v == fmt || v == qs[fmt]) ;

            // get the video link with jsonrpc request via https
            //console.log("req...");
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
                            			downloadMovie(r.result.resp, title); 
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
    console.log("syntax: cdadl URL[ URL2 URL3 ... ] [format] [filename-prefix] [aria|info]");
    // process.argv[0] exe
    // process.argv[1] script
    // process.argv[2] url
    // process.argv[3] format
    // process.argv[4] prefix
    process.exit();
}

filenamePrefix = process.argv.slice(2).filter(p=>!(p.startsWith("http")||p=="aria"||p=="info"||p=="-")).pop() || "";
paramurls = process.argv.slice(2).filter(p=>/\d+/.test(p)||p.startsWith("http"));

if (process.argv[2]=="-") paramurls = paramurls.concat( (fs.readFileSync(0)||"").toString().split("\n") );

if (paramurls.length > 0) {
	paramurls.forEach(p=>{
        var s = p.split("/");
        //        p = "http://ebd.cda.pl/666x666/" + s.pop();
        p = "https://ebd.cda.pl/620x395/" + s.pop();
        c.queue(p);
    });
} else {
    console.error("O gosh, there are no URLs or video IDs in command line parameters!");
    process.exit();
}