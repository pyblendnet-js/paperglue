/*!
* paperglue.js v0.0.01 - Sandbox editor using Paper.js.
* See paper.ps
*
* Current features:
*   - click and drag to create snap locked lines
*   - click ends or middle to drag line end or whole lines
*   - click on master image to clone and drag to locate
*   - right click on images for context menu and properties
*   - communication with external paperscript via window.globals
*
* paperglue.js Copyright (c) 2015 - 2015, Robert Parker
* http://grapevine.com.au/~wisteria/index.html
*
* Distributed under the MIT license. See LICENSE file for details.
*
* All rights reserved.
*
* Date: Sat Jan 10 2015
*/

//note:objects here are all somewhere within the paper scope
// Tp make visibile to window, declare as window.object

var nextID = 0;  // for keeping track of all objects with a unique id
var lineInstances = {};
var lineSelected = null;
var imageSelected = null;
var imageSelectedPositiion = null;
var lineSelectMode = 0;
var snapRect = [5,5,10,10];   // offset x,y and then quantum x, y
var lineThickness = 3;
var lineColor = 'black';
var mouseDownPosition;
var rightButton = false;
var imagesLoaded = {};
var imageInstances = {};  //images that have been cloned from sybols in imagesLoaded.
var defaultContextMenu = [ {label:'view', callback:viewCall},{label:'open',callback:openCall} ];
var currentContextMenu = defaultContextMenu;
var currentContextObject = null;
var holdContext = false;  // don't reset contextMenu till after mouseUp
var doRecord = [];  // record of all clonings and moves  {action:string,src:src,raster:image or line:path,pos:point}
var doRecordIndex = 0;  // points to next do location
var recordPath = "testSave.json";
//var ua = navigator.appName.toLowerCase();
//console.log("Browser details:"+ua);  - not a lot of use

/** Set quantum [x,y] for snap on lines and images
  @param {float} typically greater than 1
 */
function setSnap(q) {
  snapRect = [q[0],q[1],0.000001,0.000001];  //min values for quantum
  for(var qi = 2; qi < 4; qi++) {
    if(q[qi] > 0.000001)
      snapRect[qi] = q[qi];
  }
}

function setLineThickness(t) {
  lineThickness = t;
}

function setLineColor(c) {
  lineLColor = c;
}

// helper to add hidden image to document before reference as paper image
function addImage(source, id) {
  var img = document.createElement("img");
  img.src = source;  // this will cause a GET call from the browser
  img.id = id;
  img.hidden = true;
  var src = document.getElementById("body");
  src.appendChild(img);
}

// finds an instance of an image clone based on id, raster or src
// If src then returns a list of matching ids, otherwise first instance
function findImageInstance(search_by,search_key) {
  if(search_key == 'id') {
    if(imageInstances.hasOwnProperty(search_key)) {
      return search_key;
    }
  }
  var ids = [];
  for(var i in imageInstances) {
    var inst = imageInstances[i];
    switch(search_by) {
      case 'raster':
        if(inst.raster == search_key) {
          console.log("Found matching raster");
          return i;
        }
        break;
      case 'src':
          if(inst.src == search_key)
            ids.push(id);
          break;
      default:
        return 'null';
    }
  }
  if(search_by == 'src')
    return ids;
  return null;
}

