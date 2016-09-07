# cdadl

cdadl is a Node.js script for downloading videos from cda.pl. Code it's really pretty but should get you idea how to crawl pages, deobfuscate JS and download files.

# Building
Get the repo, and install necessary packages with
```
npm install
```

# Usage
Run with node like this:
```
node cdadl.js [video-url] [format] [filename-prefix]
```
Example:

```
node cdadl.js http://www.cda.pl/video/666 720p some.movie.
```

# Advanced usage in Windows
Remember that you can also:
* create a batch script
* generate exe withe [enclose](https://www.npmjs.com/package/enclose) or [nexe](https://www.npmjs.com/package/nexe)
* play with [ASSOC](http://ss64.com/nt/assoc.html) and [FTYPE](http://ss64.com/nt/ftype.html)
