(function() { // using the module pattern to provide name space
	// see http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
	// but exporting public methods via window.globals - no public variables

	var relativePath = "";
	//var recordPath = "recordSave.pgl"; //default save path for node server

	function SendData(data) {
		console.log('Sending' + data.length + 'bytes to ' + window.location.href);
		var xhr = new XMLHttpRequest();
		xhr.open('POST', window.location.href, true);
		xhr.onerror = function(e) {
			console.error(xhr.statusText);
		};
		xhr.onload = OnLoad;
		//console.log(xhr);
		xhr.send(data);
	}

	function OnLoad(e) {
			var xhr = this;
			console.log("E:" + e);
			console.log("Ready state:", xhr.readyState);
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					console.log("Response:" + xhr.responseText);
					//console.log("Response Type:"+xhr.responseType);
					if (xhr.responseText.length === 0) {
						console.log("Server listening!");
					} else {
						if (typeof nodeComms.onReply === 'function')
							nodeComms.onReply(xhr.responseText);
					}
				} else {
					console.error("Error:" + xhr.statusText);
				}
			}
		}
		//
		// function fileSelected(fid) {
		//   var req = "ls " + encodeURI(fid) + " " + encodeURI(basePath);  // encode necessary to avoid space problem
		//   console.log(req);
		//   SendData(req);
		// }

		var fileSelector;
		// function has arguments:
		// objective, xtns, dir_obj, [dir_cmd, select_callback]
		// see dialog.js for example function
		// see paperGlueDialogs.js for example usage
		// object is text describing action to take with chosen file name

		function setFileSelector(file_selector) {
			fileSelector = file_selector;
		}

		function listFiles(objective, xtns, path, subpath, file_selector) {
	    console.log("List " + xtns + " from " + path + " / " + subpath +
	      " for " +
	      objective);
			if(typeof file_selector === 'function')	  // may have been already set
			  fileSelector = file_selector;
	    listObjective = objective;
	    listXtns = xtns;
	    if (window.location.protocol === 'file:') {
	      console.log("Local storage listing");  // so path is irrelevant
	      if (typeof fileSelector === 'function') {
	        var local_storage_objects = Object.keys(localStorage);
	        console.log("Local storage objects:" + local_storage_objects);
	        // xtns don't really apply to local storage
	        fileSelector(listObjective, listXtns, {
	          type: "dir",
	          path: "localStorage",
	          dir: local_storage_objects
	        });
	      }
	    } else if (typeof nodeComms.sendData === 'function') {
	      // node js storage
	      nodeComms.onReply = onLoadReply;
	      if (typeof path === 'undefined')
	        path = "";  //relativePath += path;
	      console.log("Attempting to list from:" + path);  //relativePath);
	      postObject = {
	        command: 'list',
	        xtns: listXtns,
	        path: path  // relativePath
	      };
				if(listXtns.length > 0)  // so "" is wildcard
				  postObject[xtns] = listXtns;
	      if (typeof subpath !== 'undefined')
	        postObject.subpath = subpath;
	      // note: a special subpath can be "parent_directory"
	      //       This is required as ".." is not allowed
	      // note: relativePath will be corrected by onLoadReply
	      nodeComms.sendData(JSON.stringify(postObject));
	    }
	  }

		function saveFile(jdata, path, subpath) {
			console.log("jdata:" + jdata);
			if (window.location.protocol == 'file:') {
				// might try to impletement local storage some day
				console.log("Storage type:" + typeof(Storage));
				if (typeof(Storage) === "undefined") {
					console.log("Local storage not implemented");
				} else {
					console.log("Data:" + jdata);
					if (typeof path === 'undefined')
						subpath = "data";
					localStorage[subpath] = jdata;
					console.log("Local storage:" + localStorage);
				}
			} else if (typeof nodeComms.sendData === 'function') {
				var save_data = {
					command: 'save',
					data: jdata
				};
				// obsolete was default: path: recordPath,
				if (typeof path !== 'undefined')
					save_data.path = path;
				if (typeof subpath !== 'undefined')
					save_data.subpath = subpath;
				nodeComms.sendData(JSON.stringify(save_data));
			}
		}

		var fileParser;

		function setFileParser(file_parser) {
			fileParser = file_parser;
		}

		function loadFile(path, subpath, file_parser) {
	    console.log("Load");
			if(typeof file_parser === 'function')
			  fileParser = file_parser;
	    console.log(window.location.protocol);
	    if (window.location.protocol === 'file:') {
	      console.log("Using local storage");
	      if (typeof(Storage) === "undefined") {
	        console.log("Local storage not implemented");
	      } else {
	        if (typeof path === 'undefined')
	          subpath = "data";
	        if (localStorage.hasOwnProperty(subpath)) {
	          console.log("Parsing length = " + localStorage[subpath].length);
						console.log(fileParser);
	          fileParser(localStorage[subpath]);
	        } else {
	          alert("Local storage has no item of name:" + subpath);
	        }
	      }
	    } else if (typeof nodeComms.sendData === 'function') {
	      console.log("Loading from node js server storage");
	      nodeComms.onReply = onLoadReply;
	      //console.log("Attempting to load:" + recordPath);
				// obsolete path: recordPath
	      postObject = {
	        command: 'load',
	      }; //xtns not required
	      if (typeof path !== 'undefined')
	        postObject.path = path;
	      if (typeof subpath !== 'undefined')
	        postObject.subpath = subpath;
	      nodeComms.sendData(JSON.stringify(postObject));
	    }
	  }

	  function onLoadReply(res) {
	    console.log("Onreply:" + res);
	    if (res.indexOf('500') === 0) { //starts with error code
	      console.log("Report error:" + res);
	    } else {
	      console.log("attempting to parse json object");
	      //try {
	      var reply_obj = JSON.parse(res);
	      console.log(reply_obj);
	      switch (reply_obj.type) {
	        case 'file':
	          fileParser(reply_obj.data);
	          break;
	        case 'dir':
	          relativePath = reply_obj.path;
	          if (typeof fileSelector === 'function')
	            fileSelector(listObjective, listXtns, reply_obj,{module:"nodeComms",funct:"listFiles"});
							// assumes fileSelect return callback has been set in module
							// e.g for dialog.js, use setSelectFileCallback(function)
	          // listObject is also the name for the function to call on rtn
	          break;
	      }
	      //} catch(e1) {
	      //  console.log("Error parsing reply"+e1);
	      //}
	    }
	  }

	// give other modules access to SendData
	window.globals.nodeComms = {
		sendData: SendData,
		setFileSelector: setFileSelector,
		listFiles: listFiles,
		saveFile:saveFile,
		setFileParser: setFileParser,
		loadFile:loadFile
	};
	//nodeComms = window.globals.nodeComms;  // for dependant function
	// to attach: onReply(res)
	if (typeof globals.moduleLoaded === 'function')
	  globals.moduleLoaded('nodeComms');
}());