// onmousedown callback for images that are cloneable, dragable or have context menu
function imageMouseDown(event) {
  mouseDownPos = event.position;
  if(rightButtonCheck(event)) {  // this will set rightButton global
    console.log("Right button down");
  }
  console.log("image mouse down");
  // look to see if this object is the raster for one of the master images
  var id;
  var imgobj;
  var imkeys = Object.keys(imagesLoaded);
  console.log(imkeys);
  for(var i in imkeys) {
    id = imkeys[i];
    console.log("id:"+id);
    imgobj = imagesLoaded[id];
    if(this == imgobj.raster) {  //master image found
      if(rightButton) {
        if(imgobj.hasOwnProperty('contextMenu'))  // if not defined then stay with default
          console.log("Attaching image context menu");
          currentContextMenu = imgobj.contextMenu;
          currentContextObject = {id:id,src:imgobj,raster:imgobj.raster};  //to match image instance object
          holdContext = true;  // cross browser solution to default mouse up reset
          return false;   // just show context menu now - see context menu callback below
      }
      if(imgobj.hasOwnProperty('dragClone')) {  // if not defined then assume false
        if(imgobj.dragClone === true) {   // this image object can be dragged, so it should have isSymbol set true also
          //console.log("Symbol:" + imgobj.symbol);
          symbolPlace(imgobj.id);
          imageSelected.position = imgobj.raster.position;
          imageSelectedPosition = null;  // so we can tell there was no prior position
        }
      }
      return false;  // master image found, so no need to look at clones in imageInstances
    }
  }
  // no master image found, so maybe this is a clone
  id = findImageInstance("raster",this);
  if(!!id) {
    var imginst = imageInstances[id];
    if(this == imginst.raster) {  // clone image found
      if(rightButton) {
        imgobj = imginst.src;
        if(imgobj.hasOwnProperty('instanceContextMenu')) {   // if not defined then stay with default
           currentContextMenu = imginst.src.instanceContextMenu;
           // needed to add id to currentContectObject
           currentContextObject = {id:id,src:imginst.src,raster:imginst.raster};
           holdContext = true;  // cross browser solution to default mouse up reset
           return false; // clone image not selected for right click
        }
      }
      imageSelected = this;
      imageSelectedPosition = this.position.clone();  // need to dereference
      return false;  //found so done looking
    }
  }
}

// uses master image raster to create clone
// only use force_id for redo so that it uses old id
function symbolPlace(imgid, force_id) {
  var imgobj = imagesLoaded[imgid];
  imageSelected = imgobj.symbol.place();
  imageSelected.scale(0.5);
  imageSelected.onMouseDown = imageMouseDown;
  var img_id;
  if(typeof force_id === 'undefined') {
    imageInstances[nextID] = {src:imgobj, raster:imageSelected};
    doRecordAdd({action:'symbolPlace',id:nextID,type:'image',src:imgobj.id});
    nextID += 1;
  } else {  // used by redo to accept old id - so need to record do action
    imageInstances[force_id] = {src:imgobj, raster:imageSelected};
  }
  imgobj.instances += 1;
}

// find img_id for imgobj in imageInstances
function symbolRemove(id) {
  var inst = imageInstances[id];
  inst.raster.remove();
  delete imageInstances[id];
}

/**
 * Called from external script via window.globals to add images to the document with behaviour parameters
 * @param {array} images_to_load is array of image objects having parameters src, id, [isSymbol:bool, dragClone:bool, contextMenu:object, instanceContextMenu:object, pos:point, scale:float]
 */
function loadImages(images_to_load) {
  while(images_to_load.length > 0) {  // continue till empty - not sure if this is valid
    var imgobj = images_to_load.pop();
    imagesLoaded[imgobj.id]= imgobj;  // record master images
    addImage(imgobj.src,imgobj.id);  // add image to document
    imgobj.raster = new Raster(imgobj.id);  // make this a paper image
    //console.log(img.isSymbol);
    if(imgobj.hasOwnProperty('isSymbol')) {  // this image can appear many times as instances
      if(imgobj.isSymbol === true) {   // needs true comparison
        imgobj.symbol = new Symbol(imgobj.raster);
        imgobj.raster.remove();  //dont need this cluttering the document
        imgobj.raster = imgobj.symbol.place();
        imgobj.instances = 0;
      }
    }
    if(imgobj.hasOwnProperty('pos')) {   // a position given so it will be visible
      //console.log("Pos:" + img.pos);
      imgobj.raster.position = imgobj.pos;
    } else {  // no position so dont show yet
      imgobj.raster.remove();  //dont need this cluttering the document
    }
    if(imgobj.hasOwnProperty('scale')) {
      imgobj.raster.scale(image.scale);
    }
    var listen_to_mouse = imgobj.hasOwnProperty('contextMenu');
    if(imgobj.hasOwnProperty('dragClone')) {  // if not defined then assume false
      if(imgobj.dragClone === true)
        listen_to_mouse = true;
    }
    if(listen_to_mouse)
      imgobj.raster.onMouseDown = imageMouseDown;  // needed for drag or context
  }
}

