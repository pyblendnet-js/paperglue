(function() { // using the module pattern to provide name space

  var globals = window.globals;

  function initMenus() {
    var fileMenu = [ // must appear before use in default menu
      {
        label: 'new',
        callback: paperGlue.removeAll
      }, {
        label: 'open from',
        callback: loadRecordAs
      }, {
        label: 'save as',
        callback: saveRecordAs
      }
    ];

    if (window.location.protocol === 'file:') {
      fileMenu.push({
        label: 'open doRecord',
        callback: loadRecord
      });
      fileMenu.push({
        label: 'save doRecord',
        callback: saveRecord
      });
    } else {
      fileMenu.push({
        label: 'open doRecord.pgl',
        callback: loadRecord
      });
      fileMenu.push({
        label: 'save doRecord.pgl',
        callback: saveRecord
      });
      fileMenu.push({
        label: 'save imgAvail.js',
        callback: buildImgAvail
      });
    }

    var stateMenu = [{
      label: 'clear',
      callback: paperGlue.clearAll
    }, {
      label: 'delete',
      callback: paperGlue.deleteState
    }, ];

    function toggleAreas() { // function is only used for menus
      console.log("Option:" + optionsContextMenu[0].label);
      if (paperGlue.toggleAreas())
        optionsContextMenu[0].label = 'hide areas';
      else
        optionsContextMenu[0].label = 'show areas';
      console.log("Option:" + optionsContextMenu[0].label);
    }

    var optionsContextMenu = [{
      label: 'hide areas',
      callback: toggleAreas
    }];

    var exportMenu = [{
      label: '  js as doRec.js',
      callback: paperGlue.saveDoRec
    }, ];

    var importMenu = [{
      label: 'import dorec.js',
      callback: paperGlue.loadDoRec
    }, ];

    var defaultContextMenu = [{
      label: 'file',
      submenu: fileMenu
    }, {
      label: 'state',
      submenu: stateMenu
    }, {
      label: 'options',
      submenu: optionsContextMenu
    }, {
      label: 'image',
      callback: loadImage
    }, {
      label: 'export',
      submenu: exportMenu
    }, {
      label: 'import',
      submenu: importMenu
    }];

    contextMenu.setDefault(defaultContextMenu);
  }

  var imageExtensions = "jpg,png";

  // import dependancies when you are sure all are loaded
  function init() {
    paperGlue = globals.paperGlue;
    dialog = globals.dialog;
    nodeComms = globals.nodeComms;
    contextMenu = globals.contextMenu;
    initMenus();
    globals.chainKey = onKey;
    paperGlue.setContextMenu(); // contextMenu is an optional module for paperGlue but not when used with pgDialogs.
  }

  var onKeyChain = null; //link to next key handler

  function onKey(event) {
    console.log('pgdialogs key handler');
    if (event.controlPressed) {
      console.log("Key:" + event.key);
      switch (event.key) {
        case 's':
          console.log("cntrlS");
          if (event.shiftPressed) { // save as
            saveRecordAs();
          } else {
            saveRecord();
          }
          propagate = false;
          return false;
        case 'o':
          console.log("cntrlO");
          if (confirm("Do you want to load from storage?")) {
            if (event.shiftPressed) { // load from
              nodeComms.setFileSelector(fileSelectorDialog);
              nodeComms.listFiles("loadRecord", "pgl");
            } else {
              loadRecord();
            }
          }
          propagate = false;
          return false;
      }
    }
    if (typeof onKeyChain === 'function')
      return onKeyChain(event); // pass it on
    console.log("Passing key on");
    return true;
  }

  function openDialogPropCommon(id) {
    dialog.openCommon(propDialogReturn, ['Apply', 'Ok', 'Cancel']);
    console.log("Opening property dialog:", id);
    var p = '<table><tr id="idRow"><td>ID</td><td>' + id + '</td></tr>';
    return p;
  }


  var flashChanged = false; // used to determine if flash parameters need saving

  function openImgPropDialog(force_flash) {
    dialog.openCommon(propDialogReturn, ['Apply', 'Ok', 'Cancel']);
    var obj = paperGlue.getCurrentContextObject();
    //console.log("ObjKeys:"+Object.keys(obj));
    paperGlue.showImageCursors(obj, false);
    var p = openDialogPropCommon(obj.id);
    if (obj.type === 'symbol') {
      //p += '<tr><td>Name</td><td>';
      var nm = obj.src.id + "#" + obj.id;
      if (obj.inst.hasOwnProperty('name')) {
        nm = obj.inst.name;
      }
      //p += '<input id="name" type="text" value="'+nm+'"/></td></tr>';
      p += dialog.propertyRow(obj.inst.name, nm, 'Name', 'name');
    } // otherwise symbol
    p += dialog.propertyRow(obj.raster.position.x, 0, 'X', 'xpos');
    p += dialog.propertyRow(obj.raster.position.y, 0, 'Y', 'ypos');
    //console.log("Obj key:" + Object.keys(obj.raster));
    p += dialog.propertyRow(obj.raster.rotation, {
      defaultValue: 0,
      type: 'number',
      max: 360,
      min: 0
    }, 'Rot', 'rot');
    if (obj.type !== 'symbol') {
      p += dialog.propertyRow(obj.src.scale, {
        defaultValue: 1.0,
        step: 0.1
      }, 'Scale', 'scale');
    }
    p += '<tr><td>Flash Image</td><td>';
    var flashFlag = "";
    var click_cmd = "moduleCmd('pgdialogs','openImgPropDialog',true)";
    var flashing = false;
    flashChanged = (typeof force_flash);
    if ((typeof force_flash !== 'undefined' && force_flash) || (obj.inst.hasOwnProperty(
        'flashUp') && obj.inst.flashUp)) {
      flashFlag = 'checked="true"';
      click_cmd = "moduleCmd('pgdialogs','openImgPropDialog',false)";
      flashing = true;
    }
    p += '<input id="flashflag" type="checkbox"' + flashFlag + ' onclick="' +
      click_cmd + '"/></td></tr>';
    var op_para = {
      step: 0.1,
      max: 1.0,
      min: 0.0
    };
    if (flashing) {
      op_para.defaultValue = 0.1;
      p += dialog.propertyRow(obj.inst.flashUpRate, op_para, 'UpRate',
        'flashUpRate');
      p += dialog.propertyRow(obj.inst.flashDownRate, op_para, 'DownRate',
        'flashDownRate');
      op_para.defaultValue = 1.0;
      p += dialog.propertyRow(obj.inst.flashHigh, op_para, 'MaxOpacity',
        'flashHigh');
      op_para.defaultValue = 0.0;
      p += dialog.propertyRow(obj.inst.flashLow, op_para, 'MinOpacity',
        'flashLow');
    } else {
      op_para.defaultValue = 1.0;
      p += dialog.propertyRow(obj.inst.opacity, op_para, 'Opacity',
        'opacity');
    }
    //}
    // var ks = Object.keys(obj);
    // for(var ki in ks ) {
    //   var k = ks[ki];
    //   p += '<tr><td>'+k+'</td><td>'+obj[k]+'</td></tr>';
    // }
    p += '</table>';
    var content = document.getElementById('DlgContent');
    content.innerHTML = p;
    dialog.setMove("idRow");
    return false; //do not hide cursors yet
  }

  //
  // switch (dialogType) {
  //   case 'obj_prop':
  //     propDialogReturn(reply);
  //     break;
  //   case 'img_default':
  //     (reply);
  //     break;
  //   case 'set_state':
  //     setStateDialogReturn(reply);
  //     break;
  //   case 'select_state':
  //     (reply);
  //     break;
  //   case 'file_select':
  //     (reply);
  //     break;
  //   default:
  //     console.log("Unknown dialog type:" + dialogType);
  //     break;
  // }
  // }

  function propDialogReturn(reply) {
    if (reply === 'Cancel') {
      paperGlue.hideCursor();
      dialog.closeDialog();
      return;
    }
    var obj = paperGlue.getCurrentContextObject();
    //console.log("Object type:" + obj.type);
    if (obj.type === 'area') {
      areaDialogReturn(reply);
      return;
    }
    var rtnval = dialog.getPropValues();
    console.log("RtnVals for:" + Object.keys(rtnval));
    if (rtnval.hasOwnProperty('scale')) {
      console.log(obj.src.scale, rtnval.scale);
      if (obj.src.scale != rtnval.scale)
        paperGlue.scaleCurrentImage(rtnval.scale);
    }
    if (rtnval.hasOwnProperty('name')) {
      var name = rtnval.name;
      console.log("New name:" + name);
      paperGlue.nameCurrentImage(name);
    }
    //console.log("rtnval"+rtnval.flashup);
    paperGlue.moveCurrentImage(rtnval.xpos, rtnval.ypos, rtnval.rot);
    var ffield = document.getElementById('flashflag');
    if (ffield.checked) {
      if (flashChanged ||
        obj.inst.flashUpRate !== rtnval.flashUpRate ||
        obj.inst.flashDownRate !== rtnval.flashDownRate ||
        obj.inst.flashHigh !== rtnval.flashHigh ||
        obj.inst.flashLow !== rtnval.flashLow) {
        obj.inst.flashUpRate = rtnval.flashUpRate;
        obj.inst.flashDownRate = rtnval.flashDownRate;
        obj.inst.flashHigh = rtnval.flashHigh;
        obj.inst.flashLow = rtnval.flashLow;
        paperGlue.recordFlash(obj.id, rtnval);
      }
    } else {
      console.log("Ops:" + obj.inst.opacity + " " + rtnval.opacity);
      if (paperGlue.recordOpacity(obj.id, rtnval.opacity)) {
        // only returns true if there has been a change
        obj.inst.opacity = rtnval.opacity;
        obj.raster.opacity = rtnval.opacity;
      }
    }
    if (reply === 'Apply') {
      paperGlue.showImageCursors(obj, false);
      return;
    }
    paperGlue.hideCursor();
    dialog.closeDialog();
  }

  function openImgLoadDefaultDialog() {
    console.log("openImgLoadDefaultDialog");
    dialog.openCommon(imgLoadDefaultDialogReturn, ['Okay', 'Cancel']);
    console.log("Opening image load default dialog");
    var fontsize = window.innerWidth / 80;
    var fs = 'style="font-size:' + fontsize + 'px;"';
    var p =
      '<div id="imgLoadOptionsTitle">Default Image Load Options</div>';
    p += '<table ' + fs + '>';
    p += '<tr><td>Scale</td><td>';
    p += '<input id="imgscale" type="text" value="' + paperGlue.importDefaults
      .scale +
      '"/></td></tr>';
    p += '</table>';
    var content = document.getElementById('DlgContent');
    content.innerHTML = p;
    dialog.setMove("imgLoadOptionsTitle");
    return false; //do not hide cursors yet
  }

  function imgLoadDefaultDialogReturn(reply) {
    if (reply !== 'Cancel') {
      var sfield = document.getElementById('imgscale');
      paperGlue.importDefaults.scale = parseFloat(sfield.value);
    }
    dialog.closeDialog();
  }

  // function areaSelect() {
  // 	paperGlue.areaSelect();
  // }
  //
  // function getAreaCount() {
  // 	return paperGlue.getAreaCount();
  // }
  //
  // function setArea() {
  // 	paperGlue.setArea();
  // }

  function openAreaPropDialog() {
    var obj = paperGlue.getCurrentContextObject();
    var p = openDialogPropCommon(obj.id);
    var a = obj.inst;
    //p += '<tr><td>Name</td><td>';
    var nm = "area#" + obj.id;
    if (a.hasOwnProperty('name'))
      nm = a.name;
    //p += '<input id="name" type="text" value="' + nm + '"/></td></tr>';
    p += dialog.propertyRow(nm, "area#" + obj.id, 'Name', 'name');
    p += dialog.propertyRow(a.rect.x, 0, 'X', 'xpos');
    p += dialog.propertyRow(a.rect.y, 0, 'Y', 'ypos');
    p += dialog.propertyRow(a.rect.width, 0, 'Width', 'width');
    p += dialog.propertyRow(a.rect.height, 0, 'Height', 'height');
    p += '</table>';
    var content = document.getElementById('DlgContent');
    content.innerHTML = p;
    dialog.setMove('idRow');
    return false; //do not hide cursors yet
  }

  function areaDialogReturn(reply) {
    if (reply === 'Cancel') {
      dialog.closeDialog();
      return;
    }
    var name = document.getElementById('name').value;
    var xfield = document.getElementById('xpos');
    var yfield = document.getElementById('ypos');
    var wfield = document.getElementById('width');
    var hfield = document.getElementById('height');
    var x = parseFloat(xfield.value);
    var y = parseFloat(yfield.value);
    var w = parseFloat(wfield.value);
    var h = parseFloat(hfield.value);
    //console.log("X:"+x);
    var obj = paperGlue.getCurrentContextObject();
    var nm = "area#" + obj.id;
    if (nm != name) // only change name if different to area#...
      paperGlue.changeAreaName(name); // beware name is volitile
    paperGlue.moveCurrentArea(new Rectangle(x, y, w, h));
    if (reply === 'Apply')
      return;
    dialog.closeDialog();
  }

  function selectLineColor() {
    dialog.colorSelector(setCurrentLineColor, lineGetColor);
  }

  function lineGetColor(obj) {
    var lc = paperGlue.getLineColor(obj.id);
    for (var c in dialog.ega) {
      var nc = dialog.ega[c];
      if (nc === lc)
        return c;
    }
    return lc;
  }

  function setCurrentLineColor(c) {
    globals.paperGlue.setCurrentLineColor(c);
    dialog.closeDialog();
  }

	var nextStateID = 0;

	function setNewState() {
		console.log("Setting new state");
		var state = paperGlue.getCurrentState();
		if (!state) {
			state = {
				id: paperGlue.getNextID(),
				name: "state#" + nextStateID
			};
			console.log("Create new state of name:" + state.name);
			nextStateID++;
		} else {
			if (state.hasOwnProperty("name"))
				console.log("Found state of name:" + state.name);
			if (state.hasOwnProperty("clearFlag"))
				console.log("ClearFlag:" + state.clearFlag);
		}
		setStateDialog(state);
	}

  function setStateDialog(state) {
    dialog.openCommon(setStateDialogReturn, ['Okay', 'Cancel']);
    console.log("Opening set state dialog");
    var fontsize = window.innerWidth / 80;
    var fs = 'style="font-size:' + fontsize + 'px;"';
    var p = '<table ' + fs + '>';
    p += '<tr id="idRow"><td>ID</td><td>' + state.id + '</td></tr>';
    p += '<tr><td>State Name</td><td>';
    p += '<input id="statename" type="text" value="' + state.name +
      '"/></td></tr>';
    if (!state.hasOwnProperty('dt'))
      state.dt = 0;
    // obj is the item which has a numeric or string value
    // def is the default value if obj is undefined
    // nm is the text label for the field
    // le is the id for the field
    //p += '<tr><td>DeltaTime</td><td>';
    //p += '<input id="deltatime" type="number" value="' + state.dt +
    //	'"/></td></tr>';
    p += dialog.propertyRow(state.dt, 0, 'Deltatime', 'deltatime');
    p += '<tr><td>Clear After</td><td>';
    var clearFlag = "";
    if (state.hasOwnProperty('clearFlag') && state.clearFlag)
      clearFlag = 'checked="true"';
    p += '<input id="clearflag" type="checkbox"' + clearFlag +
      '/></td></tr>';
    p += '</table>';
    var content = document.getElementById('DlgContent');
    content.innerHTML = p;
    dialog.setMove("idRow");
    return false;
  }

  function setStateDialogReturn(reply) {
    var nfield = document.getElementById('statename');
    var name = nfield.value;
    var tfield = document.getElementById('deltatime');
    var dt = parseFloat(tfield.value);
    var cfield = document.getElementById('clearflag');
    var clearFlag = cfield.checked;
    if (reply !== 'Cancel') {
      var state = {
        name: name
      };
      if (dt !== 0)
        paperGlue.dt = dt;
      if (clearFlag)
        state.clearFlag = clearFlag;
      paperGlue.setState(state);
    }
    paperGlue.hideCursor();
    if (reply === 'Apply') {
      return;
    }
    dialog.closeDialog();
  }

  var stateSkipMode;

  function forwardToState() {
    stateSkipMode = false;
    selectStateDialog(paperGlue.getNextState());
  }

  function skipToState() {
    stateSkipMode = true;
    selectStateDialog(paperGlue.getNextState());
  }

  function selectStateDialog(def_state) {
    var states = paperGlue.getStates();
    var states_count = Object.keys(states).length;
    console.log("Currently " + states_count + " states");
    dialogType = 'select_state';
    dialog.openCommon(selectStateDialogReturn,['Cancel']);
    console.log("Opening select state dialog");
    // var state = def_state;
    // if(!state) {
    //   console.log("No state given for default target so going to start");
    //   state = paperGlue.getNextState(0);
    // }
    //console.log("Default to state"+state.name);
    var fontsize = window.innerWidth / 80;
    var fs = 'style="font-size:' + fontsize + 'px;"';
    var p = '<h2 id="state_select_heading">State Selector</h2>';
    var cf = "moduleCmd('pgdialogs','stateSelected',this.value)";
    p += '<div><select ' + fs + 'id="state_select" onchange="' + cf +
      '"></select></div>';
    // p += '<table' + fs + '>';
    // if(state.hasOwnProperty("dt"))
    //   p += '<tr><td>DeltaTime</td><td>'+state.dt+'</td></tr>';
    // p += '</table>';
    var content = document.getElementById('DlgContent');
    content.innerHTML = p;
    var ss = document.getElementById("state_select");
    //fs.style.display = "inline";
    ss.length = 0; // may hang for very long lists - see: http://www.somacon.com/p542.php
    if (stateSkipMode) {
      var doption = document.createElement("option");
      doption.text = "START";
      doption.value = 0;
      ss.add(doption);
    }
    for (var i in states) {
      state = states[i].state;
      var option = document.createElement("option");
      option.text = state.name + " @ " + states[i].index;
      // option.onclick = fileSelected; - only works in firefox
      option.value = states[i].index;
      ss.add(option);
    }
    eoption = document.createElement("option");
    eoption.text = "END";
    eoption.value = paperGlue.getDoLength();
    ss.add(eoption);
    // set option to current location
    var ci = paperGlue.getDoIndex();
    for (var si in ss.children) {
      var v = ss.children[si].value;
      if (v === ci) {
        ss.value = v;
        break;
      }
    }
    if (ss.value != ci) {
      eoption = document.createElement("option");
      eoption.text = "select";
      eoption.value = -1; // dummy option
      ss.add(eoption);
      ss.value = -1;
    }
    dialog.setMove("state_select_heading");
    return false;
  }

	function selectStateDialogReturn(reply) {
		paperGlue.hideCursor();
		dialog.closeDialog();
	}

  function stateSelected(value) {
    var index = parseInt(value);
    console.log("Going to index:" + index);
    if (stateSkipMode)
      paperGlue.skipToIndex(index);
    else
      paperGlue.forwardToIndex(index);
    dialog.closeDialog();
  }

  function writeStatus(msg) {
    var se = document.getElementById('statusInfo');
    se.innerHTML = msg;
  }

  // show status line if edit mode
  function setMode(state) {
    var se = document.getElementById('statusInfo');
    if (state === 'edit')
      se.style.display = 'inline';
    else
      se.style.display = 'none';
  }

  var fileSelectObjective;

  function fileSelectorDialog(objective, xtns, dir_obj) {
    console.log("fileSelectorDialog:" + objective);
    fileSelectObjective = objective;
    dialog.fileSelector(objective, xtns, dir_obj, {
      module: "nodeComms",
      funct: "listFiles"
    }, fileSelected);
  }

  function fileSelected(objective, path, subpath) {
    console.log(objective + " from:" + path + " / " + subpath);
    switch (fileSelectObjective) { // saveRecord returns save so use fileSelectObjective instead
      case 'loadRecord':
        loadRecord(path, subpath);
        break;
      case 'saveRecord':
        saveRecord(path, subpath);
        break;
      case 'loadImage':
        loadImage("", "", path, subpath);
        break;
      default:
        console.log("Unknown objective:" + objective);
        break;
    }
  }

  function loadImage(objective, xtns, path, subpath) {
    // load images from directory or locals
    // this function must conform to dialog.fileSelector fileselect function type
    // objective should always be "loadImages"
    // xtns should always be the contents of imageExtensions
    if (window.location.protocol === 'file:') { //local storage
      console.log("No server so need to use prelisting");
      // need to building a image load object for loadImages
      // imagesAvailable was a listing loaded from imgavail.js
      if (typeof globals.imagesAvailable !== 'undefined') {
        var full_list = globals.imagesAvailable;
        console.log(full_list);
        console.log("path:" + path + " subpath:" + subpath);
        if (typeof path === 'undefined')
          path = "";
        if (typeof subpath !== 'undefined') {
          if (subpath === 'parent_directory') {
            var lp = path.lastIndexOf("/");
            if (lp >= 0)
              path = path.substring(0, lp);
            else
              path = "";
          } else {
            if (path.length > 0)
              path += "/";
            path += subpath;
          }
        }
        ilist = [];
        for (var i in full_list) {
          console.log("i:" + i + " = " + full_list[i].src);
          var ip = full_list[i].src;
          // if path has been defined then maybe we have found target
          if (typeof path !== 'undefined' && path.length > 0) {
            console.log("file path:" + path);
            id = "img" + paperGlue.getNumSymbols(); // default id
            if (ip === path) {
              if (full_list[i].hasOwnProperty('id')) // image has defined id name
                id = full_list[i].id;
              else if (typeof subpath !== 'undefined') // should be
                id = subpath; // use image file name as id
              console.log("Load image file:" + path);
              paperGlue.loadSingleImage(path, id, contextMenu.eventPos);
              return;
            }
            if (ip.indexOf(path) === 0) {
              ip = ip.substring(path.length + 1);
              console.log("Entering subpath:" + ip);
            } else
              continue;
          }
          var parts = ip.split("/"); // seperate the fid into directories and file name
          //console.log("parts:" + parts + " length=" + parts.length);
          var f = {
            name: parts[0]
          };
          if (parts.length > 1)
            f.type = "dir"; // first part is a directory name
          else {
            f.type = "file";
            var xp = parts[0].split('.');
            console.log("xp:" + xp);
            if (xp.length < 2 || imageExtensions.indexOf(xp[xp.length - 1]) <
              0)
              continue;
          }
          ilist.push(f);
        }
        console.log("ilist:" + ilist);
        //if (path === "")
        //  path = "";
        fileSelectObjective = "loadImage";
        dialog.fileSelector("loadImage", imageExtensions, {
          type: "dir",
          path: path,
          dir: ilist
        }, {
          module: "pgdialogs",
          funct: "loadImage"
        }, fileSelected); // returns to self
        //*************** wrong args for loadImage as fileSelector!
        //   {parent_rtn: "moduleCmd('paperGlue','listFiles','loadImage','" +
        //   xtns + "','" +
        //     dir_obj.path + "','parent_directory');",
        //     list:"moduleCmd('paperGlue','listFiles','loadImage','" +
        //     xtns + "','" +
        //       dir_obj.path + "','parent_directory');"},
        //     null
        // );
      } else
        console.log("No images available object loaded");
    } else if (typeof path === 'undefined') {
      nodeComms.setFileSelector(fileSelectorDialog);
      nodeComms.listFiles("loadImage", imageExtensions); // defaults to listfile from here
    } else { // assume we have a path to an image provided by listFile via myscript fileSelectDialog
      var full_path = path + "/" + subpath;
      paperGlue.loadSingleImage(full_path, subpath, {pos:contextMenu.eventPos});
    }
  }

  function saveDoRec() {
    if (window.location.protocol == 'file:') {
      alert("Can only save dorec.js with server active.");
    }
    if (typeof nodeComms.sendData !== 'function')
      return;
    var jtxt = buildRedoTxt(true, true);
    var save_data = {
      command: 'save',
      path: "dorec.js",
      data: jtxt
    };
    nodeComms.sendData(JSON.stringify(save_data));
  }

  function saveRecordAs() {
    nodeComms.setFileSelector(fileSelectorDialog);
    nodeComms.listFiles("saveRecord", "pgl");
  }

  function saveRecord(path, subpath) {
    console.log("Try to save");
    console.log("Globals:" + Object.keys(globals));
    if (typeof nodeComms !== 'undefined')
      console.log("SendData:", typeof nodeComms.sendData);
    var jdata = paperGlue.buildRedoData();
    nodeComms.saveFile(jdata, path, subpath);
  }

  function loadRecordAs() {
    nodeComms.setFileSelector(fileSelectorDialog);
    console.log("Load as");
    nodeComms.listFiles("loadRecord", "pgl");
  }

  function loadRecord(path, subpath) {
    nodeComms.setFileParser(paperGlue.parseRecord);
    nodeComms.loadFile(path, subpath);
  }

  var imgAvailLoader = "';\nglobals.imagesAvailable = idata;\n";

  var walkerTree = [];
  var imgFileList;

  function buildImgAvail(res) {
    var path, subpath;
    if (typeof res === 'undefined') {
      if (window.location.protocol === 'file:') {
        alert("ABORT - Can only generate file list from server");
        return;
      }
      if (typeof nodeComms.sendData !== 'function') // very odd if this happens
        return;
      // node js storage
      nodeComms.onReply = buildImgAvail; // recursive call
      path = "";
      imgFileList = [];
    } else {
      console.log("Onreply:" + res);
      if (res.indexOf('500') === 0) { //starts with error code
        console.log("Report error:" + res);
      } else {
        console.log("attempting to parse json object");
        //try {
        var reply_obj = JSON.parse(res);
        console.log(reply_obj);
        if (reply_obj.type !== 'dir') {
          console.log("Failed to return dir from image list");
          return;
        }
        // always arrives here with a new directory listing
        path = reply_obj.path;
        dir = reply_obj.dir;
        // first record all the files in this directory
        for (var i in dir) {
          if (dir[i].type === 'file') {
            var fo = {
              src: (path + '/' + dir[i].name)
            };
            for (var j in importDefaults) {
              if (importDefaults[j] != baseImportDefaults[j])
                fo[j] = importDefaults[j];
            }
            imgFileList.push(fo); // will use baseImportDefaults unless specified
          }
        }
        // now look for subdirectories
        index = 0;
        walkerTree.push({
          path: path,
          dir: dir,
          index: 0
        });
        while (index >= 0) {
          subpath = null;
          for (i = index; i < dir.length; i++) {
            var fd = dir[i];
            if (fd.type === 'dir') {
              subpath = fd.name;
              walkerTree[walkerTree.length - 1].index = i + 1;
              break;
            }
          }
          if (!!subpath)
            break;
          if (walkerTree.length === 0) {
            console.log("walker mission complete - " + imgFileList.length +
              " image found");
            // buildingimgAvail.js
            jdata = "var idata=\n'";
            var json_txt = JSON.stringify(imgFileList);
            for (var c in json_txt) {
              jdata += json_txt[c];
              if (json_txt[c] === '}')
                jdata += '\n';
            }
            jdata += imgAvailLoader;
            var save_data = {
              command: 'save',
              path: "imgavail.js",
              data: jdata
            };
            if (typeof path !== 'undefined')
              postObject.path = path;
            if (typeof subpath !== 'undefined')
              postObject.subpath = subpath;
            nodeComms.sendData(JSON.stringify(save_data));
            return;
          }
          var wp = walkerTree.pop();
          path = wp.path;
          dir = wp.dir;
          index = wp.index;
        }
      }
      // catch(excpetion e) {}
    }
    console.log("Attempting to list from:" + path + " / " + subpath);
    postObject = {
      command: 'list',
      xtns: imageExtensions,
      path: path,
      subpath: subpath
    };
    //if(typeof subpath !== 'undefined')
    nodeComms.sendData(JSON.stringify(postObject));
  }

  globals.setMode = setMode;
  globals.writeStatus = writeStatus;

  var exports = {
    writeStatus: writeStatus,
    setMode: setMode,
    //setCurrentLineColor: setCurrentLineColor,
    // setNameField: setNameField,
		setNewState:setNewState,
		stateSelected: stateSelected,
		forwardToState: forwardToState,
		skipToState: skipToState,
    openImgPropDialog: openImgPropDialog,
    lineGetColor: lineGetColor,
    selectLineColor: selectLineColor,
    openAreaPropDialog: openAreaPropDialog,
    saveRecord: saveRecord,
    loadRecord: loadRecord,
    loadImage: loadImage,
    openImgLoadDefaultDialog: openImgLoadDefaultDialog
  };
  globals.pgdialogs = exports;
  globals.moduleLoaded('pgdialogs', ['paperGlue', 'dialog', 'nodeComms',
      'contextMenu'
    ],
    init);

}());
