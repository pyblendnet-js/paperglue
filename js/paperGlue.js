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

var lineInstances = {};
var lineNextID = 0;
var lineSelected = null;
var imageSelected = null;
var lineSelectMode = 0;
var snapQuantum = 40;
var rightButton = false;
var imagesLoaded = [];
var imageInstances = {};  //images that have been cloned from sybols in imagesLoaded.
var defaultContextMenu = [ {label:'view', callback:viewCall},{label:'open',callback:openCall} ];
var currentContextMenu = defaultContextMenu;
var currentContextObject = null;
var holdContext = false;  // don't reset contextMenu till after mouseUp
var doRecord = [];  // record of all clonings and moves  {action:string,src:imageobject,obj:raster or path,pos:point}
var doRecordIndex = 0;  // points to next do location


console.log("PaperGlue functions to window globals");
// window global are use for cross scope communications
var globals = window.globals;
globals.loadImages = loadImages;
globals.getImages = getImageInstances;
globals.getLines = getLineInstances;
globals.setSnapQuantum = setSnapQuantum;

// global hooks for created objects
function getImageInstances() {
  return imageInstances;
}

function getLineInstances() {
  return lineInstances;
}

/** Set quantum for snap on lines and images
  @param {float} typically greater than 1
 */
function setSnapQuantum(q) {
  if(q < 0.000001)
    snapQuantum = 0.000001;
  else
    snapQuantum = q;
}

// helper to add hidden image to document before reference as paper image
function addImage(source, id) {
  var img = document.createElement("img");
  img.src = source;
  img.id = id;
  img.hidden = true;
  var src = document.getElementById("body");
  src.appendChild(img);
}

// finds an instance of an image clone based on id, raster or imageObject
// If imageObject then returns a list of matching objects, otherwise first instance
function findImageInstance(search_by,search_key) {
  var objs = [];
  for(var i in imageInstances) {
    var inst = imageInstances[i];
    switch(search_by) {
      case 'id':
        if(inst.id == search_key)
          return inst;
        break;
      case 'raster':
        if(inst.raster == search_key)
          return inst;
        break;
      case 'imageObject':
          if(inst.imgobj == search_key)
            objs.push(inst);
          break;
      default:
        return 'null';
    }
  }
  if(search_by == 'imageObject')
    return objs;
  return null;
}

// onmousedown callback for images that are cloneable, dragable or have context menu
function imageMouseDown(event) {
  if(rightButtonCheck(event)) {  // this will set rightButton global
    console.log("Right button down");
  }
  console.log("image mouse down");
  // look to see if this object is the raster for one of the master images
  var imgobj;
  for(var i in imagesLoaded) {
    imgobj = imagesLoaded[i];
    if(this == imgobj.raster) {  //master image found
      if(rightButton) {
        if(imgobj.hasOwnProperty('contextMenu'))  // if not defined then stay with default
          console.log("Attaching image context menu");
          currentContextMenu = imgobj.contextMenu;
          currentContextObject = {imageObject:imgobj,raster:imgobj.raster};  //to match image instance object
          holdContext = true;  // cross browser solution to default mouse up reset
          return false;   // just show context menu now - see context menu callback below
      }
      if(imgobj.hasOwnProperty('dragClone')) {  // if not defined then assume false
        if(imgobj.dragClone === true) {   // this image object can be dragged, so it should have isSymbol set true also
          //console.log("Symbol:" + imgobj.symbol);
          symbolPlace(imgobj);
          imageSelected.position = this.position;
        }
      }
      return false;  // master image found, so no need to look at clones in imageInstances
    }
  }
  // no master image found, so maybe this is a clone
  for(i in imageInstances) {
    var imginst = imageInstances[i];
    if(this == imginst.raster) {  // clone image found
      if(rightButton) {
        imgobj = imginst.imageObject;
        if(imgobj.hasOwnProperty('instanceContextMenu')) {   // if not defined then stay with default
           currentContextMenu = imginst.imageObject.instanceContextMenu;
           currentContextObject = imginst;
           holdContext = true;  // cross browser solution to default mouse up reset
           return false; // clone image not selected for right click
        }
      }
      imageSelected = this;
      return false;  //found so done looking
    }
  }
}