window.contextMenuCallback = function(menu_index){
  console.log('context menu call for item:' + menu_index);
  if(currentContextMenu !== null) {
    var menu_item = currentContextMenu[menu_index];
    if(menu_item.hasOwnProperty('callback')) {
      var callback = menu_item.callback;
      if(typeof callback == 'function')
        callback();
    }
  }
  hideContextMenu('contextMenu');
};

function viewCall(){
  console.log('view called');
}

function openCall(){
  console.log('open called');
}

function onContextMenu(event) {
  console.log("Call for context menu");
  showContextMenu('contextMenu',event);
  return false;
}

// mostly from http://www.codeproject.com/Tips/630793/Context-Menu-on-Right-Click-in-Webpage
function showContextMenu(control, e) {
  var posx = e.clientX +window.pageXOffset +'px'; //Left Position of Mouse Pointer
  var posy = e.clientY + window.pageYOffset + 'px'; //Top Position of Mouse Pointer
  var el = document.getElementById(control);
  el.style.position = 'absolute';
  el.style.display = 'inline';
  el.style.left = posx;
  el.style.top = posy;
  var tbl = el.children[0];  //assumes menu has table as first child
  tbl.innerHTML = "";
  for(var mi in currentContextMenu) {
    var m = currentContextMenu[mi];
    console.log(m);
    var txt = m.label;
    if(m.hasOwnProperty('propCall')) {
      console.log("Has propCall");
      if(typeof m.propCall == 'function') {
        //console.log("Has propCall as function");
        txt += " " + m.propCall(currentContextObject);
      }
    }
    tbl.innerHTML += '<tr><td ><div  class="ContextItem" onmouseup="contextMenuCallback(' + mi + ')" >' + txt + '</div></td></tr>';
  }
}

function hideContextMenu(control) {
  var el = document.getElementById(control);
  el.style.display = 'none';
  var tbl = el.children[0];  //assumes menu has table as first
  tbl.innerHTML = "";
  currentContextMenu = defaultContextMenu;
}

window.oncontextmenu = onContextMenu;

function rightButtonCheck(event) {
  //console.log(event);
  rightButton = false;
  if(event.event) {
    if(event.event.button) {
      //console.log(event.event.button);
      rightButton = (event.event.button == 2);
    }
  } else if (event.which) {
    rightButton = (event.which == 3);
  } else if (event.button) {
    rightButton = (event.button == 2);
  }
  if(!rightButton)
    hideContextMenu('contextMenu');
  return rightButton;
}

// default mouse down event handler - most browser will bubble to this from the other mouseDown handlers
function onMouseDown(event) {
  console.log("Basic Mouse down");
  if(rightButtonCheck(event)) {
    console.log("Right button down");
    if(holdContext === false)  // cross browser solution to default mouse up reset
      currentContextMenu = defaultContextMenu;
    return false;
  }
  if(!!lineSelected || !!imageSelected) {     // an existing line has been selected
    console.log("Something selected");
    return false;
  }
  // other wise start a new line
  newLine();
}

function newLine() {
  console.log("Start new path");
  lineSelected = new Path();
  lineSelected.strokeColor = lineColor;
  lineSelected.strokeWidth = lineThickness;
  lineSelected.strokeCap = 'round';
  lineSelected.onMouseDown = lineMouseDown;  // the call to use for mod
  lineSelectMode = 0;  // drag last point
}

// onmousedown callback for two point paths
function lineMouseDown(event) {
  if(rightButtonCheck(event)) {
    console.log("Right button down");
    if(globals.hasOwnProperty('lineContextMenu')) {
      currentContextMenu = globals.lineContextMenu;
      holdContext = true;  // cross browser solution to default mouse up reset
    } else
      currentContextMenu = defaultContextMenu;
      return false;
    }
    console.log("link mouse down");
    lineSelected = this;
    lineSelectedPosition = [lineSelected.firstSegment.point.clone(),lineSelected.lastSegment.point.clone()];
    var line_select_fraction = (event.point - this.segments[0].point).length/this.length;
    if(line_select_fraction < 0.25) {  //drag start of link
      lineSelectMode = 1;
    } else if (line_select_fraction > 0.75) {  // drag end of link
      lineSelectMode = 0;
    } else {
      lineSelectMode = 2;   // drag whole link
    }
    console.log("Selected fraction:" + line_select_fraction);
    console.log("Line select mode:" + lineSelectMode);
    console.log("Selected pos:" + lineSelected.position);
    return false;
}

