(function() { // using the module pattern to provide name space
  //note:objects in paperglue maybe/are in the paper scope
  var globals = window.globals;
  var paperGlue = globals.paperGlue; // see initApp below
  var dialog = globals.dialog;
  var pgdialogs = globals.pgdialogs;
  var dependancies = ['paperGlue', 'pgdialogs'];

  var wireLinks = [];

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
    label: 'snap',
    propCall: getSnapModeCall,
    callback: toggleSnap
  }, {
    label: 'dragClones',
    propCall: getDragModeCall,
    callback: toggleDrag
  }, {
    label: 'properties',
    callback: pgdialogs.openImgPropDialog
  }, {
    label: 'setCenter',
    propCall: imgGetCenterCall,
    callback: setCenterToCursor
  }, {
    label: 'setOrigin',
    propCall: imgGetOriginCall,
    callback: setOriginToCursor
  }, {
    label: 'remove',
    callback: objRemove
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
    callback: toggleSnap
  }, {
    label: 'properties',
    callback: pgdialogs.openImgPropDialog
  }];
  var lineInstanceMenu = [{
    label: 'color',
    propCall: pgdialogs.lineGetColor,
    callback: pgdialogs.setCurrentLineColor
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

  // paperGlue will be looking for the following menus
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
    callback: paperGlue.setNewState
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

  var defaultMenuAddendum = [];



  var first_image = {
    src: "img/con_Block_5.08mm_12.png",
    scale: 0.6,
    id: "conBlock1",
    isSymbol: true,
    dragClone: true,
    pos: null //view.center
  };
  var default_image_menus = {
    contextMenu: "symbolMenu",
    instanceContextMenu: "symbolInstanceMenu"
  };
  // other parameters:
  //   origin = point in image which represents position
  //   center = point in image for rotation  e.g , center:[30,0]

  console.log("Starting myScript");
  // this section has been replaced my need method of dependancy checks
  //console.log(Object.keys(window));
  //console.log(Object.keys(window.globals));
  // if (typeof window.globals.paperGlue === 'undefined') { // means myScript got here first and paperGlue was not ready
  //   console.log("paperGlue not ready yet to init app.");
  //   window.globals.onPaperGlueLoad = initApp; // paperGlue will call this when it is ready
  // } else {
  //   console.log("PaperGlue already loaded so can init app.");
  //   initApp(); // paperglue is already ready so can loadImages now
  // }
  // old method that was a bit messy and may be avoided if I used requirejs or browserify - though I suspect that paper.js will not like it.
  // see http://eloquentjavascript.net/10_modules.html on the subject of slow module loads

  function initApp() {
    console.log("Initialising application");
    //paper.install(window);
    //paper.setup('myCanvas');

    paperGlue = window.globals.paperGlue; //to access paperGlue commands
    paperGlue.init(); // sets up extra layers
    drawStripBoard(10, 100, 34);
    paperGlue.loadImages([], default_image_menus); //first_image
    paperGlue.setSnap([5, 5, 10, 10]);
    paperGlue.appendMenus(menusToAppend);
    paperGlue.showAreas();
    //paperGlue.closeDialog = dialog.closeDialog;
    //paperGlue.fileSelector = dialog.fileSelectorDialog;
    loadDoRec();
    paperGlue.setEditMode(false); // begin in run mode
    console.log("Press ESC to exit run mode");
  }

  function drawGrid(spacing) {
    var l;
    var myCanvas = document.getElementById("myCanvas");
    for (var y = 0; y < myCanvas.height; y += spacing) {
      l = new paper.Path();
      l.strokeColor = '#e0e0e0';
      l.add([0, y], [myCanvas.width, y]);
    }
    for (var x = 0; x < myCanvas.width; x += spacing) {
      l = new paper.Path();
      l.strokeColor = '#e0e0e0';
      l.add([x, 0], [x, myCanvas.height]);
    }
  }

  function drawStripBoard(spacing, length, width) {
    var l;
    var vh = width * spacing;
    var vw = (length + 1) * spacing;
    var path = new paper.Path.Circle([0, 0], spacing * 0.2);
    path.fillColor = 'white';
    var hole = new paper.Symbol(path);
    for (var y = spacing / 2; y < vh; y += spacing) {
      l = new paper.Path();
      l.strokeColor = '#e0e0e0';
      l.strokeWidth = spacing * 0.8;
      l.add([0, y], [vw, y]);
      for (var x = spacing / 2; x < vw; x += spacing) {
        hole.place([x, y]);
      }
    }
    paperGlue.rasterize();
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

  function toggleSnap() {
    paperGlue.toggleSnap();
    return true;
  }

  function getDragModeCall(obj) {
    console.log("GetSnapMode for:" + obj);
    if (obj.src.hasOwnProperty('dragClone'))
      return obj.src.dragClone;
    return paperGlue.getDragDefault();
  }

  function toggleDrag() {
    paperGlue.toggleDrag();
    return true;
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

  function keyDown(event) { // note: This is accessed from paperglue.js - not directly
    // added controlPressed,shiftPressed,altPressed as values in event
    // if(event.key == 'control' || event.key == 'shift' || event.key == 'alt')
    //   return;
    console.log(event);
    console.log("myScript received:", event.key);
    if (event.controlPressed) {
      if (event.key == 'q') {
        console.log("cntrlQ");
        event.stopPropagation();
        var ab = document.getElementById("actionTableBody");
        console.log("Actions:" + ab.length);
        ab.innerHTML = createActionTableBody();
        var ca = document.getElementById("clientArea");
        var canvasDiv = document.getElementById("canvasDiv");
        var canvas = document.getElementById('myCanvas');
        canvasDiv.style.height = ca.clientHeight / 2 + 'px';
        var ad = document.getElementById("actionTableDiv");
        ad.style.height = ca.clientHeight / 2 + 'px';
        ad.style.display = "inline";

        return false;
      }
    }
    return true;
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

  function loadDoRec() {
    paperGlue.loadDoRec();
  }

  var dialogDiv;
  var idRow;
  var dialogType = "unknown";

  function setCenterToCursor() {
    paperGlue.setCenterToCursor();
  }

  function setOriginToCursor() {
      paperGlue.setOriginToCursor();
    }
    //window.globals.keyhandler = keyDown;  // requests paperglue to pass event here
  var exports = {
    listActions: openActionsWindow,
  };
  globals.myScript = exports;

  //console.log("Globals:");
  //console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
  if (typeof globals.moduleLoaded === 'function')
    globals.moduleLoaded('myScript', dependancies, initApp);
}());
