(function() { // using the module pattern to provide name space
  var globals = window.globals;
  var paperGlue = globals.paperGlue; // see initApp below
  var pgMenus = globals.pgMenus;
  var ruleCalc = globals.ruleCalc;
  var dependancies = ['paperGlue','pgMenus','nodeComms','xml2obj','ruleCalc'];

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
    paperGlue.setCursorMode(1);  //only show connections
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
      defaultContextMenu:partsMenu
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
    //console.log(JSON.stringify(part));
    partList[part.name] = {para:part};
    paperGlue.loadSingleImage("project/"+part_path + "/images/"+part.imageName,part.name,
    {pos:paperGlue.viewToReal(contextMenu.getEventPos()),onLoad:partImageLoaded});
  }

  function partImageLoaded(id,imgobj) {
    while(!partList.hasOwnProperty(id) && id[id.length-1] === 'C')
      id = id.slice(0,-1);
    partList[id].imgobj = imgobj;
    imgobj.connections = [];
    imgobj.values = {};
    if(partList[id].para.hasOwnProperty("connections")) {
      var pins;
      if(partList[id].para.connections.hasOwnProperty('list'))
        pins = partList[id].para.connections.list;
      else
        pins = [partList[id].para.connections];  // only one pin
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
    if(partList[id].para.hasOwnProperty("values")) {
      var plv = partList[id].para.values;
      if(plv.hasOwnProperty('list')) {
        for(var vi in plv.list) {
          console.log("plv.list[vi]:"+plv.list[vi]);
          parseValues(imgobj.values,plv.list[vi]);
        }
      } else {
        parseValues(imgobj.values,plv);
      }
    }
    imgobj.rules = [];
    if(partList[id].para.hasOwnProperty("rules")) {
      var plr = partList[id].para.rules;
      if(plr.hasOwnProperty('list')) {
        for(var ri in plr.list) {
          imgobj.rules.push(plr.list[ri].rule);
        }
      }
      else
        imgobj.rules.push(plr.rule);  // only one rule
    }
    console.log("Part has "+imgobj.connections.length + " connections");
    console.log("Part has "+Object.keys(imgobj.values).length + " values");
    console.log(Object.keys(imgobj.values));
    if(imgobj.values.hasOwnProperty('nodes'))  // for preset values - rarely used
      console.log(Object.keys(imgobj.values.nodes));
    console.log("Part has "+imgobj.rules.length + " rules");
  }

  function parseValues(obj,tag) {
    if(tag.hasOwnProperty('value')) {
      var val = tag.value;
      if(val.hasOwnProperty('attrib')) {
        var atr = val.attrib;
        if(atr.hasOwnProperty('name')) {
          console.log("plv:"+Object.keys(atr));
          var v = "0";
          if(atr.hasOwnProperty('default'))
            v = atr.default;  // leave as default
          obj[atr.name] = v;  // only one value
        }
      }
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
    if(rc[0] < 0 || rc[0] >= rows || rc[1] < 0 || rc[1] >= columns)
      return;  // outof limits
    //console.log("Highlight:"+rc);
    clearHighLines();
    clearTraceHistory();
    tracePath(rc[1],rc[0],true,highlight);  // include initial point
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

  function highlight(r1,c1,r2,c2,col) {
    var lineSelected = new Path();
    if(typeof col === 'undefined')
      lineSelected.strokeColor = 'red';
    else
      lineSelected.strokeColor = col;
    lineSelected.opacity = 0.5;
    lineSelected.strokeWidth = 8;
    lineSelected.strokeCap = 'round';
    //console.log("Line from "+gridToPnt(r1,c1)+" to "+gridToPnt(r2,c2));
    lineSelected.add(gridToPnt(r1,c1));
    lineSelected.add(gridToPnt(r2,c2));
    highLines.push(lineSelected);
  }

  var simMode = 0;  // 0 = bus&link, 1 = volt, 2 = amp
  var tracePnts = [];
  var overflow = false;
  var overflowVoltage = 10.0;  //100.0;  // 100V on a strip board - unlikely
  var overflowCurrent = 5.0;  //50.0;   // 50A on a strip board even less likely

  function clearTraceHistory() {
    tracePnts = [];
  }

  // trace path of conductivity from point at row,col
  // if inc_start then include scan of the first point
  // when a path is included perform action

  function tracePath(row,col,inc_start,action) {
    // look for break(s) on this track
    if(col < 0 || col >= columns || row < 0 || row >= rows) {
      // object is outside of strip board so check external junctions
      console.log("Check point only");
      checkPnt(row,col,action);
      return;
    }
    var left_lim = traceDir(row,col-1,-1,-1,action);
    var col_r = col;
    if(!inc_start)  // don't look at the start point
      col_r += 1;
    var right_lim = traceDir(row,col_r,1,columns+1,action);
    if(left_lim < right_lim) {
      action(row,left_lim,row,right_lim);
    }
  }

  function traceDir(row,col,dir,lim,action) {
    //console.log("Trace from "+row+","+col+" in dir:"+dir+" to "+lim);
    jointDir = dir;
    for(var c = col; c != lim; c += dir) {
      var rv = checkPnt(row,c,action);
      if(rv == c)
        return rv-dir;
    }
    return lim-dir;
  }

  function checkPnt(row,col,action,er,ec) {
      //er and ec are optional row and column for line or joint connection to ignor
      var ti = row*columns+col;
      if(tracePnts.indexOf(ti) >= 0)
        return col;  // this point already down so break recursion
      tracePnts.push(ti);
      var j = findJoint(row,col,er,ec,action);
      //if(j !== null)
        //console.log("Found joint:" + j + " at " + col + "," + row);
      if(j == 'break')
        return col;  // move one back
      // if(isResistive(j)) { // resistor
      //   // might follow this resistor in future versions or create node map
      //   break;
      // }
      var lrc = findLine(row,col,er,ec);
      if(!!lrc) {
        console.log("Found line from "+col+","+row+" to "+lrc);
        //console.log("Joints:"+JSON.stringify(joints));
        action(row,col,lrc[1],lrc[0]);  //do the line
        if(lrc[1] >= 0 && lrc[1] < rows && lrc[0] >= 0 && lrc[1] < columns) {
          //console.log("Level:"+jointStack.length+" Joints before link:"+JSON.stringify(joints));
          jointStack.push(joints);
          joints = [lineNodes[jointLine][1-jointLineEnd]]; // other end of line
          //console.log("Level:"+jointStack.length+" Joints at link:"+JSON.stringify(joints));
          tracePath(lrc[1],lrc[0],false,action);  //this time do not include initial point
          joints = jointStack.pop();
          //console.log("Level:"+jointStack.length+" Joints after link:"+JSON.stringify(joints));
        } else
          checkPnt(lrc[1],lrc[0],action,row,col);  //exclude starting point
      }

  }

  function findJoint(row,col,ex_row,ex_col,action) {
    var symbols = paperGlue.getSymbols();
    for(var id in symbols) {
      var symbol = symbols[id];
      var imgobj = symbol.src;
      //console.log("Check symbol:"+imgobj.id);
      if(imgobj.id === 'Break') { // special instance - has no connection
        var rcx = pntToGrid(symbol.raster.position);
        if(rcx[1] == row && rcx[0] == col)
          return 'break';  // this location is a strip board break
        continue;
      }
      if(imgobj.hasOwnProperty('connections')) {
        for(var i = 0; i < imgobj.connections.length; i++) {
          console.log("@2:" & i);
          var pos = paperGlue.getImgConnectionPos(imgobj,symbol.raster,i);
          var rc = pntToGrid(pos);
          //console.log("Compare " + rc);
          if(typeof ex_row !== 'undefined') {
            if(rc[1] == ex_row && rc[0] == ex_col)
              continue;  // this connection is to be ignored
          }
          if(rc[1] == row && rc[0] == col) {
            console.log("Connection with " + imgobj.id);
            if(simMode > 0) {
              if(jointDir < 0)  // put at front
                joints.unshift(symbol.values.nodes[i]);
              else              // put at rear of joints
                joints.push(symbol.values.nodes[i]);
              //console.log("Nodes:"+JSON.stringify(symbol.values.nodes));
              //console.log("Level:"+jointStack.length+" Joints before rules:"+JSON.stringify(joints));
              //console.log("Joints at joint:"+JSON.stringify(joints));
              var depend_on = [];
              var d;
              for(var ri in imgobj.rules) {
                var rule = imgobj.rules[ri];
                console.log("Apply rule:" + rule);
                d = ruleCalc.calcRule(rule,0.1,symbol.values,i);
                // only return nodes as d that are dependant on node i
                if(d >= 0) {
                  //console.log("Node values:"+JSON.stringify(symbol.values.nodes));
                  if((Math.abs(symbol.values.nodes[d][0]) > overflowVoltage) || (Math.abs(symbol.values.nodes[d][1]) > overflowCurrent)) {
                    overflow = true;
                    return null;
                  }
                  // multi rules may have dependant as potential and current
                  // only want to process dependant nodes once - so
                  if(depend_on.indexOf(d) < 0)
                    depend_on.push(d);
                }
              }
              // now process dependant nodes
              for(var di in depend_on)
              {
                d = depend_on[di];
                console.log("@3:" & d);
                var pos2 = paperGlue.getImgConnectionPos(imgobj,symbol.raster,d);
                var rc2 = pntToGrid(pos2);
                jointStack.push(joints);
                joints = [symbol.values.nodes[d]];
                tracePath(rc2[1],rc2[0],false,action);
                joints = jointStack.pop();
              }
            }
            //console.log("Level:"+jointStack.length+" Joints after joint:"+JSON.stringify(joints));
            return imgobj.id;
          }
        }
      } else {
        return null;
      }
    }
    return null;
  }

  function findLine(row,col,ex_row,ex_col) {
    //console.log("Exclude "+ex_row+","+ex_col);
    var lines = paperGlue.getLines();
    //console.log("Check:"+col+","+row);
    for(var id in lines) {
      //console.log("Check:"+id);
      var l = lines[id];
      var p1 = l.path.firstSegment.point;
      var p2 = l.path.lastSegment.point;
      var rc1 = pntToGrid(p1);
      var rc2 = pntToGrid(p2);
      //console.log("End1:"+rc);
      if(rc1[0] == col && rc1[1] == row) {
        if(typeof ex_row !== 'undefined') {
          if(ex_row == rc2[1] && ex_col == rc2[0]) {
            console.log("Excluding "+ex_row+","+ex_col);
            continue;
          }
        }
        updateLineNode(id,0);
        return rc2;
      }
      //console.log("End2:"+rc);
      if(rc2[0] == col && rc2[1] == row) {
        if(typeof ex_row !== 'undefined') {
          if(ex_row == rc1[1] && ex_col == rc1[0]) {
            console.log("Excluding "+ex_row+","+ex_col);
            continue;
          }
        }
        updateLineNode(id,1);
        return rc1;
      }
    }
    return null;
  }

  function updateLineNode(id,end) {
    if(!lineNodes.hasOwnProperty(id))  // only make if doesn't exist
      lineNodes[id] = [[0,0,1E6],[0,0,1E6]];  // a node for either end
      // each node has voltage, current out and impedance
    else { // equalise
      var ln = lineNodes[id];
      var ln0 = ln[0];
      var ln1 = ln[1];

      var v;
      if(ln0[2] === 0 && ln1[2] === 0 && ln0[0] !== ln1[0])
        console.error("Link impedance fault");
      else if (ln0[2] === 0) {  // zero impedance line
        v = ln0[0];
        ln1[2] = 0;
      } else if (ln1[2] === 0) {  // zero impedance line
        v = ln1[0];
        ln0[2] = 0;
      } else {
        v = (ln0[0]/ln0[2] + ln1[0]/ln1[2])*(ln0[2]+ln1[2])/2.0;  // take average voltage for both ends based on impedance
      }
      ln0[0] = v;
      ln1[0] = v;
      // note: current is positive if sourcing, negative of sinking
      var i = (ln0[1] - ln1[1])/2.0;  // take average current but reversed
      ln0[1] = i;  // if one end sources
      ln1[1] = -i;  // then the other end must be a sink
    }
    jointLine = id;
    jointLineEnd = end;
    if(jointDir < 0)
      joints.unshift(lineNodes[id][end]);
    else
      joints.push(lineNodes[id][end]);
  }

  //var sources = [];
  var maxPotential = 12.0;  // change this if higher voltage source found
  var minPotential = -12.0;
  var groundSymbols = [];
  var lineNodes = {};  // line voltages,currents (rem current reverses at one end) and impedances
  var jointLine = null;  // set in findLine for sim mode
  var jointLineEnd;  // 0 for one dir and 1 for other end
  var joints = [];  //links to [potential,current] nodes
  var jointDir = -1; //determines if joint is added to front or rear
  var jointStack = [];  // pushed when following connection (with dir added)

  function setMode(mode) {
    if(mode == 'run') {     // prepare for onFrame runtime
      simMode = 1;
      overflow = false;  // assuming this happened on the last sim
      // find all voltage sources
      var symbols = paperGlue.getSymbols();
      for(var id in symbols) {
        var symbol = symbols[id];
        if(!symbol.hasOwnProperty('values'))
          symbol.values = {};  //usually copied from imgobj as creation
        var imgobj = symbol.src;
        console.log("Check symbol:"+imgobj.id);
        //if(imgobj.id.indexOf('Source') >= 0) {
        //  sources.add(symbol);
        //} else
        if(imgobj.id == 'Grnd') {
          console.log("Found ground symbol");
          groundSymbols.push(symbol);
        }
        // reset all junctions to ground/neutral = 0.0V
        if(imgobj.hasOwnProperty('connections')) {
          symbol.values.nodes = [];
          for(var i = 0; i < imgobj.connections.length; i++) {
            symbol.values.nodes.push([0,0,1E6]);  // zero volts, zero current and 1Meg impedance
          }
          //console.log("Initial symbol nodes:"+JSON.stringify(symbol.values.nodes));
        }
      }
      frameFree = true;
      globals.onFrame = onFrame;
    } else {
      simMode = 0;  // trace only bus and link
      globals.onFrame = null;
    }
  }

  function lineState(r1,c1,r2,c2) {
    //set color for current line voltage or current
    if(joints.length === 0) {  // should be at least earth connection
      console.error("No joints?");
      highlight(r1,c1,r2,c2,col);
    } else {
      //console.log("line state joints:"+JSON.stringify(joints));
      var pot = 0;  // sum all the potentials
      var potdiv = 0;  // sum of inverse impedances
      var cur = 0;
      var minimp = 1E100;  // find min impedance
      var minci = 0;
      for(var ci in joints)  {
        var jt = joints[ci];
        if(jt[0] > maxPotential)
          maxPotential = jt[0];
        if(jt[0] < minPotential)
          minPotential = jt[0];
        var revimp = 1E100;
        if(jt[2] > 0)
          revimp = 1.0/jt[2];
        pot += jt[0]*revimp;
        potdiv += revimp;
        cur += jt[1];  // assumes joints are in a row
        if(jt[2] < minimp) {
          minimp = jt[2];
          minci = ci;
        }
      }
      // cur should be zero - give difference to min impedance joint
      joints[minci][1] += cur;
      pot /= potdiv;  // average potentials
      for(ci in joints) {
        joints[ci][0] = pot;  // set all joints to average
        joints[ci][2] = minimp;
      }
      //console.log("Pot:"+pot);
      var fpot;
      if(pot >= 0)
        fpot = Math.round(pot * 255 / maxPotential);
      else
        fpot = Math.round(pot * 255 / minPotential);
      fpot = Math.min(255,fpot);
      var hpot = fpot.toString(16);
      var ipot = (255-fpot).toString(16);
      //console.log("fpot:"+fpot);
      if(pot >= 0)  // positives range to red
        col = "rgb(" + fpot + ","+ (255-fpot) + ",00)";
      else  // negatives range to blue
        col = "rgb(00," + (255-fpot) +","+ fpot+")";
      highlight(r1,c1,r2,c2,col);
    }
  }

  var frameFree = true;

  function onFrame(dt) { //call from paperGlue limited to 40mSec repeat
    if(!frameFree)
      return;
    frameFree = false;
    console.log("On frame " + dt.toFixed(2));
    clearTraceHistory();
    clearHighLines();
    joints = [];
    jointStack = [];
    for(var gi in groundSymbols) {
      var symbol = groundSymbols[gi];
      console.log("#1:" & JSON.stringify(imgobj.connections));
      var pos = paperGlue.getImgConnectionPos(imgobj,symbol.raster,0);
      var rc = pntToGrid(pos);
      console.log("Frame trace at" + rc);
      tracePath(rc[1],rc[0],true,lineState);  // include initial point
      if(overflow) {
        console.log("Overflow");
        break;
      }
    }
    if(!overflow)
      frameFree = true;  // if commented then one frame only
  }

  globals.editPoint = editPoint;
  globals.setMode = setMode;
  //window.globals.keyhandler = keyDown;  // requests paperglue to pass event here

  //console.log("Globals:");
  //console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
  if (typeof globals.moduleLoaded === 'function')
    globals.moduleLoaded('myScript', dependancies, initApp);
}());