// univeral mouse drag function can drag lines or images or create rubber band new line
function onMouseDrag(event) {
  if(rightButton)  // no drag for right button
    return;
  if(!!lineSelected) {   // link selected so drag existing
    //console.log("Link selected");
    switch(lineSelectMode) {  //chosen in onlinemousedown
      case 0: //move last point
        if(lineSelected.segments.length < 2) {
          lineSelected.add(event.point);
          lineSelectedPosition = null;  // to indicate it is new
        } else {
          lineSelected.lastSegment.point += event.delta;
        }
        break;
      case 1: //move first point
        lineSelected.firstSegment.point += event.delta;
        break;
      default: // move all
        lineSelected.position += event.delta;   // drag whole link
    }
    return;
  } else if(!!imageSelected) {   // drag image
    imageSelected.position += event.delta;
  }
}

function snapPoint(p) {
  return new Point(
    Math.round((p.x-snapRect[0])/snapRect[2]) * snapRect[2] +snapRect[0],
    Math.round((p.y-snapRect[1])/snapRect[3]) * snapRect[3] +snapRect[1]);
}

// snaps both ends of the line path to grid quantum
function snapLine(p) {
  console.log("Before:" + p.firstSegment.point);
  console.log("Snap Rect:" + snapRect);
  p.firstSegment.point = snapPoint(p.firstSegment.point);
  console.log("After:" + p.firstSegment.point);
  p.lastSegment.point = snapPoint(p.lastSegment.point);
  var dx = p.firstSegment.point.x - p.lastSegment.point.x;
  var dy = p.firstSegment.point.y - p.lastSegment.point.y;
  return((dx !== 0) || (dy !== 0));
}

// universal mouse up handler - mainly just tidy up
function onMouseUp(event) {
  console.log("Mouse up");
  if(rightButton) {
    rightButton = false;
    return;
  }
  if(!!lineSelected) {
    // for undo it will be necessary to look for previous position if any
    // point needs to be cloned to dereference
    line_id = validatePath(lineSelected);
    lineSelected = null;
    // continue through to path addition or removal
  } else if(!!imageSelected) {
    imageSelected.position = snapPoint(imageSelected.position);
    var img_id = findImageInstance('raster',imageSelected);
    console.log("instance found with id:"+img_id);  // need to keep id as well - might be null for master objects in layout mode
    if(imageSelected.position == imageSelectedPosition) { // no movement or no prior position it being null
      // use mouseDownPosition or event.position to find the closest point of rotation in object
      var rotation = Math.round(imageSelected.rotation);
      imageSelected.rotate(90);  // need to look up source to find centre of rotation - could also have 45 deg mode
      imageSelected.rotation = Math.round(imageSelected.rotation);  // prevent error creaping in
      doRecordAdd({action:'imageRotate',id:img_id,type:'image',rot:[rotation,imageSelected.rotation]});
    } else {
      // keeping the obj as record is fine for undo but not so good for redo if the object gets deleted further back
      doRecordAdd({action:'imageMove',id:img_id,type:'image',pos:[imageSelectedPosition,imageSelected.position]});
    }
    imageSelected = null;
  }
}

function moveCurrentImage(x,y,r) {
  var im = currentContextObject.raster;
  //console.log("pos:"+im.position);
  var p = new Point(x,y);
  if(x !== im.position.x && y !== im.position.y) {
    //console.log(p);
    doRecordAdd({action:'imageMove',id:currentContextObject.id,type:'image',pos:[im.position,p]});
    //console.log(doRecord[doRecordIndex-1].pos);
    im.position = p;
  }
  if(r !== im.rotation) {
    var rot = Math.round(r);
    doRecordAdd({action:'imageRotate',id:currentContextObject.id,type:'image',rot:[im.rotation,rot]});
    im.rotation = rot;
  }
}

function getLineID(path) {
  for(var id in lineInstances) {
    if(lineInstances[id].line == path) {
      console.log('Found existing line with id:', id);
      return id;
    }
  }
  return null;
}

