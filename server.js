var http = require('http'),
      fs = require('fs'),
    path = require('path'),
    util = require('util');


var workspace = "project";  // POST function can only access this subdirectory
if(process.argv.length > 2)
  workspace = process.argv[2];
var pth = path.join(__dirname,workspace);  // first assume this is subdirectory
try {
  if(fs.lstatSync(pth).isDirectory())
    workspace = pth;
  else {
    pth = null;
    util.error("Workspace in relative path is not a directory.");
  }
} catch(err) {
  pth = null;
  util.error("Workspace not in relative path.");
}
if(pth)
  workspace = pth;  // successfully found workspace in relative path
else {
  pth = workspace;
  try {
    if(!fs.lstatSync(workspace).isDirectory()) { // assume it is full path
      workspace = null;
      util.error("Workspace in absolute path is not a directory.");
    } else {
      util.log("WARNING!!! Workspace has absolute path. WARNING!!!");
    }
  } catch(err) {
    workspace = null;
    util.error("Workspace not in absolute path.");
  }
}
if(!workspace)
  util.log('Server workspace "'+pth+'" not found either relative or absolute.');


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

function loadData(res,load_path,xtns) {
  pth = buildSafePath(res,load_path);
  if(!pth)
    return;
  //try {
    var xtn_list;
    if(typeof xtns !== 'undefined')
      xtn_list = xtns.split(',');
    if(fs.lstatSync(pth).isDirectory()) {
      fs.readdir(pth,
        function(err,data) {
          if(err) {
            response = '500 - Internal Error:' + err.message;
          } else {
            var darray = [];
            for(var i in data) {
              var p = path.join(pth, data[i]);
              //console.log(p);
              var t = "file";
              if(fs.lstatSync(p).isDirectory())
                t = "dir";
              else if(typeof xtns !== 'undefined' && xtn_list.indexOf(path.extname(p).substr(1)) < 0)
                continue;  //xtn not in xnt_list so this item not in path
              var ft = {type:t,name:data[i]};
              darray.push(ft);
            }
            console.log("Found "+ darray.length + " items");
            rtnval = {type:'dir', path: load_path, dir:darray};
            response = JSON.stringify(rtnval);
          }
          //console.log("Response:" + response);
          respondPost(res,response);
        }
      );
    } else {
      fs.readFile(pth,
        function(err,data) {
          if(err) {
            response = '500 - Internal Error:' + err.message;
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
      );
    }
  //} catch(err) {
  //  respondPost(res,'500 - Internal Error:' + err.message);
  //}
}

var pathExt = "";

function buildSafePath(res,rel_path) {
  if(!workspace) {
    response = '500 - Error: Server workspace not found.';
    respondPost(res,response);
    return null;
  }
  var pathExt = decodeURI(rel_path);
  console.log("Path Extension:"+pathExt);
  if(pathExt.indexOf("..") >= 0) {  //we don't want anyone hacking into a parent directory
    response = '500 - Error: Attempting to access parent directories';
    respondPost(res,response);
    return null;
  }
  var pth = path.join(workspace, pathExt);
  console.log(pth);
  return pth;
}

function saveData(res,save_path,data,overwrite) {
  pth = buildSafePath(res,save_path);
  if(!pth)
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
    util.log("Request:" + req.url);
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
      var pth = decodeURI(post_obj.path);
      if(post_obj.hasOwnProperty('subpath')) {
        if(post_obj.subpath === 'parent_directory') {
          // this is special for returning to parent
          pth = path.dirname(pth);
        } else {
          pth = path.join(pth, decodeURI(post_obj.subpath));
        }
      }
      console.log("Combined path:"+pth);
      switch(post_obj.command) {
        case 'save':
          saveData(res,pth,post_obj.data);
          break;
        case 'list':  // the same as load only using a path to a directory
        case 'load':
          loadData(res,pth,post_obj.xtns);
          break;
        default:
          rtnval = {type:'ack',msg:'unknown command'};
          respondPost(res,JSON.stringify(rtnval));
      }
    });
  }

}).listen(3000);

console.log('Server started on localhost:3000; press Ctrl-C to terminate....');
