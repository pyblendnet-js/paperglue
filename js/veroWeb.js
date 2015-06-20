(function() { // using the module pattern to provide name space
  var globals = window.globals;
  var paperGlue = globals.paperGlue; // see initApp below
  var pgMenus = globals.pgMenus;
  var dependancies = ['paperGlue','pgMenus','nodeComms','xml2obj'];

  var wireLinks = [];

  var gridStep = 16;  // pixels per grid center
  var gridOffset = gridStep/2;
  var rows = 34;
  var columns = 100;

  // other parameters:
  //   origin = point in image which represents position
  //   center = point in image for rotation  e.g , center:[30,0]

  console.log("Starting VeroWeb");
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

    //paperGlue = window.globals.paperGlue; //to access paperGlue commands
    paperGlue.init(); // sets up extra layers
    drawStripBoard(gridStep, columns, rows);
    //paperGlue.loadImages([first_image], pgMenus.default_image_menus,postImageLoadInit);
    // init is completed after images have been loaded
    paperGlue.setCustomProps(pgMenus.default_image_menus);
    postImageLoadInit();  // since there are no images to load
  }

  var partsMenu = [{
    label: 'get part',
    callback: getPart
  }, ];

  function postImageLoadInit() {
    paperGlue.setSnap([gridOffset, gridOffset, gridStep, gridStep]);  // x,y pre-offset and x,y grid
    paperGlue.showAreas();
    menusToAppend = {
      file:partsMenu
    };
    contextMenu.append(menusToAppend);
    //paperGlue.closeDialog = dialog.closeDialog;
    //paperGlue.fileSelector = dialog.fileSelectorDialog;
    //paperGlue.loadDoRec(postDoRec);  //wait for image loads
  }

  function postDoRec() {
    //paperGlue.setEditMode(false); // begin in run mode
    //console.log("Press ESC to exit run mode");
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

  function getPart() {
    console.log("getPart");
    if (window.location.protocol === 'file:') { //local storage
      alert("veroWeb does not support local storage - use node.js server via veroLaunch.bat.");
    } else {
      nodeComms.setFileSelector(partSelectorDialog);
      nodeComms.listFiles("loadFile", "xml", "parts");
    }
  }

  function partSelectorDialog(objective, xtns, dir_obj) {
    console.log("partSelectorDialog:" + objective);
    fileSelectObjective = objective;
    dialog.fileSelector(objective, xtns, dir_obj, {
      module: "nodeComms",
      funct: "listFiles"
    }, partSelected);
  }

  var part_path;

  function partSelected(objective, path, subpath) {
    console.log("PartSelected:"+objective + " from:" + path + "/" + subpath);
    part_path = path;
    nodeComms.loadFile(path,subpath,partParse);
  }

  var partList = {};

  function partParse(data) {
    var obj = loadXML(data);
    var part = obj.part;
    console.log(JSON.stringify(part));
    partList[part.name] = {para:part};
    paperGlue.loadSingleImage("project/"+part_path + "/images/"+part.imageName,part.name,
    {pos:contextMenu.getEventPos(),onLoad:partImageLoaded});
  }

  function partImageLoaded(id,imgobj) {
    partList[id].imgobj = imgobj;
    if(partList[id].para.hasOwnProperty("connections")) {
      imgobj.connections = [];
      var pins = partList[id].para.connections.list;
      for(var i in pins) {
        var p = pins[i].pin;
        console.log("adding pin:"+p.num+"="+p.x+","+p.y);
        //console.log(typeof p.x);
        var pos = new Point(parseInt(p.x),parseInt(p.y));
        if (!imgobj.hasOwnProperty('origin')) {
          var tp = new Point(imgobj.size.width/2,imgobj.size.height/2);
          imgobj.origin = tp.subtract(pos);  // first pin used to set origin
        }
        console.log(pos);
        var pin = {pos:pos, id:p.num};
        imgobj.connections.push(pin);
        console.log("Type:"+typeof imgobj.connections[i]);
        //console.log(imgobj.connections[i].pos);
      }
    } else
      alert(partList[id] + " has no connections yet");
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

  function pntToGrid(pnt) {
    //console.log(gridOffset,gridStep);
    return [Math.round((pnt.x-gridOffset)/gridStep),Math.round((pnt.y-gridOffset)/gridStep)];
  }

  function gridToPnt(row,col) {
    //console.log("ColRow:"+col+","+row);
    return new Point(col*gridStep+gridOffset,row*gridStep+gridOffset);
  }

  function editPoint(pos) {
    //console.log("Highlight:"+event.point);
    var rc = pntToGrid(pos);
    //console.log("Highlight:"+rc);
    clearHighLines();
    tracePath(rc[1],rc[0]-1,rc[0],highlight);  // include initial point
    // highlight this section of track
    // look for links meeting this track
    // jump to linked tracks and repeat
  }

  var highLines = [];

  function clearHighLines() {
    for(var i in highLines) {
      var l = highLines[i];
        l.remove();
    }
    highlines = [];
  }

  function highlight(r1,c1,r2,c2) {
    var lineSelected = new Path();
    lineSelected.strokeColor = 'red';
    lineSelected.opacity = 0.5;
    lineSelected.strokeWidth = 8;
    lineSelected.strokeCap = 'round';
    //console.log("Line from "+gridToPnt(c1,r1)+" to "+gridToPnt(c2,r2));
    lineSelected.add(gridToPnt(r1,c1));
    lineSelected.add(gridToPnt(r2,c2));
    highLines.push(lineSelected);
  }

  function tracePath(row,col_l,col_r,action) {
    // look for break(s) on this track
    var left_lim = traceDir(row,col_l,-1,-1,action);
    var right_lim = traceDir(row,col_r,1,columns,action);
    action(row,left_lim,row,right_lim);
  }

  function traceDir(row,col,dir,lim,action) {
    //console.log("Trace from "+row+","+col+" in dir:"+dir+" to "+lim);
    for(var c = col; c != lim; c += dir) {
      var j = findJoint(row,c);
      switch(j) {
        case 'break':
          return c-dir;
        case 'resistor':
          // might follow this resistor in future versions or create node map
          break;
      }
      var pnt = findLine(row,c);
      if(!!pnt) {
        var lrc = pntToGrid(pnt);
        //console.log("Found line from "+c+","+row+" to "+lrc);
        action(row,c,lrc[1],lrc[0]);  //do the line
        tracePath(lrc[1],lrc[0]-1,lrc[0]+1,action);  //this time do not include initial point
      }
    }
    return lim;
  }

  function findJoint(row,col) {
    var symbols = paperGlue.getSymbols();
    for(var id in symbols) {
      var symbol = symbols[id];
      var imgobj = symbol.src;
      console.log("Check symbol:"+imgobj.id);
      if(imgobj.id === 'Break') { // special instance - has no connection
        var rcx = pntToGrid(symbol.raster.position);
        if(rcx[1] == row && rcx[0] == col)
          return 'break';
        continue;
      }
      if(imgobj.hasOwnProperty('connections')) {
        for(var i = 0; i < imgobj.connections.length; i++) {
          var pos = paperGlue.getImgConnectionPos(imgobj.src,symbol.raster,i);
          var rc = pntToGrid(pos);
          if(rc[1] == row && rc[0] == col)
            return imgobj.id;
        }
      } else {
        return null;
      }
    }
  }

  function findLine(row,col) {
    var lines = paperGlue.getLines();
    //console.log("Check:"+col+","+row);
    for(var id in lines) {
      //console.log("Check:"+id);
      var l = lines[id];
      var p1 = l.path.firstSegment.point;
      var p2 = l.path.lastSegment.point;
      var rc = pntToGrid(p1);
      //console.log("End1:"+rc);
      if(rc[0] == col && rc[1] == row)
        return p2;
      rc = pntToGrid(p2);
      //console.log("End2:"+rc);
      if(rc[0] == col && rc[1] == row)
        return p1;
    }
    return null;
  }

  globals.editPoint = editPoint;

  //window.globals.keyhandler = keyDown;  // requests paperglue to pass event here

  //console.log("Globals:");
  //console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
  if (typeof globals.moduleLoaded === 'function')
    globals.moduleLoaded('myScript', dependancies, initApp);
}());