function validatePath(path, force_id) {
  // only use force id for redo where the old id must be reused
  var next_id = nextID;
  var line_id = null;
  if(typeof force_id == 'undefined') {
    line_id = getLineID(path);
  } else {
    console.log("Force new line to id:",force_id);
    next_id = force_id;
  }
  console.log("Path length:" + path.length);
  if(snapLine(path)) {
    if(line_id === null) { //this path doesn't exist
      console.log('Creating new line with id:',next_id);
      lineInstances[next_id] = {line:path};
      //console.log(lineInstances[next_id]);
      //console.log(lineInstances[0]);
      if(next_id == nextID)
        nextID++;
      line_id = next_id;
    }
    if(typeof force_id == 'undefined') {  // don't record redos
      var np = [lineSelected.firstSegment.point.clone(),lineSelected.lastSegment.point.clone()];
      doRecordAdd({action:'lineMove',id:line_id,type:'line',pos:[lineSelectedPosition,np] });
    }
  } else {  // length of line is too short
    if(line_id === null) { //this path doesn't exist
      path.remove();
    } else {
      removeLine(line_id);
    }
    return null;
  }
  return line_id;
}

function removeLine(id) {
  if(lineInstances.hasOwnProperty(id))  // this path does exist
    lineInstances[id].line.remove();  // should remove from screen
  delete lineInstances[id];  // removes from list
}

function doRecordAdd(action) {
  if(doRecordIndex >= doRecord.length)
    doRecord.push(action);
  else {
    console.log("Recording action at index:",doRecordIndex);
    doRecord.splice(doRecordIndex,0,action);
  }
  doRecordIndex++;
}

var controlPressMs = 0;
var shiftPressMs = 0;
var altPressMs = 0;
var modPressDelay = 800;  //delay in ms since mod key pressed for modified action

function onKeyDown(event) {   //note: this is the paper.js handler - do not confuse with html
  var d = new Date();
  var nowMs = d.getTime();
  if(event.key == 'control' || event.key == 'shift' || event.key == 'alt') {
    console.log("Modifier pressed:"+event.key+" at "+nowMs);
    switch(event.key) {
      case 'control':
        controlPressMs = nowMs;
        break;
      case 'shift':
        shiftPressMs = nowMs;
        break;
      case 'alt':
        altPress = nowMs;
        break;
    }
    return;
  }
  event.controlPressed = ((nowMs - controlPressMs) < modPressDelay) || event.modifiers.control;
  event.shiftPressed = ((nowMs - shiftPressMs) < modPressDelay) || event.modifiers.shift;
  event.altPressed = ((nowMs - altPressMs) < modPressDelay) || event.modifiers.alt;
  console.log("Now:"+nowMs+" "+modPressDelay);
  console.log("Now:"+(nowMs - controlPressMs));
  console.log("Paperglue received:" + event.key);
  var propagate = true;
  if(event.key == 'z') {
    if(event.controlPressed) {
      console.log("cntrlZ");
      if(event.shiftPressed) {
        redo();
      } else {
        undo();
      }
      event.stopPropagation();
      propagate = false;
    }
  } else if(event.key == 'x') {
    if(event.controlPressed) {
      console.log("cntrlX");
      if(event.shiftPressed) {  // prune unnecessary edits
        doRecord = pruneDo();
        doRecordIndex = doRecord.length;
      } else {  // undo and remove that particular redo
        undo();
        doRecord.splice(doRecordIndex,1);
      }
      event.stopPropagation();
      propagate = false;
    }
  } else if(event.key == 's') {
    if(event.controlPressed) {
      console.log("cntrlS");
      if(event.shiftPressed) {  // save as

      } else {
        save();
      }
      event.preventDefault();
      event.stopPropagation();
      propagate = false;
    }
  } else if(event.key == 'o') {
    if(event.controlPressed) {
      console.log("cntrlO");
      if(event.shiftPressed) {  // load from

      } else {
        load();
      }
      event.stopPropagation();
      propagate = false;
    }
  }
  if(propagate && (typeof globals.keyhandler == 'function')) {
    console.log("Passing key upwards");
    propagate = globals.keyhandler(event);
  }
  return propagate;
}