// uses master image raster to create clone
function symbolPlace(imgobj) {
  imageSelected = imgobj.symbol.place();
  imageSelected.scale(0.5);
  imageSelected.onMouseDown = imageMouseDown;
  img_id = imgobj.nextID;
  imageInstances.push({imageObject:imgobj, raster:imageSelected, id:img_id});
  doRecordAdd({action:'symbolPlace',src:imgobj,id:img_id});
  imgobj.instances += 1;
  imgobj.nextID += 1;
}

// find img_id for imgobj in imageInstances
function symbolRemove(imgobj, img_id) {
  console.log("Attempting to remove instance of " + imgobj.id + " with " + img_id);
  for(var i in imageInstances) {
    var inst = imageInstances[i];
    console.log("Instance#" + i + " = " + inst.imageObject.id + " has id " + inst.id);
    if(inst.imageObject == imgobj) {
      console.log("Instance imageobjects match");
      if(inst.id == img_id) {
        console.log("Instance id match");
        imgobj--;
        inst.raster.remove();
        imageInstances.slice(i,1);
        return;
      }
    }
  }
}

/**
 * Called from external script via window.globals to add images to the document with behaviour parameters
 * @param {array} images_to_load is array of image objects having parameters src, id, [isSymbol:bool, dragClone:bool, contextMenu:object, instanceContextMenu:object, pos:point, scale:float]
 */
