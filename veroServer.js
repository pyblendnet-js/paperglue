var http = require('http'),
      fs = require('fs'),
    path = require('path'),
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

function loadData(res,load_path) {
  pth = buildSafePath(res,load_path);
  if(!pth)
    return;
  fs.readFile(pth,
    function(err,data) {
      if(err) {
        response = '500 - Internal Error:' + err.message;
      } else {
        var isDirectory = false;
        try {
          isDirectory = fs.lstatSync(pth).isDirectory();
        } catch(e) {
          response = '500 - Error:'+e;
          respondPost(res,response);
          return;
        }
        if(isDirectory) {
          var darray = [];
          for(var i in data) {
            var p = path.join(pth, data[i]);
            //console.log(p);
            var t = "file";
            if(fs.lstatSync(p).isDirectory())
              t = "dir";
            var ft = {type:t,name:data[i]};
            darray.push(ft);
          }
          rtnval = {type:'dir', path: path_ext, dir:darray};
          response = JSON.stringify(rtnval);
        } else {
          //console.log("Response:" + response);
          console.log("File is of length:" + data.length);
          console.log("Type:" + (typeof data));
          rtnval = {type:'file',data:data.toString()};
          response = JSON.stringify(rtnval);
        }
        console.log("Response:" + response);
        respondPost(res,response);
      }
    }
  );
}

function buildSafePath(res,rel_path) {
  var path_ext = decodeURI(rel_path);
  console.log("Path Extension:"+path_ext);
  if(path_ext.indexOf("..") >= 0) {  //we don't want anyone hacking into a parent directory
    response = '500 - Error: Attempting to access parent directories';
    respondPost(res,response);
    return null;
  }
  return path.join(__dirname, path_ext);
}

function saveData(res,save_path,data,overwrite) {
  pth = buildSafePath(res,save_path);
  if(!path)
    return;
  console.log("Path:"+pth);
  isDirectory = false;
  try {
    if(fs.lstatSync(pth).isDirectory()) {
      response = '500 - Error: Attempting to write to directory';
      respondPost(res,response);
      return;
    } else if(!overwrite) {
      rtnval = {type:'ack',msg:'fileExists'};
      respondPost(res,rtnval);
      return;
    }
  } catch(e) {
    // file does not exist yet - could have also used if (fs.existsSync(path))
  }
  try {
    console.log("Attempting to write " + data.length + "bytes to path:"+pth);
    fs.writeFile(pth,data,
      function(err) {
        if(err) {
          response = '500 - Internal Error:' + err.message;
        } else {
          console.log("File written");
          rtnval = {type:'ack',msg:'data saved'};
          response = JSON.stringify(rtnval);
        }
        respondPost(res,response);
      }
    );
  } catch(err) {
    respondPost(res,'500 - Internal Error:' + err.message);
  }
}

function respondPost(res,resval) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(resval);
}

http.createServer(function(req,res){
  util.log("Request method:" + req.method);
  if (req.method == 'GET') {
    // normalize url by removing querystring, optional
    // trailing slash, and making lowercase
    var url_path = req.url.replace(/\/?(?:\?.*)?$/, '').toLowerCase();
    util.log("Request:" + url_path);
    util.log("Request length:" + url_path.length);
    util.log("Res:" + res);
    var content_type = 'text/html';
    var ext = path.extname(url_path);
    if( ext == ".js")
      content_type = 'text/javascript';
    else if(ext == "png")
        content_type = 'image/png';
    else if(ext == "jpg")
        content_type = 'image/jpg';
    if(url_path === '')
      url_path = '/home.html';
    serveStaticFile(res, url_path, content_type);
    //    serveStaticFile(res, '/public/404.html', 'text/html', 404);
  } else if (req.method == 'POST') {
    var post_data = '';
    req.on('data', function (data) {
      post_data += data;
    });
    req.on('end', function() {
      // every end path must end with a respondPost(res,string)
      console.log('RECEIVED THIS DATA:\n'+ post_data);
      var response = '';
      var post_obj;
      try {
        post_obj = JSON.parse(post_data);
      } catch(err) {
        respondPost(res,'500 - Error: JSON Parse Error:' + err.message);
        return;
      }
      var rtnval;
      switch(post_obj.command) {
        case 'save':
          saveData(res,post_obj.path,post_obj.data);
          break;
        case 'list':  // the same as load only using a path to a directory
        case 'load':
          loadData(res,post_obj.path);
          break;
        default:
          rtnval = {type:'ack',msg:'unknown command'};
          respondPost(res,JSON.stringify(rtnval));
      }
    });
  }

}).listen(3000);

console.log('Server started on localhost:3000; press Ctrl-C to terminate....');