function save() {
  var dolist = doRecord;  //pruneDo();
  console.log("Try to save");
  console.log("Globals:" + Object.keys(window.globals));
  console.log("SendData:",typeof window.globals.sendData);
  var jdata = JSON.stringify(dolist);
  if(window.location.protocol == 'file:') {
    // might try to impletement local storage some day
    console.log("Storage type:" + typeof(Storage));
    if(typeof(Storage) === "undefined") {
      console.log("Local storage not implemented");
    } else {
      console.log("Data:"+jdata);
      localStorage.data = jdata;
      console.log("Local storage:" + localStorage);
    }
  } else if(typeof window.globals.sendData === 'function') {
    //window.globals.onReply = onReply(response);
    var save_data = {command:'save',path:recordPath,data:jdata};
    window.globals.sendData(JSON.stringify(save_data));
  }
}

function load() {
  console.log("Load:",typeof window.globals.load);
  if(window.location.protocol == 'file:') {
    // might try to impletement local storage some day
    if(typeof(Storage) === "undefined") {
      console.log("Local storage not implemented");
    } else {
      console.log("Parsing length = " + localStorage.data.length);
      parseRecord(localStorage.data);
    }
  } else if(typeof window.globals.sendData === 'function') {
    window.globals.onReply = onLoadReply;
    var load_data = {command:'load',path:recordPath};
    window.globals.sendData(JSON.stringify(load_data));
  }
}

function onLoadReply(res) {
  console.log("Onreply:"+res);
  if(false) { //res.indexof('500') === 0) {  //starts with error code
  //   console.log("Report error:"+res);
  } else {
     console.log("attempting to parse json object");
    try {
      var reply_obj = JSON.parse(res);
      console.log(reply_obj);
      if(reply_obj.type == 'file')
        parseRecord(reply_obj.data);
    } catch(e1) {
      console.logI("Error parsing reply"+e1);
    }
  }
}

function parseRecord(jdata) {
    try {
      console.log("Data="+jdata);
      var newRecord = JSON.parse(jdata);
      console.log("New record="+newRecord);
      console.log(typeof newRecord);
      console.log("New record has" + newRecord.length + " actions");
      removeAll();
      doRecord = newRecord;
      correctPosPoints(doRecord);
      doRecordIndex = 0;
      doAll();
    } catch(e2) {
      console.log("Error parsing file data"+e2);
    }
}

function correctPosPoints(do_record) {
  for(var di in do_record) {
    var to_do = do_record[di];
    if(to_do.hasOwnProperty('pos')) {
      console.log("Fix pos");
      fixPos(to_do.pos);  // check for left overs of JSON conversion problems
    }
    doRecord[di] = to_do;
  }
}


function parsePoint(ord) {
  console.log(ord[0]);  // will be undefined for a real point
  if(ord[0] === 'Point')
    return new Point(ord[1],ord[2]);
  else
    return ord;  // no change
}

function parseLine(arr) {
  console.log("Type;"+(typeof arr));
  console.log(arr.length);
  if(arr.length === 2) {
    return [parsePoint(arr[0]),parsePoint(arr[1])];
  } else if(arr[0] === 'Point') {
    return parsePoint(arr);
  }
  return arr;  // no change needed
}

// JSON doesn't know how to create a paper.Point
function fixPos(pos) {
  if(pos[0] !== null)  // not null
    pos[0] = parseLine(pos[0]);
  pos[1] = parseLine(pos[1]);
  console.log(pos[1]);
}

function removeLines() {
  var lineIDs = Object.keys(lineInstances);
  console.log("Removing lines:"+lineIDs.length);
  for(var i in lineIDs) {
    removeLine(lineIDs[i]);
  }
}

function removeSymbols() {
  var symbolIDs = Object.keys(imageInstances);
  console.log("Removing images:"+symbolIDs.length);
  for(var i in symbolIDs) {
    symbolRemove(symbolIDs[i]);
  }
}

function removeAll(){
  if(confirm("Do you really want to clear memory?"))
  { removeLines();
    removeSymbols();
    doRecord = [];
    doRecordIndex = 0;
  }
}