function loadImages(images_to_load) {
  while(images_to_load.length > 0) {  // continue till empty - not sure if this is valid
    var imgobj = images_to_load.pop();
    imagesLoaded.push(imgobj);  // record master images
    addImage(imgobj.src,imgobj.id);  // add image to document
    imgobj.raster = new Raster(imgobj.id);  // make this a paper image
    //console.log(img.isSymbol);
    if(imgobj.hasOwnProperty('isSymbol')) {  // this image can appear many times as instances
      if(imgobj.isSymbol === true) {   // needs true comparison
        imgobj.symbol = new Symbol(imgobj.raster);
        imgobj.raster.remove();  //dont need this cluttering the document
        imgobj.raster = imgobj.symbol.place();
        imgobj.instances = 0;
        imgobj.nextID = 0;
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
  lineSelected.strokeColor = 'black';
  lineSelected.strokeWidth = 10;
  lineSelected.strokeCap = 'round';
  lineSelected.onMouseDown = lineMouseDown;
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
    console.log("Link selected");
    switch(lineSelectMode) {  //chosen in onlinemousedown
      case 0: //move last point
        if(lineSelected.segments.length < 2) {
          lineSelected.add(event.point);
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

// snaps both ends of the lines to grid quantum
function snap(p) {
  var rp = p.firstSegment.point/snapQuantum;
  p.firstSegment.point = rp.round()*snapQuantum;
  rp = p.lastSegment.point/snapQuantum;
  p.lastSegment.point = rp.round()*snapQuantum;
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
    doRecordAdd({action:'pathMove',id:line_id,pos:[lineSelected.firstSegment.point.clone(),lineSelected.lastSegment.point.clone()]});
    lineSelected = null;
    // continue through to path addition or removal
  } else if(!!imageSelected) {
    var rp = imageSelected.position/snapQuantum;
    imageSelected.position = rp.round()*snapQuantum;
    var imginst = findImageInstance('raster',imageSelected);
    console.log("instance found with id:"+imginst.id);  // need to keep id as well - might be null for master objects in layout mode
    // keeping the obj as record is fine for undo but not so good for redo if the object gets deleted further back
    doRecordAdd({action:'imageMove',obj:imageSelected,pos:imageSelected.position});
    imageSelected = null;
  }
}

function getLineID(path) {
  for(var i = 0; i < lineNextID;i++) {
    if(lineInstances.hasOwnProperty(i))
      return i;
  }
  return lineNextID;
}

function validatePath(path) {
  var id = getLineID(lineSelected);
  if(path.length >= snapQuantum) {
    snap(path);
    if(!lineInstances.hasOwnProperty(id)) { //this path doesn't exist
      lineInstances[id]=path;
      lineNextID++;
    }
  } else {  // length of line is too short
    removeLine(id);
  }
  return id;
}

function removeLine(id) {
  path.remove();
  if(lineInstances.hasOwnProperty(id))  // this path does exist
    delete lineInstances[id];
}

function doRecordAdd(action) {
  if(doRecordIndex >= doRecord.length)
    doRecord.push(action);
  else
    doRecord.splice(doRecordIndex,0,action);
  doRecordIndex++;
}

function onKeyDown(event) {
  if(event.key == 'control' || event.key == 'shift' || event.key == 'alt')
    return;
  console.log(event);
  console.log(event.key);
  if(event.key == 'z') {
    if(event.modifiers.control) {
      console.log("cntrlZ");
      if(event.modifiers.shift)
        redo();
      else
        undo();
    }
  }
}

function undo() {
    if(doRecord.length <= 0 || doRecordIndex === 0)
      return;  // nothing to undo
    console.log("doRecordIndex: " + doRecordIndex);
    doRecordIndex--;
    var last_do = doRecord[doRecordIndex];
    console.log("Undoing " + last_do.action + " which as pos:" + last_do.pos);
    var id = last_do.id;
    for(var i = doRecordIndex - 1; i >= 0; i--) {
      var prev_do = doRecord[i];
      console.log(i + " do is " + prev_do.action + " has pos:" + prev_do.pos);
      if(prev_do.id == id) {
        console.log("Found previous move");
        switch(last_do.action) {
          case 'pathMove':
            console.log("Obj pos1:",obj.firstSegment.point);
            console.log("Obj pos2:",obj.lastSegment.point);
            console.log("Obj pos:",obj.position);
            obj.firstSegment.point = prev_do.pos[0];
            obj.lastSegment.point = prev_do.pos[1];
            console.log("Return path to " + prev_do.pos);
            console.log("Obj pos1:",obj.firstSegment.point);
            console.log("Obj pos2:",obj.lastSegment.point);
            console.log("Obj pos:",obj.position);
            break;
          case 'imageMove':
            obj.position = prev_do.pos;
            console.log("Return img to " + prev_do.pos);
        }
        return;
      }
    }
    // nothing found, so assume can delete
    switch(last_do.action) {
      case 'pathMove':
        removeLine(lineInstance[last_do.id]);
        break;
      case 'imageMove':
        if(doRecordIndex > 0) {  // if this is a symbol then there should be a symbolPlace as previous do
          last_do = doRecord[doRecordIndex-1];
          if(last_do.action == 'symbolPlace') {
            console.log("Remove symbol from instances");
            symbolRemove(last_do.src, last_do.id);
            doRecordIndex--;
          }
        }
        break;
    }
}

function redo() {
  if(doRecordIndex >= doRecord.length)
    return;  // nothing to undo
  var to_do = doRecord[doRecordIndex];
  var obj;
  console.log("Redoing " + to_do.action);
  switch(to_do.action) {
    case 'pathMove':
      console.log(lineInstances.length);
      if(!lineInstances.hasOwnProperty(to_do.id)) {
        console.log("obj nolonger exists - remaking");
        newLine();
        lineSelected.add(to_do.pos[0]);
        lineSelected.add(to_do.pos[1]);
        var id = validatePath(lineSelected);
      } else {
        obj = lineInstances[to_do.id];
        obj.firstSegment.point = to_do.pos[0];
        obj.lastSegment.point = to_do.pos[1];
      }
      break;
    case 'imageMove':
      obj = lineInstances[to_do.id];
      obj.position = to_do.pos;
      break;
    case 'symbolPlace':
      symbolPlace(to_do.imageObject);
      break;
  }
  doRecordIndex++;
}
