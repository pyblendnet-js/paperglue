/*!
* paperglue.js v0.0.01 - Sandbox editor using Paper.js.
* See paper.ps
*
* Current features:
*   - click drag to create snap locked lines
*   - click ends or middle to drag line end or whole lines
*   - click on master image to clone and drag to locate clone
*   - right click and drag to make area then select action
*   - right click on images or areas for context menu and properties
*   - cntrl z to undo, cntrl shift z to redo, ctrl x to undeo forever
*   - cntrl s to save, cntrl o to open, cntrl shift x to prune do record
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

var editMode = true;
var modalOpen = false;
var keyFocus = true;
var nextID = 0;  // for keeping track of all objects with a unique id
var lineInstances = {};
var lineSelected = null;
var imageSelected = null;
var imageSelectedPositiion = null;
var lineSelectMode = 0;
var areaSelected = null;
var areaSelectMode = 0;
var areaInstances = {};
var areasVisible = false;
var areaColor = 'blue';
var newAreaColor = 'green';
var minAreaSide = 10;
var areaStrokeThickness = 2;
var snapRect = [5,5,10,10];   // offset x,y and then quantum x, y
var snapDefault = true;
var lineThickness = 3;
var lineColor = 'black';
var mouseDownPosition;
var rightButton = false;
var customDefaultProps = {};
var selectedItems = {};
var imagesLoaded = {};
var imageInstances = {};  //images that have been cloned from sybols in imagesLoaded.
var defaultContextMenu = [ {label:'view', callback:viewCall},{label:'open',callback:openCall} ];
var currentContextMenu = defaultContextMenu;
var currentContextObject = null;
var holdContext = false;  // don't reset contextMenu till after mouseUp
var doRecord = [];  // record of all clonings and moves  {action:string,src_id:src.id,raster:image or line:path,pos:point}
var doRecordIndex = 0;  // points to next do location
var recordPath = "recordSave.json";
var imgListPath = "imgList.json";
var cursorPos = [];  // mouse, raster, origin, center
var cursorColors = ['#f00','#ff0','#88f','#8f8'];
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

function getSnapDefault() {
  return snapDefault;
}

function toggleSnap() {
  var obj = currentContextObject.inst;
  console.log(Object.keys(obj));
  console.log("Toggle snap was:" + obj.snap);
  if(obj.hasOwnProperty('snap'))
    obj.snap = !obj.snap;
  else
    obj.snap = !snapDefault;
  if(currentContextObject.hasOwnProperty('raster'))
    obj.raster.position = snapPoint(obj.raster.position,!obj.snap);
  console.log("Toggle snap now:" + obj.snap);
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

// returns an array of keys matching search by for array or table of objects
function findKey(dict,search_by,search_key) {
  var keys = [];
  for(var i in dict) {
    console.log("i:"+i);
    var inst = dict[i];
    console.log("Inst:"+inst.hasOwnProperty(search_by));
    console.log("ByInst:"+inst[search_by]+" ?= "+search_key);
    if(inst[search_by] === search_key)
      keys.push(i);
  }
  return keys;
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

function drawCross(pos, size, color) {
  var s = size / 2;
  var p = new Path();
  p.strokeColor = color;
  p.strokeWidth = 2;
  p.add(new Point(pos.x-s, pos.y));
  p.add(new Point(pos.x+s, pos.y));
  p = new Path();
  p.strokeColor = color;
  p.strokeWidth = 2;
  p.add(new Point(pos.x, pos.y-s));
  p.add(new Point(pos.x, pos.y+s));
}

function init() {
// there may or maynot be an activeLayer when this code is run
  baseLayer = project.activeLayer;  //for some reason no layer exists yet
  cursorLayer = new Layer();
  // Couldn't figure out how to add setActiveLayer
  // if(typeof Project.setActiveLayer === 'undefined') {
  //   var setActiveLayer = function(l) {
  //     this._activeLayer = l;
  //   }
  //   console.log("Adding setActiveLayer to paper.js");
  //   Project.setActiveLayer = setActiveLayer;
  //  }
  //.. but this works
  project._activeLayer = baseLayer;
  //console.log("Layers&:"+project.layers);
  //console.log("ActiveLayer&:"+project.activeLayer);
}

function hideCursor() {
  cursorLayer.removeChildren();
  cursorLayer.position = [0,0];
  //console.log("cursorLayer:"+cursorLayer.position);
}

function showCursor(ci) {
  //console.log("Event:"+event);
  //console.log("Image mouse down at:"+mouseDownPosition);
  console.log("Show cursor#" + ci + " @pos:" + cursorPos[ci]);
  drawCross(cursorPos[ci],20,'#000');
  drawCross(cursorPos[ci]-[1,1],20,cursorColors[ci]);
}

function showImageCursors(obj,show_mouse_cursor) {
  hideCursor();
  project._activeLayer = cursorLayer;
  console.log("Show cursors:"+Object.keys(obj));
  var imgobj;
  if(obj.hasOwnProperty('id'))
    imgobj =obj;  // this is a image, possibly a master for clones
  else
    imgobj = obj.src;     // this is a clone from master symbol
  var raster = obj.raster;
  cursorPos[0] = mouseDownPosition;
  if(show_mouse_cursor)
    showCursor(0);
  cursorPos[1] = raster.position;
  showCursor(1);
  console.log("Show cursors:"+Object.keys(imgobj));
  if(imgobj.hasOwnProperty('center')) {
    cursorPos[2] = raster.position - imgobj.center.rotate(raster.rotation);
    showCursor(2);
  }
  if(imgobj.hasOwnProperty('origin')) {
    cursorPos[3] = raster.position - imgobj.origin.rotate(raster.rotation);
    showCursor(3);
  }
  project._activeLayer = baseLayer;
}

// onmousedown callback for images that are cloneable, dragable or have context menu
function imageMouseDown(event) {
  mouseDownPosition = event.point;
  hideArea();
  if(rightButtonCheck(event)) {  // this will set rightButton global
    //console.log("Right button down");
  }
  //console.log("ActiveLayer:"+project.activeLayer);
  console.log("image mouse down");
  // look to see if this object is the raster for one of the master images
  var id;
  var imgobj;
  var imkeys = Object.keys(imagesLoaded);
  console.log("Loaded images:"+imkeys);
  for(var i in imkeys) {
    id = imkeys[i];
    console.log("Check id:"+id);
    imgobj = imagesLoaded[id];

    if(this === imgobj.raster) {  //master image found
      console.log("Master image found");
      if(rightButton) {
        if(imgobj.hasOwnProperty('contextMenu')) {  // if not defined then stay with default
          console.log("Attaching image context menu");
          setContextMenu(imgobj.contextMenu);
          // currentContextObject object has some redundant info but seems simpler to use this way
          currentContextObject = {id:id,type:'symbol',inst:imgobj,src:imgobj,raster:imgobj.raster};  //to match image instance object
          selectItem(id,imgobj.raster);
          holdContext = true;  // cross browser solution to default mouse up reset
          showImageCursors(imgobj,true);
          return false;   // just show context menu now - see context menu callback below
        }
      }
      if(imgobj.hasOwnProperty('dragClone')) {  // if not defined then assume false
        if(imgobj.dragClone === true) {   // this image object can be dragged, so it should have isSymbol set true also
          //console.log("Symbol:" + imgobj.symbol);
          var inst = symbolPlace(imgobj.id);  //sets imageSelected to the new raster
          imageSelected.opacity = 0.5;
          imageSelected.position = imgobj.raster.position;
          imageSelectedPosition = null;  // so we can tell there was no prior position
          showImageCursors(inst,false);
        }
      }
      return false;  // master image found, so no need to look at clones in imageInstances
    }
  }
  // no master image found, so maybe this is a clone
  id = findImageInstance("raster",this);
  if(!!id) {
    console.log("Clone image found ID=" + id);
    imgobj = imageInstances[id];
    //if(this == imginst.raster) {  // clone image found
      src = imgobj.src;
      showImageCursors(imgobj,false);
      if(rightButton) {
        if(src.hasOwnProperty('instanceContextMenu')) {   // if not defined then stay with default
           setContextMenu(src.instanceContextMenu);
           // currentContextObject object has some redundant info but seems simpler to use this way
           // name may not be defined
           console.log("name:"+imgobj.name);
           currentContextObject = {id:id,type:'image',inst:imgobj,src:src,raster:this};
           selectItem(id,imgobj.raster);
           holdContext = true;  // cross browser solution to default mouse up reset
           return false; // clone image not selected for right click
        }
      }
      imageSelected = this;
      imageSelected.opacity = 0.5;
      imageSelectedPosition = this.position.clone();  // need to dereference
      return false;  //found so done looking
    //}
  }
}

// uses master image raster to create clone
// only use force_id for redo so that it uses old id
function symbolPlace(imgid, force_id) {
  var imgobj = imagesLoaded[imgid];
  console.log("Placing clone of:"+imgobj.id);
  imageSelected = imgobj.symbol.place();
  //imageSelected.scale(0.5);
  imageSelected.onMouseDown = imageMouseDown;
  var img_id;
  var inst;
  if(typeof force_id === 'undefined') {
    inst = {src:imgobj, raster:imageSelected};
    img_id = nextID;
    doRecordAdd({action:'symbolPlace',id:nextID,type:'image',src_id:imgobj.id});
    nextID += 1;
  } else {  // used by redo to accept old id - so need to record do action
    inst = {src:imgobj, raster:imageSelected};
    img_id = force_id;
    console.log("Forces instance is:"+inst);
  }
  imageInstances[img_id] = inst;
  imgobj.instances += 1;
  return inst;
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
function loadImages(images_to_load, custom_default_props) {
  if(typeof custom_default_props === 'undefined')
    custom_default_props = customDefaultProps;
  else
    customDefaultProps = custom_default_props;
  while(images_to_load.length > 0) {  // continue till empty - not sure if this is valid
    var imgobj = images_to_load.pop();
    imgobj.initialProp = Object.keys(imgobj);
    imagesLoaded[imgobj.id]= imgobj;  // record master images
    addImage(imgobj.src,imgobj.id);  // add image to document
    imgobj.raster = new Raster(imgobj.id);  // make this a paper image
    if(imgobj.hasOwnProperty('scale')) {
      imgobj.raster.scale(imgobj.scale);
    }
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
    var listen_to_mouse = imgobj.hasOwnProperty('contextMenu');
    if(imgobj.hasOwnProperty('dragClone')) {  // if not defined then assume false
      if(imgobj.dragClone === true)
        listen_to_mouse = true;
    }
    if(listen_to_mouse)
      imgobj.raster.onMouseDown = imageMouseDown;  // needed for drag or context
    var default_keys = Object.keys(custom_default_props);
    console.log("Image default props:"+default_keys);
    for(var di in default_keys) {
      dk = default_keys[di];
      if(!imgobj.hasOwnProperty(dk))
        imgobj[dk] = custom_default_props[dk];
    }
    imgobj.loadedProp = Object.keys(imgobj);
  }
}

function setContextMenu(context_type) {
  currentContextMenu = defaultContextMenu;
  if(window.globals.hasOwnProperty("menuLookup")) {
    var choices = window.globals.menuLookup;
    if(choices.hasOwnProperty(context_type))
      currentContextMenu = window.globals.menuLookup[context_type];
  }
  console.log("Context menu:"+currentContextMenu);
}

function nameCurrentImage(name) {
  var id = currentContextObject.id;
  nameImage(name,id);
}

function nameImage(name,id) {
  var imgobj = imageInstances[id];
  console.log("ID:"+id);
  if(name === id) {
    if(imgobj.hasOwnProperty('name'))
      delete imgobj.name;
  } else {
    imgobj.name = name;
    console.log("Image renamed:"+imgobj.name);
  }
}

window.contextMenuCallback = function(menu_index){
  console.log('context menu call for item:' + menu_index);
  if(currentContextMenu !== null) {
    var menu_item = currentContextMenu[menu_index];
    if(menu_item.hasOwnProperty('callback')) {
      var callback = menu_item.callback;
      if(typeof callback == 'function') {
        if(callback())
          hideCursor();
      }
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
  if(modalOpen)
    return false;
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
  currentContextTable = tbl;
  loadCurrentContextMenu(tbl);
}

function loadCurrentContextMenu(tbl) {
  tbl.innerHTML = "";
  //console.log("window width:"+window.innerWidth);
  //console.log("window height:"+window.innerHeight);
  var fontsize = window.innerWidth/80;
  for(var mi in currentContextMenu) {
    var m = currentContextMenu[mi];
    //console.log(m);
    var txt = m.label;
    if(m.hasOwnProperty('propCall')) {
      //console.log("Has propCall");
      if(typeof m.propCall == 'function') {
        //console.log("Has propCall as function");
        txt += " " + m.propCall(currentContextObject);
      }
    }
    tbl.innerHTML += '<tr><td style="padding:0;"><div style="font-size:'+fontsize+'px;" class="ContextItem" onmouseup="contextMenuCallback(' + mi + ')" >' + txt + '</div></td></tr>';
  }
}

function hideContextMenu(control) {
  var el = document.getElementById(control);
  el.style.display = 'none';
  var tbl = el.children[0];  //assumes menu has table as first
  tbl.innerHTML = "";
  currentContextMenu = defaultContextMenu;
  //cursorPos[0] = currentContextObject.raster.position;
  //hideCursor();
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
  if(modalOpen)
    return false;
  mouseDownPosition = event.point;
  hideArea();
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
  return false;
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

function newArea() {
  console.log("Start new area path");
  areaSelected = new Path();
  areaSelected.strokeColor = newAreaColor;
  areaSelected.strokeWidth = areaStrokeThickness;
  areaSelected.strokeCap = 'butt';
  areaSelected.strokeJoin = 'mitre';
  areaSelected.dashArray = [6,6];
  //areaSelected.onMouseDown = lineMouseDown;  // the call to use for mod
  areaSelectMode = 0;  // drag last point
}

function hideArea() {
  if(!!areaSelected) {
    // if(areasVisible) {
    //   areaSelected.strokeColor = areaColor;
    // } else {
      areaSelected.remove();
    //}
  }
  areaSelected = null;
}

function getAreaCount() {
  return Object.keys(areaInstances).length;
}

function setArea() {
  var rect = new Rectangle(roundPoint(areaSelected.segments[0].point),
                           roundPoint(areaSelected.segments[2].point));
  areaInstances[nextID] = {rect:rect};
  doRecordAdd({action:'setArea',id:nextID,type:'area',rect:rect });
  if(areasVisible)
    showArea(nextID);
  nextID++;
  hideArea();
}

function nameCurrentArea(name) {
  var id = currentContextObject.id;
  var a = areaInstances[id];
  //console.log("id:"+id+" name:"+name);
  //console.log("Current name:"+a.name);
  var oldname = id;
  if(a.hasOwnProperty('name')) {
    if(name === a.name)
      return;  // nothing to do
    oldname = a.name;
  }
  doRecordAdd({action:'rename',id:id,type:'area',oldName:oldname,newName:name});
  nameArea(name,id);
}

function nameArea(name,id) {
  var a = areaInstances[id];
  if(name === id) {
    if(a.hasOwnProperty('name'))
      delete a.name;
  } else {
    a.name = name;
  }
  console.log("Props:"+Object.keys(a));
  if(a.hasOwnProperty('text')) {
    showAreaText(a,id);
  }
}

function moveCurrentArea(rect) {
  var id = currentContextObject.id;
  var a = areaInstances[id];
  if(a.rect.x === rect.x && a.rect.y === rect.y &&
     a.rect.width === rect.width && a.rect.height === rect.height) {
    return;  // nothing to do
  }
  doRecordAdd({action:'move',id:id,type:'area',oldRect:a.rect,newRect:rect});
  moveArea(rect,id);
}

function moveArea(rect,id) {
  var a = areaInstances[id];
  a.rect = rect;
  showArea(currentContextObject.id);
}

function removeAreaInstance(id, record) {
  if(areaInstances.hasOwnProperty(id)) {  // this path does exist
    var a = areaInstances[id];
    removeAreaPath(a);
    if(record) {
      // note: name may not be defined
      doRecordAdd({action:'areaDelete',id:id,rect:a.rect,name:a.name});
    }
    delete areaInstances[id];  // removes from list

  }
}

function removeAreaPath(a) {
    console.log("Removing:"+a.rect);
    if(a.hasOwnProperty('path')) {
      a.path.remove();  // should remove from screen
      delete a.path;
    }
    if(a.hasOwnProperty('text')) {
      a.text.remove();
      delete a.text;
    }
}

function showArea(id) {
  // assumes path and text do not exist
  var a = areaInstances[id];
  var rect = a.rect;
  console.log("Rect:"+rect);
  if(!a.hasOwnProperty('path')) {
    var path = new Path();
    a.path = path;
  }
  a.path.strokeColor = areaColor;
  a.path.strokeWidth = areaStrokeThickness;
  a.path.strokeCap = 'butt';
  a.path.strokeJoin = 'mitre';
  a.path.dashArray = [6,6];
  a.path.clear();
  a.path.add(rect.topLeft);
  a.path.add(rect.topRight);
  a.path.add(rect.bottomRight);
  a.path.add(rect.bottomLeft);
  a.path.closed = true;
  showAreaText(a,id);
}

function showAreaText(a,id) {
  if(a.hasOwnProperty('text'))
    a.text.remove();
  var text = new PointText();
  a.text = text;
  a.text.point = a.rect.topLeft + [20,20,];
  if(a.hasOwnProperty('name'))
    a.text.content = a.name;
  else
    a.text.content = id;
  a.text.justification = 'center';
  a.text.fontSize = 15;
  a.text.fillColor = areaColor;
}

function showAllAreas() {
  areasVisible = true;
  var aks = Object.keys(areaInstances);
  for(var ai in aks) {
    var id = aks[ai];
    console.log("Show area#" + id);
    showArea(id);
  }
}

function hideAllAreas() {
  var aks = Object.keys(areaInstances);
  for(var ai in aks) {
    removeAreaPath(areaInstances[aks[ai]]);
  }
  areasVisible = false;
}

function hitTestArea(id,hit_point) {
  var rect = areaInstances[id].rect;
  //console.log("Is "+hit_point + " in " + rect + " = " +rect.contains(hit_point));
  return rect.contains(hit_point);
}

function hitTestAreas(hit_point) {
  var aks = Object.keys(areaInstances);
  for(var ai in aks) {
    var id = aks[ai];
    //console.log("Hit test area#" + id);
    if(hitTestArea(id,hit_point)) {
      console.log("Hit test area#" + id);
      return id;
    }
  }
  return null;
}

function selectItem(id,item) {
  var d = new Date();
  var nowMs = d.getTime();
  var controlPressed = ((nowMs - controlPressMs) < modPressDelay);
  if(!controlPressed) {   //if control pressed then do not clear previous
    var sk = Object.keys(selectedItems);
    for(var si in sk) {
      selectedItems[sk[si]].selected = false;
    }
    selectedItems = {};  // leaves the problem for the garbage collector
  }
  selectedItems[id] = item;
  item.selected = true;
}

// onmousedown callback for two point paths
function lineMouseDown(event) {
  console.log("Line mouse down");
  if(modalOpen)
    return;
  mouseDownPosition = event.point;
  if(rightButtonCheck(event)) {
    console.log("Right button down");
    var ids = findKey(lineInstances,'line',this);
    if(ids.length > 0)
      selectItem(ids[0],this);
    if(globals.hasOwnProperty('lineContextMenu')) {
      currentContextMenu = globals.lineContextMenu;
      holdContext = true;  // cross browser solution to default mouse up reset
    } else
      currentContextMenu = defaultContextMenu;
    return false;
  }
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
  if(modalOpen)
    return;
  if(rightButton) {
    var v = event.point - mouseDownPosition;
    if(Math.abs(v.x) > minAreaSide && Math.abs(v.y) > minAreaSide) {
      if(!areaSelected) {
        newArea();
        setContextMenu("newAreaMenu");
      }
      switch(areaSelectMode) {  //chosen in onlinemousedown
        case 0: //move last point
          if(areaSelected.segments.length < 4) {
            areaSelected.add(mouseDownPosition);
            areaSelected.add(mouseDownPosition);
            areaSelected.add(mouseDownPosition);
            areaSelected.add(mouseDownPosition);
            areaSelected.closed = true;
            areaSelectedPosition = null;  // to indicate it is new
          }
          areaSelected.segments[2].point += event.delta;
          areaSelected.segments[1].point.y = areaSelected.segments[2].point.y;
          areaSelected.segments[3].point.x = areaSelected.segments[2].point.x;
          break;
        case 1:
          break;
      }
    }
    return;
  }
  if(!!imageSelected) {   // drag image
    imageSelected.position += event.delta;
    cursorLayer.position += event.delta;
  } else {
    if(!lineSelected) //no line selected yet
      newLine();  // create new line
    if(!!lineSelected) {   // link selected so drag existing
      //console.log("Link selected");
      switch(lineSelectMode) {  //chosen in onlinemousedown
        case 0: //move last point
          if(lineSelected.segments.length < 2) {
            lineSelected.add(event.point - event.delta);
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
    }
  }
  return false;
}

function roundPoint(p) {
  return new Point(Math.round(p.x),Math.round(p.y));
}

function snapPoint(p,round_only) {
  var p2;
  if(round_only) {
    p2 = new Point(Math.round(p.x),Math.round(p.y));
  } else {
    p2 = new Point(
    Math.round((p.x-snapRect[0])/snapRect[2]) * snapRect[2] +snapRect[0],
    Math.round((p.y-snapRect[1])/snapRect[3]) * snapRect[3] +snapRect[1]);
  }
  //console.log("Snap delta:" + (p2 - p));
  return p2;
}

// snaps both ends of the line path to grid quantum
function snapLine(p,round_only) {
  if(typeof p.firstSegment === 'undefined')
    return;
  //console.log("Before:" + p.firstSegment.point);
  //console.log("Snap Rect:" + snapRect);
  p.firstSegment.point = snapPoint(p.firstSegment.point,round_only);
  //console.log("After:" + p.firstSegment.point);
  p.lastSegment.point = snapPoint(p.lastSegment.point,round_only);
  var dx = p.firstSegment.point.x - p.lastSegment.point.x;
  var dy = p.firstSegment.point.y - p.lastSegment.point.y;
  return((dx !== 0) || (dy !== 0));
}

// universal mouse up handler - mainly just tidy up
function onMouseUp(event) {
  console.log("Mouse up");
  if(modalOpen)
    return;
  if(editMode) {
  if(!!imageSelected) {
    console.log("Opacity was:" + imageSelected.opacity);
    imageSelected.opacity = 1.0;
  }
  if(rightButton) {
    if(!imageSelected && !lineSelected) {
      var id = hitTestAreas(mouseDownPosition);
      if(!!id) {
        var a = areaInstances[id];
        currentContextObject = {id:id,type:'area',inst:a};  //to match image instance object
        if(a.hasOwnProperty('path'))
          selectItem(id,a.path);
        setContextMenu("areaMenu");
      }
    }
    rightButton = false;
    imageSelected = null;
    return;
  }
  if(!!lineSelected) {
    // for undo it will be necessary to look for previous position if any
    // point needs to be cloned to dereference
    line_id = validatePath(lineSelected);
    if(!line_id)
      hitTestAreas(mouseDownPosition);
    lineSelected = null;
    // continue through to path addition or removal
  } else if(!!imageSelected) {
    hideCursor();
    var img_id = findImageInstance('raster',imageSelected);
    if(!!img_id) {  // shouldn't be any trouble here
      console.log("instance found with id:"+img_id);  // need to keep id as well - might be null for master objects in layout mode
      var round_only = !snapDefault;
      if(img_id !== null) {
        var inst = imageInstances[img_id];
        if(inst.hasOwnProperty('snap'))
          round_only = !inst.snap;
      }
      var src = imageInstances[img_id].src;
      if(imageSelected.position == imageSelectedPosition) { // no movement or no prior position it being null
        rotateImage(img_id,imageSelected,src,90);
        correctPosition(imageSelected,src,round_only);
      } else {
        correctPosition(imageSelected,src,round_only);
        // keeping the obj as record is fine for undo but not so good for redo if the object gets deleted further back
        doRecordAdd({action:'imageMove',id:img_id,type:'image',pos:[imageSelectedPosition,imageSelected.position]});
      }
    }
    imageSelected = null;
  } else {
    hitTestAreas(mouseDownPosition); //also called if line validate fails
  }
  } else {  // not edit mode
    var hit_id = hitTestAreas(mouseDownPosition);
    if(!!hit_id) {
      if(typeof window.globals.hitCallback === 'function')
        window.globals.hitCallback(hit_id);
    }
  }
}

function correctPosition(raster,src,round_only) {
  // snaps and rounds image postion raster
  console.log("Before:"+raster.position);
  if(src.hasOwnProperty('origin')) {
    var oo = src.origin.rotate(raster.rotation);
    raster.position = snapPoint(raster.position-oo,round_only) + oo;
  } else {
    raster.position = snapPoint(raster.position,round_only);
  }
  console.log("After snap:"+raster.position);
  raster.position = roundPoint(raster.position);
  console.log("After round:"+raster.position);
}

function rotateImage(id,raster,src,angle) {
  var dorec = {action:'imageRotate',id:id,type:'image'};
  // use mouseDownPosition or event.position to find the closest point of rotation in object
  var rotation = Math.round(raster.rotation);
  if(src.hasOwnProperty('center')) {
    var prev_pos = raster.position;
    raster.rotate(angle,raster.position-src.center.rotate(raster.rotation));  //(new Point(30,30)));  // need to look up source to find centre of rotation - could also have 45 deg mode
    dorec.pos = [prev_pos,raster.position];
  } else
    raster.rotate(angle);  // need to look up source to find centre of rotation - could also have 45 deg mode
  raster.rotation = Math.round(raster.rotation);  // prevent error creaping in
  dorec.rot = [rotation,raster.rotation];
  doRecordAdd(dorec);
}

function moveCurrentImage(x,y,r) {
  var im = currentContextObject.raster;
  console.log("Move from pos:"+im.position+" to "+x+","+y+","+r);
  var p = new Point(x,y);
  if(x !== im.position.x || y !== im.position.y) {
    //console.log(p);
    doRecordAdd({action:'imageMove',id:currentContextObject.id,type:'image',pos:[im.position,p]});
    //console.log(doRecord[doRecordIndex-1].pos);
    im.position = p;
  }
  if(r !== im.rotation) {
    rotateImage(currentContextObject.id,im,currentContextObject.src,r-im.rotation);
    // var rot = Math.round(r);
    // doRecordAdd({action:'imageRotate',id:currentContextObject.id,type:'image',rot:[im.rotation,rot],});
    // im.rotation = rot;
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
  //console.log("Path length:" + path.length);
  var round_only = !snapDefault;
  if(line_id !== null) {
    var inst = lineInstances[line_id];
    if(inst.hasOwnProperty('snap'))
      round_only = !inst.snap;
  }
  if(snapLine(path,round_only)) {
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
    console.log("Zero length line");
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
  if(modalOpen) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
  if(!keyFocus) {
    //console.log("Paper  glue ignoring keys");
    return false;
  }
  var d = new Date();
  var nowMs = d.getTime();
  if(event.key == 'control' || event.key == 'shift' || event.key == 'alt') {
    //console.log("Modifier pressed:"+event.key+" at "+nowMs);
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
    return false;
  }
  event.controlPressed = ((nowMs - controlPressMs) < modPressDelay) || event.modifiers.control;
  event.shiftPressed = ((nowMs - shiftPressMs) < modPressDelay) || event.modifiers.shift;
  event.altPressed = ((nowMs - altPressMs) < modPressDelay) || event.modifiers.alt;
  //console.log("Now:"+nowMs+" "+modPressDelay);
  //console.log("Now:"+(nowMs - controlPressMs));
  //console.log("Paperglue received:" + event.key);
  //console.log("Window keys:" + Object.keys(window));
  var propagate = true;
  var delta = null;  // for arrow keys
  if(event.controlPressed) {
    switch(event.key) {
      case 'z':
        console.log("cntrlZ");
        if(event.shiftPressed) {
          redo();
        } else {
          undo();
        }
        propagate = false;
        break;
      case 'x':
        console.log("cntrlX");
        if(event.shiftPressed) {  // prune unnecessary edits
          if(confirm("Remove events with no end effect?")) {
            doRecord = pruneDo();
            doRecordIndex = doRecord.length;
          }
        } else {  // undo and remove that particular redo
          undo();
          doRecord.splice(doRecordIndex,1);
        }
        propagate = false;
        break;
      case 's':
        console.log("cntrlS");
        if(event.shiftPressed) {  // save as
        } else {
          save();
        }
        propagate = false;
        break;
      case 'o':
        console.log("cntrlO");
        if(confirm("Do you want to load from storage?"))
        { if(event.shiftPressed) {  // load from

          } else {
            load();
          }
        }
        propagate = false;
        break;
      case 'left':
        delta = [-1,0];
        break;
      case 'right':
        delta = [1,0];
        break;
      case 'up':
        delta = [0,-1];
        break;
      case 'down':
        delta = [0,1];
        break;
    }
    if(!!delta) {
      moveObject(currentContextObject,delta,!event.shiftPressed);
      propagate = false;
      loadCurrentContextMenu(currentContextTable);
    }
  } else {
    switch(event.key) {
      case 'delete':
        var id = currentContextObject.id;
        switch(currentContextObject.type) {
          case 'symbol':
            removeImage(id,true);
            break;
          case 'area':
            removeAreaInstance(id,true);
            break;
        }
        propagate = false;
        hideContextMenu('contextMenu');
        hideCursor();
        break;
      case 'escape':
        hideContextMenu('contextMenu');
        hideCursor();
        break;
    }
  }
  if(propagate && (typeof globals.keyhandler == 'function')) {
    console.log("Passing key upwards");
    propagate = globals.keyhandler(event);
  } else {
    event.preventDefault();
    event.stopPropagation();
  }
  return propagate;
}

function moveObject(obj,direction,snap) {
  objPosition = obj.raster.position;
  if(snap) {
    obj.raster.position += [direction[0]*snapRect[2],direction[1]*snapRect[3]];
    var img_id = findImageInstance('raster',obj.raster);
    if(!!img_id) {
      console.log("instance found with id:"+img_id);  // need to keep id as well - might be null for master objects in layout mode
      //var src = imageInstances[img_id].src;  // could have used obj.src
      var round_only = !snapDefault;
      if(img_id !== null) {
        var inst = lineInstances[img_id];
        if(inst.hasOwnProperty('snap'))
          round_only = !inst.snap;
      }
      correctPosition(obj.raster,obj.src,round_only);
      doRecordAdd({action:'imageMove',id:img_id,type:'image',pos:[objPosition,obj.position]});
    }
  } else {
    obj.raster.position += direction;
  }
  console.log("Object moved to:"+obj.raster.position);
  // if(typeof window.globals.updateStatus === 'function')
  //   window.globals.updateStatus();
}

function save() {
  var dolist = doRecord;  //pruneDo();
  console.log("Try to save");
  console.log("Globals:" + Object.keys(window.globals));
  console.log("SendData:",typeof window.globals.sendData);
  // build reduced image list
  var img_list = [];
  console.log("Type:"+(typeof img_list));
  var img_ids = Object.keys(imagesLoaded);
  for(var ii in img_ids) {
    var im = imagesLoaded[img_ids[ii]];
    var img = {};
    var img_keys = Object.keys(im);
    console.log("Image keys:"+img_keys);
    console.log("Initials keys:"+im.initialProp);
    console.log("Loaded keys:"+im.loadedProp);

    for(var iik in img_keys) {
      var ik = img_keys[iik];
      if(ik === 'loadedProp')
        continue;
      console.log(ik);
      console.log("Loaded:"+im.loadedProp.indexOf(ik));
      console.log("Initial:"+im.initialProp.indexOf(ik));
      if((im.loadedProp.indexOf(ik) < 0) || (im.initialProp.indexOf(ik) >= 0))
        img[ik] = im[ik];
    }
    console.log("Img:"+Object.keys(img));
    img_list.push(img);
    console.log("ImgList#:"+img_list);
  }
  console.log("ImgList:"+img_list);
  var project_data = {imglist:img_list,dolist:doRecord};
  console.log("project data:"+Object.keys(project_data));
  console.log("project data:"+Object.keys(project_data.imglist[0]));
  var jdata = JSON.stringify(project_data);
  console.log("jdata:"+jdata);
  console.log("project data imglist[0]:"+Object.keys(project_data.imglist[0]));
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
    //try {
      console.log("Data="+jdata);
      var project_data = JSON.parse(jdata);
      // console.log("New record="+newRecord);
      // console.log(typeof newRecord);
      // console.log("New record has" + newRecord.length + " actions");
      removeAll();
      imglist = project_data.imglist;
      // add any images not already loaded - does not check date
      img_keys = Object.keys(imglist);
      var imgs_to_load = [];
      for(var ii in img_keys) {
        var ik = img_keys[ii];
        if(imagesLoaded.hasOwnProperty(ik))
          continue;
        imgs_to_load.push(imglist[img_keys]);
      }
      loadImages(imgs_to_load);  //will use previously set defaults
      doRecord = project_data.dolist;
      correctPosPoints(doRecord);
      doRecordIndex = 0;
      doAll();
    // } catch(e2) {
    //   console.log("Error parsing file data"+e2);
    // }
}

function correctPosPoints(do_record) {
  for(var di in do_record) {
    var to_do = do_record[di];
    if(to_do.hasOwnProperty('pos')) {
      console.log("Fix pos");
      fixPos(to_do.pos);  // check for paper.js object JSON conversion problems
    }
    else if(to_do.hasOwnProperty('rect')) {
      console.log("Fix rect");
      to_do.rect = parseRect(to_do.rect);  // check for paper.js object JSON conversion problems
    }
    else if(to_do.hasOwnProperty('size')) {
      console.log("Fix size");
      to_do.size = parseRect(to_do.size);  // check for paper.js object JSON conversion problems
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

function parseRect(ord) {
  console.log(ord[0]);  // will be undefined for a real point
  if(ord[0] === 'Rectangle')
    return new Rectangle(ord[1],ord[2],ord[3],ord[4]);
  else
    return ord;  // no change
}

function parseSize(ord) {
  console.log(ord[0]);  // will be undefined for a real point
  if(ord[0] === 'Size')
    return new Size(ord[1],ord[2]);
  else
    return ord;  // no change
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
  if(confirm("Do you want to clear current workspace?"))
  { removeLines();
    removeSymbols();
    doRecord = [];
    doRecordIndex = 0;
  }
}

function removeImage(obj,record) {
  if(!obj)
    return;
  var img_id = findImageInstance('raster',obj.raster);
  if(!!img_id) {
    if(!record || confirm("Do you really want to remove object ID =" + img_id + "?")) {
      symbolRemove(img_id);
      if(record)
        doRecordAdd({action:'symbolDelete',id:img_id,src_id:obj.src.id,pos:obj.raster.position,rot:obj.raster.rotation});
      return true;
    }
  }
  return false;
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
        //console.log(lineInstances[0]);
        //console.log("line instances:" + (lineInstances.length));

        //console.log("line instances:" + (Object.keys(lineInstances)));
        //console.log("line instances:" + Object.keys(lineInstances).indexOf(String(last_do.id)));
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
            console.log("Attempting to remove instance of " + prev_do.src_id + " with " + prev_do.id);
            symbolRemove(prev_do.id);
            doRecordIndex--;  // skip back over symbol places too
            break;
          }
        }
        if(typeof last_do.pos != 'undefined'){  // check it has a pos
          raster.position = last_do.pos[0];
          console.log("Return img position to " + last_do.pos);
        }
        break;
      case 'imageRotate':
        raster = imageInstances[last_do.id].raster;
        if(typeof last_do.pos != 'undefined'){  // check it has a pos
          raster.position = last_do.pos[0];  // required for non centered rotation
        }
        if(typeof last_do.rot != 'undefined'){  // check it has a rot
          if(!last_do.rot[0]) {
            raster.rotation = 0;
            console.log("Raster rot:"+ raster.rotation);
          } else {
            raster.rotation = last_do.rot[0];
            console.log("Return img rotation to " + last_do.rot[0]);
          }
        }
        break;
      case 'symbolDelete':
        console.log("replace image:" + last_do.id);
        symbolPlace(last_do.src_id,last_do.id);
        raster = imageInstances[last_do.id].raster;
        raster.position = last_do.pos;
        raster.rotation = last_do.rot;
        break;
      case 'setArea':
        removeAreaInstance(last_do.id,false);
        break;
      case 'rename':
        if(last_do.type === 'area')
          nameArea(last_do.oldName,last_do.id);
        else
          nameImage(last_do.oldName,last_do.id);
        break;
      case 'move':
        if(last_do.type === 'area')
          moveArea(last_do.oldRect,last_do.id);
        break;
      case 'areaDelete':
        areaInstances[last_do.id] = {rect:last_do.rect};
        if(typeof last_do.name !== 'undefined')
          areaInstances[last_do.id] = last_do.name;
        if(areasVisible)
          showArea(last_do.id);
    }
}

function redo() {
  console.log("Redo");
  if(doRecordIndex >= doRecord.length)
    return false;  // nothing to undo
  var to_do = doRecord[doRecordIndex];
  //console.log(Object.keys(to_do));
  console.log("Redoing " + to_do.action);
  var raster;
  var imgobj;
  switch(to_do.action) {
    case 'lineMove':
      console.log(Object.keys(lineInstances).length);
      if(!lineInstances.hasOwnProperty(to_do.id)) {
        console.log("path id " + to_do.id + " nolonger exists - remaking");
        newLine();
        //console.log(to_do.pos[1]);
        lineSelected.add(to_do.pos[1][0]);
        lineSelected.add(to_do.pos[1][1]);
        //console.line("line:" + lineSelected);
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
      imgobj = imageInstances[to_do.id];
      raster = imgobj.raster;
      raster.position = to_do.pos[1];
      break;
    case 'imageRotate':
      imgobj = imageInstances[to_do.id];
      raster = imgobj.raster;
      if(to_do.hasOwnProperty('pos'))
        raster.position = to_do.pos[1];  // required if rotation not about center
      raster.rotation = to_do.rot[1];
      break;
    case 'symbolPlace':
      symbolPlace(to_do.src_id,to_do.id);
      imageSelected = null;
      // this is normally followed by a drag move, so do this too
      to_do = doRecord[doRecordIndex+1];
      if(to_do.action == 'imageMove') {
        doRecordIndex++;
        raster = imageInstances[to_do.id].raster;
        raster.position = to_do.pos[1];
      }
      break;
    case 'symbolDelete':
      var inst = imageInstances[to_do.id];
      removeImage(inst,false);   // delete is already in records
      break;
    case 'setArea':
      areaInstances[to_do.id] = {rect:to_do.rect};
      if(areasVisible)
        showArea(to_do.id);
      break;
    case 'rename':
      if(to_do.type === 'area')
        nameArea(to_do.newName,to_do.id);
      else
        nameImage(to_do.newName,to_do.id);
      break;
    case 'move':
      if(to_do.type === 'area')
        moveArea(to_do.newRect,to_do.id);
      break;
    case 'areaDelete':
      removeAreaInstance(to_do.id,false);
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
    console.log("ids found:"+ids_found);
    console.log(ids_found.indexOf(String(to_do.id)));
    //console.log(typeof to_do.id);
    //if(ids_found.length > 0)
    console.log(typeof ids_found[0]);
    if(ids_found.indexOf(String(to_do.id))>= 0) // this object already sorted
      continue;
    ids_found.push(to_do.id);  // this object covered one way or other - NOTE: push will convert everything to string without the + prefix but indexof only works with Strings
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
          console.log("  Checking #"+dj+" willdo action:"+will_do.action+" for "+will_do.id);
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
            console.log("Pruned adding:"+will_do.action + " from index:"+dj);
            if(will_do.action == 'symbolPlace')
              break; // all done
          }
        }
        break;
      case 'symbolDelete':
        // no need to keep this in pruned
        break;
      // only the last of these for an id are required
      case 'rename':
      case 'move':
        if(to_do.type === 'area') {
          if(areaInstances.hasOwnProperty(to_do.id))
            break;  //nolonger exists
        } else {  // images can also be renamed
          if(imageInstances.hasOwnProperty(to_do.id))
            break;  // nolonger exists
        }
        prunedDo.splice(0,0,to_do);
        break;
      case 'setArea':
        if(areaInstances.hasOwnProperty(to_do.id))
          break;  //nolonger exists
        prunedDo.splice(0,0,to_do);
        break;
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
  return currentContextObject;  // remeber this is not an instance - contains id into instance
}

function setCenterToCursor() {
  if(currentContextObject.hasOwnProperty('src')) {
    var src = currentContextObject.src;
    if(currentContextObject.hasOwnProperty('raster')) {
      var raster = currentContextObject.raster;
      var dp = raster.position - cursorPos[0];
      src.center = roundPoint(dp.rotate(-raster.rotation));
      cursorPos[2] = cursorPos[0];
      console.log("Center:" + src.center);
      if(!src.hasOwnProperty('origin'))   // probably the same if not set
        src.origin = src.center;
    }
  }
  hideCursor();
}

function setOriginToCursor() {
  if(currentContextObject.hasOwnProperty('src')) {
    var src = currentContextObject.src;
    if(currentContextObject.hasOwnProperty('raster')) {
      var raster = currentContextObject.raster;
      var dp = raster.position - cursorPos[0];
      src.origin = roundPoint(dp.rotate(-raster.rotation));
      cursorPos[3] = cursorPos[0];
      console.log("Origin:" + src.origin);
      if(!src.hasOwnProperty('center'))  // probably the same if not set
        src.center = src.origin;
    }
  }
  hideCursor();
}

function enableKeyFocus(state) {
  // disable to allow dialog field input
  keyFocus = state;
  //console.log("PaperGlue keyfocus:"+  keyFocus);
}

function setEditMode(state) {
  editMode = state;
}

function setModalOpen(state) {
  modalOpen = state;
}

// think this needs to be at the bottom so under scripts find things fully loaded
console.log("PaperGlue functions to window globals");
// window global are use for cross scope communications
var globals = window.globals;
var exports = {
  init:init,
  loadImages:loadImages,
  getImages:getImageInstances,
  getLines:getLineInstances,
  getDoRecord:getDoRecord,
  setSnap:setSnap,
  setLineThickness:setLineThickness,
  setLineColor:setLineColor,
  keyHandler:null,
  enableKeyFocus:enableKeyFocus,
  removeAll:removeAll,
  getCurrentContextObject:getCurrentContextObject,
  nameCurrentImage:nameCurrentImage,
  moveCurrentImage:moveCurrentImage,
  setCenterToCursor:setCenterToCursor,
  setOriginToCursor:setOriginToCursor,
  showCursor:showCursor,
  hideCursor:hideCursor,
  showImageCursors:showImageCursors,
  getSnapDefault:getSnapDefault,
  toggleSnap:toggleSnap,
  getAreaCount:getAreaCount,
  setArea:setArea,
  showAreas:showAllAreas,
  hideAreas:hideAllAreas,
  changeAreaName:nameCurrentArea,
  moveCurrentArea:moveCurrentArea,
  setEditMode:setEditMode,  // change this to false for application
  setModalOpen:setModalOpen
};
globals.paperGlue = exports;

if(typeof globals.onPaperGlueLoad == 'function')  { // myScript couldn't find loadImages so provided a call to repeat the request
  console.log("PaperGlue loaded now so can use onPaperLoad to load images.");
  console.log(typeof globals.loadImages);
  globals.onPaperGlueLoad();
}
// that was a bit messy and my be avoided if I used requirejs or browserify - though I suspect that paper.js will not like it.