function undo() {
    console.log("Undo");
    if(doRecord.length <= 0 || doRecordIndex === 0)
      return;  // nothing to undo
    console.log("doRecordIndex: " + doRecordIndex);
    doRecordIndex--;
    var last_do = doRecord[doRecordIndex];
    console.log("Undoing " + last_do.action + " for " + last_do.id + " which as pos:" + last_do.pos);
    var raster;
    switch(last_do.action) {
      case 'lineMove':
        console.log(lineInstances[0]);
        console.log("line instances:" + (lineInstances.length));

        console.log("line instances:" + (Object.keys(lineInstances)));
        console.log("line instances:" + Object.keys(lineInstances).indexOf(String(last_do.id)));
        if(Object.keys(lineInstances).indexOf(String(last_do.id)) < 0) {
          console.log('No instance of line id:' + last_do.id);
          break;
        }
        var path = lineInstances[last_do.id].line;
        // console.log("Obj pos1:",path.firstSegment.point);
        // console.log("path pos2:",path.lastSegment.point);
        // console.log("path pos:",path.position);
        if(!last_do.pos[0]) {  // no previous existance
          removeLine(last_do.id);
        } else {
          path.firstSegment.point = last_do.pos[0][0];
          path.lastSegment.point = last_do.pos[0][1];
          console.log("Return path to " + last_do.pos[0]);
          // console.log("path pos1:",path.firstSegment.point);
          // console.log("path pos2:",path.lastSegment.point);
          // console.log("path pos:",path.position);
        }
        break;
      case 'imageMove':
        raster = imageInstances[last_do.id].raster;
        if(doRecordIndex > 0) {
          var prev_do = doRecord[doRecordIndex-1];
          if(prev_do.action == 'symbolPlace') {  // this was the first drag
            console.log("Remove symbol from instances");
            console.log("Attempting to remove instance of " + prev_do.src + " with " + prev_do.id);
            symbolRemove(prev_do.id);
            doRecordIndex--;  // skip back over symbol places too
            break;
          }
        }
        if(last_do.pos != 'undefined'){  // check it has a pos
          raster.position = last_do.pos[0];
          console.log("Return img position to " + last_do.pos);
        }
        break;
      case 'imageRotate':
        raster = imageInstances[last_do.id].raster;
        if(typeof last_do.rot != 'undefined'){  // check it has a rot
          if(!last_do.rot[0]) {
            raster.rotation = 0;
          } else {
            raster.rotation = last_do.rot[0];
            console.log("Return img rotation to " + last_do.rot[0]);
          }
        }
        break;
    }
}

function redo() {
  console.log("Redo");
  if(doRecordIndex >= doRecord.length)
    return false;  // nothing to undo
  var to_do = doRecord[doRecordIndex];
  console.log(Object.keys(to_do));
  console.log("Redoing " + to_do.action);
  var raster;
  switch(to_do.action) {
    case 'lineMove':
      console.log(Object.keys(lineInstances).length);
      if(!lineInstances.hasOwnProperty(to_do.id)) {
        console.log("path id " + to_do.id + " nolonger exists - remaking");
        newLine();
        console.log(to_do.pos[1]);
        lineSelected.add(to_do.pos[1][0]);
        lineSelected.add(to_do.pos[1][1]);
        console.line("line:" + lineSelected);
        // need to reuse old id
        var id = validatePath(lineSelected,to_do.id);  // adds to lineInstances
        lineSelected = null;
      } else {
        var path = lineInstances[to_do.id].line;
        path.firstSegment.point = to_do.pos[1][0];
        path.lastSegment.point = to_do.pos[1][1];
      }
      break;
    case 'imageMove':
      raster = imageInstances[to_do.id].raster;
      raster.position = to_do.pos[1];
      break;
   case 'imageRotate':
      raster = imageInstances[to_do.id].raster;
      raster.rotation = to_do.rot[1];
      break;
    case 'symbolPlace':
      symbolPlace(to_do.src,to_do.id);
      imageSelected = null;
      // this is normally followed by a drag move, so do this too
      to_do = doRecord[doRecordIndex+1];
      if(to_do.action == 'imageMove') {
        doRecordIndex++;
        raster = imageInstances[to_do.id].raster;
        raster.position = to_do.pos[1];
      }
      break;
  }
  doRecordIndex++;
  return true;  // something done
}

