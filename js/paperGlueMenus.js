(function() { // using the module pattern to provide name space

  /* paperGlueMenu module required by paperGlue object context menus
	   Only required if in edit mode and using right click context menus.
		 Could probably be merged with pgdialogs.
		 But paperGlueMenus deals with context menus applying to different objects
		 where as xtra menus in pgdialogs are only general menus and
		 could be moved to a docked menu tray as some stage.
	*/
  var globals = window.globals;
  var dependancies = ['paperGlue', 'pgdialogs'];

  function initMenus() {
    var symbolOptionsMenu = [
      {
        label: 'snap',
        propCall: getSnapModeCall,
        callback: paperGlue.toggleSnap  //toggleSnap
      }, {
        label: 'dragClones',
        propCall: paperGlue.getDragMode,  //getDragModeCall,
        callback: paperGlue.toggleDrag    //toggleDrag
      }
    ];
    var symbolConnectionsMenu = [
      {
        label: 'setCenter',
        propCall: imgGetCenterCall,
        callback: paperGlue.setCenterToCursor  //setCenterToCursor
      }, {
        label: 'setOrigin',
        propCall: imgGetOriginCall,
        callback: paperGlue.setOriginToCursor  //setOriginToCursor
      },{
        label: 'selectConnection',
        propCall: getConnectionNrCall,
        callback: incConnectionNrCall
      },{
        label: 'setConnection',
        propCall: getConnectionCall,
        callback: paperGlue.setConnectionToCursor  //setConnectionToCursor
      },{
        label: 'addConnection',
        callback: addConnectionCall
      }
    ];

    var symbolMenu = [{
      label: 'name',
      propCall: imgGetNameCall
    }, {
      label: 'pos',
      propCall: imgGetPosCall
    }, {
      label: 'size',
      propCall: imgGetSizeCall
    }, {
      label: 'options',
      submenu: symbolOptionsMenu
    }, {
      label: 'properties',
      callback: pgdialogs.openImgPropDialog
    }, {
      label: 'connections',
      submenu: symbolConnectionsMenu
    },{
      label: 'remove',
      callback: paperGlue.delCurrentContextObject  //objRemove
    }];

    var symbolInstanceMenu = [{
      label: 'name',
      propCall: imgGetInstanceNameCall
    }, {
      label: 'pos',
      propCall: imgGetPosCall
    }, {
      label: 'snap',
      propCall: getSnapModeCall,
      callback: paperGlue.toggleSnap   //toggleSnap
    }, {
      label: 'properties',
      callback: pgdialogs.openImgPropDialog
    }];
    var lineInstanceMenu = [{
      label: 'color',
      propCall: pgdialogs.lineGetColor,
      callback: pgdialogs.selectLineColor //setCurrentLineColor
    }];
    var newAreaMenu = [{
      label: 'set area#',
      propCall: paperGlue.getAreaCount,
      callback: paperGlue.setArea
    }, {
      label: 'select',
      callback: paperGlue.areaSelect
    }];
    var areaMenu = [{
      label: 'name',
      propCall: paperGlue.getAreaNameCall
    }, {
      label: 'rect',
      propCall: paperGlue.getAreaRectCall
    }, {
      label: 'properties',
      callback: pgdialogs.openAreaPropDialog
    }];

    // paperGlue will be looking for the following menus from the contextMenu.set(type) function
    window.globals.menuLookup = {
      symbolMenu: symbolMenu,
      symbolInstanceMenu: symbolInstanceMenu,
      lineInstanceMenu: lineInstanceMenu,
      newAreaMenu: newAreaMenu,
      areaMenu: areaMenu
    };
    var exportMenu = [{
      label: 'list in new tab',
      callback: openActionsWindow
    }, {
      label: 'json in new tab',
      callback: openJSONWindow
    }, {
      label: '  js in new tab',
      callback: openJSWindow
    }, ];
    var stateMenu = [{
      label: 'set state',
      callback: pgdialogs.setNewState
    }, {
      label: 'forward to state',
      callback: pgdialogs.forwardToState
    }, {
      label: 'skip to state',
      callback: pgdialogs.skipToState
    }, ];

    var optionsMenu = [{
      label: 'import defaults',
      callback: pgdialogs.openImgLoadDefaultDialog
    }];

    // menus to append keys must match the label for the desired submenu
    // special case is defaultContextMenu
    // tree by using underline eg. menu_submenu
    menusToAppend = {
      export: exportMenu,
      options: optionsMenu,
      state: stateMenu
    };
  }

  default_image_menus = {
    contextMenu: "symbolMenu",
    instanceContextMenu: "symbolInstanceMenu"
  };

  function init() {
    console.log("Initialising paperGlue menus");
    paperGlue = globals.paperGlue;
    pgdialogs = globals.pgdialogs;
    initMenus();
    contextMenu.append(menusToAppend);
  }

  function imgGetNameCall(obj) {
    //console.log('get name called');
    return obj.src.id;
  }

  function imgGetSizeCall(obj) {
    //console.log('get size called');
    //console.log("Obj raster keys:"+Object.keys(obj.raster));
    //console.log(obj.raster.bounds);
    var rs = "W:" + Math.round(obj.raster.bounds.width) + " H:" + Math.round(
      obj.raster
      .bounds.height);
    if (obj.hasOwnProperty('src')) {
      if (obj.src.hasOwnProperty('scale') && obj.scale !== 1.0)
        rs += " @ Scale:" + obj.src.scale;
    }
    return rs;
  }

  function imgGetInstanceNameCall(obj) {
    var nm = "" + obj.src.id + "#" + obj.id;
    if (obj.inst.hasOwnProperty('name'))
      nm += ':' + obj.inst.name;
    return nm;
  }

  function roundPoint(p) {
    return "X:" + Math.round(p.x) +
      " Y:" + Math.round(p.y);
  }

  function imgGetPosCall(obj) {
    console.log('pos called');
    //console.log(Object.keys(obj));
    return roundPoint(obj.raster.position);
  }

  function objRemove(obj) {
    console.log("remove called");
    paperGlue.delCurrentContextObject();
  }

  function getSnapModeCall(obj) {
    console.log("GetSnapMode for:" + obj);
    var inst = obj.inst;
    if (inst.hasOwnProperty('snap'))
      return inst.snap;
    return paperGlue.getSnapDefault();
  }

  // function toggleSnap() {
  //   paperGlue.toggleSnap();
  //   return true;
  // }

  // function getDragModeCall(obj) {
  //   console.log("GetDragMode for:" + obj);
	// 	return paperGlue.getDragMode(obj);
  // }

  // function toggleDrag() {
  //   paperGlue.toggleDrag();
  //   return true;
  // }

  function  getConnectionNrCall(obj) {
    if(!obj.src.hasOwnProperty('connections'))
      return 'No connections';
    if(!obj.src.hasOwnProperty('connectNr'))
      obj.src.connectNr = 0;
    if(obj.src.connectNr >= obj.src.connections.length)
      obj.src.connectNr = 0;
    return obj.src.connectNr + " of " + obj.src.connections.length;
  }

  function  incConnectionNrCall() {
    var obj = paperGlue.getCurrentContextObject();
    if(!obj.src.hasOwnProperty('connections'))
      return;
      obj.src.connectNr++;
    if(obj.src.connectNr >= obj.src.connections.length)
      obj.src.connectNr = 0;
  }

  function getConnectionCall(obj) {
    //console.log('pos called');
    //console.log(Object.keys(obj));
    //console.log(obj.src);
    if (!obj.src.hasOwnProperty('connections'))
      return 'No connections';
    if(!obj.src.hasOwnProperty('connectNr'))
      obj.src.connectNr = 0;
    if(obj.src.connections.length > 0)
      return roundPoint(obj.src.connections[obj.src.connectNr].pos);
    else
      return 'N/A';
  }

  function addConnectionCall() {
    var obj = paperGlue.getCurrentContextObject();
    if(!obj.src.hasOwnProperty('connections')) {
      obj.src.connections = [];
      obj.src.connectNr = 0;
    } else {
      obj.src.connectNr++;
    }
    paperGlue.setConnectionToCursor();
  }

  function imgGetCenterCall(obj) {
    //console.log('pos called');
    //console.log(Object.keys(obj));
    //console.log(obj.src);
    if (!obj.src.hasOwnProperty('center'))
      return {
        X: 0,
        Y: 0
      };
    return roundPoint(obj.src.center);
  }

  function imgGetOriginCall(obj) {
    //console.log('pos called');
    //console.log(Object.keys(obj));
    if (!obj.src.hasOwnProperty('origin'))
      return {
        X: 0,
        Y: 0
      };
    return roundPoint(obj.src.origin);
  }

  function createActionTableBody() {
    var q = paperGlue.getDoRecord();
    var dri = paperGlue.getDoIndex();
    var ihtml = "";
    for (var qi in q) {
      var dr = q[qi];
      var propstr = "";
      var oks = Object.keys(dr);
      for (var ki in oks) {
        var k = oks[ki];
        if (k == 'action' || k == 'id')
          continue;
        propstr += k + ":" + dr[k] + ";";
      }
      var bl;
      if ((qi % 2) === 0)
        bl = 'FF';
      else
        bl = 'C0';
      var vl;
      if (qi < dri)
        vl = 'FF';
      else
        vl = 'C0';
      var rhtml = '<tr style="background-color:#F0' + vl + bl +
        '"><td class="dtd" style="width:100px;border-left:0">' + dr.action +
        '</td><td class="dtd" style="width:30px;background-color:#E0' + vl +
        bl +
        '">' + dr.id + '</td><td class="dtd" style="border-right:0">' +
        propstr +
        '</td></tr>';
      //console.log(rhtml);
      ihtml += rhtml;
    }
    return ihtml;
  }

  function openActionsWindow() {
    var myWindow = window.open("", "Actions"); //, "width=200, height=100");
    var ad = document.getElementById("actionTableDiv");
    myWindow.document.write(ad.innerHTML);
    var ab = myWindow.document.getElementById("actionTableBody");
    //console.log("Actions:"+ab.length);
    ab.innerHTML = createActionTableBody();
    var tb = myWindow.document.getElementById("actionTableBodyDiv");
    //console.log(tb.attributes);
    var ss = "overflow:scroll;height:" + window.innerHeight +
      "px;width:100%;overflow:auto;maxHeight:80%;";
    //console.log("Style:"+ss);
    tb.style = ss;
    tb.style.maxHeight = "400px";
    //console.log(tb.attributes);
    //console.log(tb.style);
    myWindow.stop();
  }

  function openJSONWindow() {
    openRecordWindow(true, false);
  }

  function openJSWindow() {
    openRecordWindow(false, true);
  }

  var recordWindow = null;

  /* generate a browser page which can be saved as a js file for
	   inclusion in a paperglue project.
	*/
  function openRecordWindow(beautify, include_loader) {
      if (recordWindow)
        recordWindow.close();
      recordWindow = window.open("", "doRecord"); //, "width=200, height=100");
      //var q = globals.paperGlue.getDoRecord();
      //var dri = globals.paperGlue.getDoIndex();
      var txt = "";
      txt = "";
      if (!include_loader)
        txt += "<html><body><pre>";
      txt += paperGlue.buildRedoTxt(beautify, include_loader);
      if (!include_loader) {
        txt += "</pre></body></html>";
      }
      recordWindow.document.write(txt);
      recordWindow.stop();
    }
    //
    // function loadDoRec() {
    //   paperGlue.loadDoRec();
    // }

  var dialogDiv;
  var idRow;
  var dialogType = "unknown";

  // function setConnectionToCursor() {
  //   paperGlue.setConnectionToCursor();
  // }

  // function setCenterToCursor() {
  //   paperGlue.setCenterToCursor();
  // }

  // function setOriginToCursor() {
  //   paperGlue.setOriginToCursor();
  // }

  var exports = {
    listActions: openActionsWindow,
    default_image_menus: default_image_menus, //read only
  };
  globals.pgMenus = exports;

  if (typeof globals.moduleLoaded === 'function')
    globals.moduleLoaded('pgMenus', dependancies, init);

}());
