var http = require('http'),
      fs = require('fs');
    path = require('path');
    util = require('util');

function serveStaticFile(res, path, contentType, responseCode) {
  if(!responseCode) responseCode = 200;
  var read_path = __dirname + '/' + path;
  util.log("Read path:" + read_path);
  fs.readFile(read_path,
    function(err,data) {
      if(err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 - Internal Error:' + err.message);
      } else {
        res.writeHead(responseCode,
          { 'Content-Type': contentType });
        res.end(data);
      }
    }
  );
}

http.createServer(function(req,res){
  // normalize url by removing querystring, optional
  // trailing slash, and making lowercase
  var url_path = req.url.replace(/\/?(?:\?.*)?$/, '').toLowerCase();
  util.log("Request:" + url_path);
  util.log("Request length:" + url_path.length);
  util.log("Res:" + res);
  var content_type = 'text/html';
  var ext = path.extname(url_path);
  if( ext == ".js")
    content_type = 'text/javascript'
  else if(ext == "png")
      content_type = 'image/png';
  else if(ext == "jpg")
      content_type = 'image/jpg';
  if(url_path == '')
    url_path = '/home.html';
  serveStaticFile(res, url_path, content_type);
  //    serveStaticFile(res, '/public/404.html', 'text/html', 404);

}).listen(3000);

console.log('Server started on localhost:3000; press Ctrl-C to terminate....');
