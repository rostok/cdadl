# cdadl

cdadl is a Node.js script for downloading videos from cda.pl. Code it's really pretty but should get you idea how to crawl pages, deobfuscate JS and download files.

# Building
get the repo, and install necessary packages with
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
* create batch script
* generate exe with enclose or nexe
* play with assoc and ftype