function doAll() {
  while(doRecordIndex < doRecord.length) {
    redo();
  }
}

function pruneDo() {
  // returned current do record pruned down to minimum actions necessary to repeat result
  // also used for system save.
  console.log("BEFORE");
  for(var i in doRecord) {
      console.log("#"+i+"="+doRecord[i].action+" to "+doRecord[i].id);
  }
  var prunedDo = [];  // a list of relevant do's.
  var ids_found = [];   // objects already loaded into pruned list
  for(var di = doRecordIndex-1; di >= 0; di--) {  // work backwards through do list
    //console.log("Do#"+di);
    var to_do = doRecord[di];
    //console.log("ids found:"+ids_found);
    //console.log(ids_found.indexOf(string(to_do.id)));
    //console.log(typeof to_do.id);
    //if(ids_found.length > 0)
    //  console.log(typeof ids_found[0]);
    if(ids_found.indexOf(String(to_do.id))>= 0)
      continue;
    ids_found.push(+to_do.id);  // this object covered one way or other - NOTE: push will convert everything to string without the + prefix
    //console.log("Checking todo action:",to_do.action);
    switch(to_do.action) {
      case 'lineMove':
        if(!lineInstances.hasOwnProperty(to_do.id)) {
          //console.log("path nolonger exists - so ignor");
          break;
        }
        to_do.pos[0] = null;  // so that it knows to remove the line on an undo
        prunedDo.splice(0,0,to_do);
        break;
      case 'imageMove':
      case 'imageRotate':
      case 'symbolPlace':
        if(!imageInstances.hasOwnProperty(to_do.id)) {
          //console.log("image nolonger exists - so ignor");
          break;
        }
        //console.log("Checking todo action:",to_do.action);
        var actions_found = {};
        for(var dj = di; dj >= 0; dj--) {  // go backwards (including to_do) and find last of move and rotates and symbolplace
          var will_do = doRecord[dj];
          //console.log("  Checking #"+dj+" willdo action:"+will_do.action+" for "+will_do.id);
          if(to_do.id == will_do.id) {
            //console.log("Actions found:",Object.keys(actions_found));
            if(actions_found.hasOwnProperty(will_do.action)) {
              //console.log("Duplicate");
              continue;
            }
            //console.log("  Accept #"+dj+" willdo action:"+will_do.action+" to "+will_do.id);
            actions_found[will_do.action] = will_do;
            //console.log("af:",actions_found[a])
            prunedDo.splice(0,0,will_do);
            if(will_do.action === 'symbolPlace')
              break; // all done
          }
        }

    }
  }
  console.log("AFTER");
  for(i in prunedDo) {
    console.log("#"+i+"="+prunedDo[i].action+" to "+prunedDo[i].id);
  }
  return prunedDo;
}


// global hooks for created objects
function getImageInstances() {
  return imageInstances;
}

function getLineInstances() {
  console.log("Returning line instances:", Object.keys(lineInstances).length);
  return lineInstances;
}

function getDoRecord() {
  console.log("Returning do record:", doRecord.length);
  return doRecord;
}

function getCurrentContextObject() {
  return currentContextObject;
}

// think this needs to be at the bottom so under scripts find things fully loaded
console.log("PaperGlue functions to window globals");
// window global are use for cross scope communications
var globals = window.globals;
var exports = {
  loadImages:loadImages,
  getImages:getImageInstances,
  getLines:getLineInstances,
  getDoRecord:getDoRecord,
  setSnap:setSnap,
  setLineThickness:setLineThickness,
  setLineColor:setLineColor,
  keyHandler:null,
  remove_all:removeAll,
  getCurrentContextObject:getCurrentContextObject,
  moveCurrentImage:moveCurrentImage
};
globals.paperGlue = exports;

if(typeof globals.onPaperGlueLoad == 'function')  { // myScript couldn't find loadImages so provided a call to repeat the request
  console.log("PaperGlue loaded now so can use onPaperLoad to load images.");
  console.log(typeof globals.loadImages);
  globals.onPaperGlueLoad();
}
// that was a bit messy and my be avoided if I used requirejs or browserify - though I suspect that paper.js will not like it.
