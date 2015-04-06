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

console.log("Loading paperGlue");
// includes
var globals = window.globals;
var myScript = window.globals.myScript;
var nodeComms = window.globals.nodeComms;
// see exports at bottom for public functions
//note:objects here are all somewhere within the paper scope
// To make visibile to window, declare as window.object

var body;  // cached in init()
var editMode = true;
var modalOpen = false;
var mouseDownHandled = false;  // prevent propogation to onMouseDown
var selectDist = 10;  // how close to a line for right click select closest
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
var defaultLineColor = 'black';
var lineColor = 'black';
var mouseDownPosition;
var rightButton = false;
var customDefaultProps = {};
var selectedItems = {};
var selectedPos = {};  // for prev pos following are move
var selectedMove = false;
var imagesLoaded = {};
var imageInstances = {};  //images that have been cloned from sybols in imagesLoaded.
var fileContextMenu = [
  {label:'open from',callback:loadRecordAs},
  {label:'save as',callback:saveRecordAs}
];  // must appear before use in default menu
if(window.location.protocol === 'file:') {
  fileContextMenu.push({label:'open doRecord', callback:loadRecord});
  fileContextMenu.push({label:'save doRecord', callback:saveRecord});
} else {
  fileContextMenu.push({label:'open doRecord.pgl', callback:loadRecord});
  fileContextMenu.push({label:'save doRecord.pgl', callback:saveRecord});
  fileContextMenu.push({label:'save imgAvail.js',callback:buildImgAvail});
}
fileContextMenu.push({label:'new',callback:removeAll });

var exportMenu = [
  {label:'  js as doRec.js',callback:saveDoRec},
];
var importMenu = [
  {label:'import dorec.js',callback:loadDoRec},
];
var stateMenu = [];

var optionsContextMenu = [{label:'hide areas',callback:toggleAreas}];
var defaultContextMenu = [
  {label:'image', callback:loadImage},
  {label:'file', submenu:fileContextMenu},
  {label:'export', submenu:exportMenu},
  {label:'import', submenu:importMenu},
  {label:'state', submenu:stateMenu},
  {label:'options', submenu:optionsContextMenu}
];

var currentContextMenu = defaultContextMenu;
var currentContextObject = null;
var holdContext = false;  // don't reset contextMenu till after mouseUp
var doRecord = [];  // record of all clonings and moves  {action:string,src_id:src.id,raster:image or line:path,pos:point}
var doRecordIndex = 0;  // points to next do location
var recordPath = "recordSave.pgl";  //default save path for node server
var relativePath = "";
var postObject;
var listObjective;
var listXtns;
var imageExtensions = "jpg,png";
var importDefaults = {scale:1.0,isSymbol:true, dragClone:true, pos:view.center};
var baseImportDefaults = cloneShallow(importDefaults);
var cursorPos = [];  // mouse, raster, origin, center
var cursorImage = null;  // to allow cursor hide in selectItem
var cursorColors = ['#f00','#ff0','#88f','#8f8'];
var stateInstances = {};
var currentStateRate = 0.0;  // immediate jumps to state

function cloneShallow(obj) {
  var ro = {};
  for(var i in obj)
    ro[i] = obj[i];
  return ro;
}

// assumes for the moment that each menu item has a unique label
function findMenu(m,base) {
  if(typeof base === 'undefined')
    base = defaultContextMenu;
  for(var i in base) {
    var mi = base[i];
    if(mi.hasOwnProperty('submenu')) {
      if(mi.label === m)
        return base[i].submenu;
      var rv = findMenu(m,mi.submenu);
      if(!!rv)
        return rv;
    }
  }
  return null;
}

function appendMenus(menus_to_append) {
  // console.log("ThisVars:"+Object.keys(this));
  // console.log("WindowVars:"+Object.keys(window));
  for(var m in menus_to_append) {
    var dm = defaultContextMenu;
    if(m !== 'defaultContextMenu') {
      dm = findMenu(m);
      if(!dm) {
        alert("Could not find default menu "+m+" to append");
        continue;
      }
    }
    console.log("Found menu to append:"+dm);
    var am = menus_to_append[m];
    for(var i in am)
      dm.push(am[i]);
  }
}

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

function getLineColor(id) {
  if(lineInstances.hasOwnProperty(id)) {
    if(lineInstances[id].hasOwnProperty('color'))
      return lineInstances[id].color;
  }
  return '#000000';
}

function setCurrentLineColor(c) {
  if(!!currentContextObject) {
    var id = currentContextObject.id;
    var do_rec = {action:'lineColor',id:id,type:'line',color:c};
    if(lineColor != defaultLineColor)  // applies to future lines
      do_rec.oldValue = lineColor;
    doRecordAdd(do_rec);
    setLineColor(id,c);
  }
}

function setLineColor(id,c) {
  if(lineInstances.hasOwnProperty(id)) {
    lineInstances[id].path.strokeColor = c;
    lineInstances[id].color = c;
  }
  lineColor = c;
}

// helper to add hidden image to document before reference as paper image
function addImage(source, id) {
  var img = document.createElement("img");
  img.src = source;  // this will cause a GET call from the browser
  img.id = id;
  img.hidden = true;
  body.appendChild(img);
  return img;
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
function findInstance(obj,search_by,search_key,first_only) {
  // search through obj.search_by == search_key
  // if first_only is true then return first match
  console.log("Find instance of "+search_by+ " in "+Object.keys(obj).length + " instances");
  if(search_key === 'id') {
    if(obj.hasOwnProperty(search_key)) {
      return search_key;
    }
    return null;
  }
  var ids = [];
  for(var id in obj) {
    console.log("Checking id:"+id);
    var inst = obj[id];
    if(inst.hasOwnProperty(search_by) && inst[search_by] == search_key) {
      if(first_only)
        return id;
      ids.push(id);
    }
  }
  if(first_only)
    return null;
  return ids;
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
  body = document.getElementById("body");
// there may or maynot be an activeLayer when this code is run
  baseLayer = project.activeLayer;  //for some reason no layer exists yet
  cursorLayer = new Layer();
  project._activeLayer = baseLayer;

}

function hideCursor() {
  console.log("Hide cursor");
  cursorLayer.removeChildren();
  cursorLayer.position = [0,0];
  cursorImage = null;
}

function showCursor(ci) {
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
  cursorImage = obj;
  cursorPos[0] = mouseDownPosition;
  if(show_mouse_cursor)
    showCursor(0);
  cursorPos[1] = raster.position;
  showCursor(1);
  console.log("Show cursors:"+Object.keys(imgobj));
  if(imgobj.hasOwnProperty('center')) {
    var cp = imgobj.center;
    if(imgobj.hasOwnProperty('scale'))
      cp *= imgobj.scale;
    console.log("Scaled center:"+cp+" Scale:"+imgobj.scale);
    cursorPos[2] = raster.position - cp.rotate(raster.rotation);
    showCursor(2);
  }
  if(imgobj.hasOwnProperty('origin')) {
    var op = imgobj.origin;
    if(imgobj.hasOwnProperty('scale'))
      op *= imgobj.scale;
    cursorPos[3] = raster.position - op.rotate(raster.rotation);
    showCursor(3);
  }
  project._activeLayer = baseLayer;
}

// onmousedown callback for images that are cloneable, dragable or have context menu
function onImageMouseDown(event) {
  mouseDownHandled = true;
  stopEvent(event);  // doesn't work
  mouseDownPosition = event.point;
  hideArea();
  hideContextMenu('contextMenu');
  if(rightButtonCheck(event)) {  // this will set rightButton global
    //console.log("Right button down");
  }
  //console.log("ActiveLayer:"+project.activeLayer);
  console.log("image mouse down");
  // look to see if this object is the raster for one of the master images
  var imgobj;
  console.log("Loaded images:"+Object.keys(imagesLoaded));
  for(var id in imagesLoaded) {
    console.log("Check id:"+id);
    imgobj = imagesLoaded[id];

    if(this === imgobj.raster) {  //master image found
      console.log("Master image found");
      if(!editMode) {
        if(imgobj.hasOwnProperty('hitCallback'))
          imgobj.hitCallback(mouseDownPosition,event,hit_id,imgobj);
        return false;
      }
      if(rightButton) {
        if(imgobj.hasOwnProperty('contextMenu')) {  // if not defined then stay with default
          console.log("Attaching image context menu");
          setContextMenu(imgobj.contextMenu);
          // currentContextObject object has some redundant info but seems simpler to use this way
          currentContextObject = {id:id,type:'image',inst:imgobj,src:imgobj,raster:imgobj.raster};  //to match image instance object
          selectItem(id,imgobj.raster);
          imageSelected = this;
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
          imageSelected.rotation = imgobj.raster.rotation;
          imageSelectedPosition = null;  // so we can tell there was no prior position
          imageSelectedRotation = imgobj.raster.rotation;
          showImageCursors(inst,false);
        }
      }
      return false;  // master image found, so no need to look at clones in imageInstances
    }
  }
  // no master image found, so maybe this is a clone
  id = findInstance(imageInstances,"raster",this,true);
  if(!!id) {
    console.log("Clone image found ID=" + id);
    imgobj = imageInstances[id];
    if(!editMode) {
      if(imgobj.hasOwnProperty('hitCallback'))
        imgobj.hitCallback(mouseDownPosition,event,hit_id,imgobj);
      return false;
    }
      //if(this == imginst.raster) {  // clone image found
      src = imgobj.src;
      showImageCursors(imgobj,false);
      if(rightButton) {
        if(src.hasOwnProperty('instanceContextMenu')) {   // if not defined then stay with default
           setContextMenu(src.instanceContextMenu);
           // currentContextObject object has some redundant info but seems simpler to use this way
           // name may not be defined
           console.log("name:"+imgobj.name);
           currentContextObject = {id:id,type:'symbol',inst:imgobj,src:src,raster:this};
           selectItem(id,imgobj.raster);
           holdContext = true;  // cross browser solution to default mouse up reset
           return false; // clone image not selected for right click
        }
      }
      imageSelected = this;
      imageSelected.opacity = 0.5;
      imageSelectedPosition = this.position.clone();  // need to dereference
      imageSelectedRotation = null; // indicating it rotation is a seperate issue
      return false;  //found so done looking
    //}
  }
  return false;
}

// uses master image raster to create clone
// only use force_id for redo so that it uses old id
function symbolPlace(imgid, force_id) {
  var imgobj = imagesLoaded[imgid];
  console.log("Placing clone of:"+imgobj.id);
  imageSelected = imgobj.symbol.place();
  //imageSelected.scale(0.5);
  imageSelected.onMouseDown = onImageMouseDown;
  var img_id;
  var inst;
  if(typeof force_id === 'undefined') {
    inst = {src:imgobj, raster:imageSelected};
    img_id = nextID;
    doRecordAdd({action:'symbolPlace',id:img_id,type:'symbol',src_id:imgobj.id});
    selectItem(img_id,imageSelected);
    currentContextObject = {id:img_id,type:'symbol',inst:inst,src:imgobj,raster:imageSelected};
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
  if(selectedItems.hasOwnProperty(id))
    delete selectedItems[id];
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
  console.log("Loading " + images_to_load.length + " images");
  while(images_to_load.length > 0) {  // continue till empty - not sure if this is valid
    var imgobj = images_to_load.pop();
    imgobj.initialProp = Object.keys(imgobj);
    imagesLoaded[imgobj.id]= imgobj;  // record master images
    imgobj.element = addImage(imgobj.src,imgobj.id);  // add image to document
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
      console.log("Pos:" + imgobj.pos);
      imgobj.raster.position = imgobj.pos;
    } else {  // no position so dont show yet
      imgobj.raster.remove();
      console.log("don't need this cluttering the document");
    }
    var listen_to_mouse = imgobj.hasOwnProperty('contextMenu');
    if(imgobj.hasOwnProperty('dragClone')) {  // if not defined then assume false
      if(imgobj.dragClone === true)
        listen_to_mouse = true;
    }
    if(listen_to_mouse)
      imgobj.raster.onMouseDown = onImageMouseDown;  // needed for drag or context
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

function loadImage(path,subpath)  {
  // load images from directory or locals
  if(window.location.protocol === 'file:') {  //local storage
    console.log("No server so need to use prelisting");
    // need to building a image load object for loadImages
    if(typeof window.globals.imagesAvailable !== 'undefined') {
      var full_list = window.globals.imagesAvailable;
      console.log(full_list);
      console.log("path:"+path+" subpath:"+subpath);
      if(typeof path === 'undefined')
        path = "";
      if(typeof subpath !== 'undefined') {
        if(subpath === 'parent_directory') {
          var lp = path.lastIndexOf("/");
          if(lp >= 0)
            path = path.substring(0,lp);
          else
            path = "";
        } else {
          if(path.length > 0)
            path += "/";
          path += subpath;
        }
      }
      ilist = [];
      for(var i in full_list) {
        console.log("i:"+i+" = "+full_list[i].src);
        var ip = full_list[i].src;
        if(typeof path !== 'undefined' && path.length > 0) {
          console.log("path:"+path.length);
          id = "img" + imageInstances.length; // default id
          if(ip === path) {
            if(full_list[i].hasOwnProperty('id'))
              id = full_list[i].id;
            else if(typeof subpath !== 'undefined')  // should be
              id = subpath;
            loadSingleImage(path,id);
            return;
          }
          if(ip.indexOf(path) === 0) {
            ip = ip.substring(path.length+1);
            console.log("Entering subpath:"+ip);
          } else
            continue;
        }
        var parts = ip.split("/");
        console.log("parts:"+parts+ " length="+parts.length);
        var f = {name:parts[0]};
        if(parts.length > 1)
          f.type = "dir";
        else {
          f.type = "file";
          var xp = parts[0].split('.');
          console.log("xp:"+xp);
          if(xp.length < 2 || imageExtensions.indexOf(xp[xp.length-1]) < 0)
            continue;
        }
        ilist.push(f);
      }
      console.log("ilist:"+ilist);
      paperGlue.fileSelector("loadImage","localImages",{type:"dir",path:path,dir:ilist});
    } else
      console.log("No images available object loaded");
  } else if(typeof path === 'undefined' ) {
    listFiles("loadImage",imageExtensions);  // defaults to listfile from here
  } else {  // assume we have a path to an image provided by listFile via myscript fileSelectDialog
    var full_path = path + "/" + subpath;
    loadSingleImage(full_path,subpath);
  }
}

function loadSingleImage(full_path, subpath) {
  //e.g var first_image = {src:"img/con_Block_5.08mm_12.png", scale:0.6, id:"conBlock1", isSymbol:true, dragClone:true, pos:view.center };
  var img = importDefaults;
  img.src = full_path;
  img.id = subpath;
  var images_to_load = [img];
  loadImages(images_to_load);
}

function setContextMenu(context_type) {
  currentContextMenu = defaultContextMenu;
  if(window.globals.hasOwnProperty("menuLookup")) {
    var choices = window.globals.menuLookup;
    if(choices.hasOwnProperty(context_type))
      currentContextMenu = window.globals.menuLookup[context_type];
  }
  //console.log("Context menu:"+currentContextMenu);
}

function nameCurrentImage(name) {
  var id = currentContextObject.id;
  nameImage(name,id);
}

function nameImage(name,id) {
  var imgobj = imageInstances[id];
  console.log("ID:"+id);
  if(name === id) {  // no need for name if it is the same as id
    if(imgobj.hasOwnProperty('name'))
      delete imgobj.name;
  } else {
    imgobj.name = name;
    console.log("Image renamed:"+imgobj.name);
  }
}

/* Callback for generated context menu
  as set in loadCurrentContextMenu
*/
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
    } else if(menu_item.hasOwnProperty('submenu')) {
      console.log("Loading sub menu length:"+menu_item.submenu.length);
      if(Array.isArray(menu_item.submenu))
        currentContextMenu = menu_item.submenu;
      else  // assume it is a string descriptor
        setContextMenu(menu_item.submenu);
      loadCurrentContextMenu(currentContextTable);
      return;
    }
  }
  hideContextMenu('contextMenu');
};

function viewCall(){
  console.log('view called');
}

function openCall(){
  console.log('open called');
  loadRecord();
}

function stopEvent(event){
 if(typeof event.preventDefault !== 'undefined')
  event.preventDefault();
 if(typeof event.stopPropagation !== 'undefined')
  event.stopPropagation();
}

/* Will be linked to  window.onContextMenu
*/
function onContextMenu(event) {
  console.log("Call for context menu");
  stopEvent(event);
  if(!editMode)
    return false;
  if(modalOpen || !currentContextMenu) {
    console.log("Modal or no currentContextMenu");
    return false;
  }
  showContextMenu('contextMenu',event);  // standard context menu
  console.log("Console menu display complete");
  return false;
}

// mostly from http://www.codeproject.com/Tips/630793/Context-Menu-on-Right-Click-in-Webpage
// called by onContextMenu above
function showContextMenu(control, e) {
  var posx = e.clientX +window.pageXOffset +'px'; //Left Position of Mouse Pointer
  var posy = e.clientY + window.pageYOffset + 'px'; //Top Position of Mouse Pointer
  var el = document.getElementById(control);
  if(!!el) {
    el.style.position = 'absolute';
    el.style.display = 'inline';
    el.style.left = posx;
    el.style.top = posy;
    var tbl = el.children[0];  //assumes menu has table as first child
    currentContextTable = tbl;
    loadCurrentContextMenu(tbl);
  }
}

/* Call to generate and show the contextmenu for the current object if any
    called by showContextMenu and also for control key + arrows for stepped moves,
    to show the changed positions.
*/
function loadCurrentContextMenu(tbl) {
  tbl.innerHTML = "";
  //console.log("window width:"+window.innerWidth);
  //console.log("window height:"+window.innerHeight);
  var fontsize = window.innerWidth/80;
  for(var mi in currentContextMenu) {
    var m = currentContextMenu[mi];
    console.log(m);
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
  if(!!el) {
    el.style.display = 'none';
    var tbl = el.children[0];  //assumes menu has table as first
    tbl.innerHTML = "";
  }
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
  if(mouseDownHandled) {  // another onfunction has handled this event already
    mouseDownHandled = false;
    return false;
  }
  console.log("Basic Mouse down");
  if(modalOpen)
    return false;
  mouseDownPosition = event.point;
  hideArea();
  hideContextMenu('contextMenu');
  if(editMode) {
    if(!!lineSelected || !!imageSelected) {     // an existing line has been selected
      console.log("Something selected");
    } else {
      var id = hitTestLines(mouseDownPosition);
      if(!!id) {
        lineSelected = lineInstances[id].path;
        selectLine(event);
      }
    }
  }
  if(rightButtonCheck(event)) {
    console.log("Right button down");
    var d = new Date();
    var nowMs = d.getTime();
    var shiftPressed = ((nowMs - shiftPressMs) < modPressDelay);
    if(shiftPressed) {   //if control pressed then do not clear previous
      selectedMove = true;
    }
    if(!holdContext)  // cross browser solution to default mouse up reset
      currentContextMenu = defaultContextMenu;
  }
  return false;
}

function newLine() {
  console.log("Start new path");
  lineSelected = new Path();
  lineSelected.strokeColor = lineColor;
  lineSelected.strokeWidth = lineThickness;
  lineSelected.strokeCap = 'round';
  lineSelected.onMouseDown = onLineMouseDown;  // the call to use for mod
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
  //areaSelected.onMouseDown = onLineMouseDown;  // the call to use for mod
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
  if(areasVisible) {
    showArea(nextID);
    selectItem(nextID,areaInstances[nextID].path);
  }
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
  doRecordAdd({action:'rename',id:id,type:'area',oldValue:oldname,name:name});
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
  doRecordAdd({action:'move',id:id,type:'area',oldValue:a.rect,rect:rect});
  moveArea(rect,id);
}

function moveArea(rect,id) {
  var a = areaInstances[id];
  a.rect = rect;
  showArea(id);
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
    if(selectedItems.hasOwnProperty(id))
      delete selectedItems[id];
  }
}

function removeAreas(){
  console.log("Removing area instances:"+Object.keys(areaInstances).length);
  for(var id in areaInstances)
    removeAreaInstance(id);
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
  currentContextObject = {id:id,type:'area',inst:a};
  selectItem(id,a.path);
}

function showAllAreas() {
  areasVisible = true;
  for(var id in areaInstances) {
    console.log("Show area#" + id);
    showArea(id);
  }
}

function hideAllAreas() {
  for(var id in areaInstances) {
    removeAreaPath(areaInstances[id]);
  }
  areasVisible = false;
}

function toggleAreas() {
  if(areasVisible) {
    hideAllAreas();
    optionsContextMenu[0].label = 'show areas';
  } else {
    showAllAreas();
    optionsContextMenu[0].label = 'hide areas';
  }
}

function hitTestArea(id,hit_point) {
  var rect = areaInstances[id].rect;
  //console.log("Is "+hit_point + " in " + rect + " = " +rect.contains(hit_point));
  return rect.contains(hit_point);
}

function hitTestAreas(hit_point) {
  for(var id in areaInstances) {
    //console.log("Hit test area#" + id);
    if(hitTestArea(id,hit_point)) {
      console.log("Hit test area#" + id);
      return id;
    }
  }
  return null;
}

function areaMoved(path,prev_pos) {
  console.log("Area moved");
  var aid = findInstance(areaInstances,'path',path,true);
  if(!!aid) {  // shouldn't be any trouble here
    console.log("area instance found with id:"+aid);  // need to keep id as well - might be null for master objects in layout mode
    var inst = areaInstances[aid];
    // keeping the obj as record is fine for undo but not so good for redo if the object gets deleted further back
    var new_rect = new Rectangle(roundPoint(path.firstSegment.point),roundPoint(path.segments[2].point));
    doRecordAdd({action:'move',id:aid,type:'area',oldValue:inst.rect,rect:new_rect});
    inst.rect = new_rect;
  }
}

function hitTestLine(id,hit_point) {
  var path = lineInstances[id].path;
  // var rect = new Rectangle(path.firstSegment.point,path.lastSegment.point);
  // //console.log("Is "+hit_point + " in " + rect + " = " +rect.contains(hit_point));
  // if(!rect.contains(hit_point))
  //   return -1;
  // return distance to closer end
  var d1 = (hit_point - path.firstSegment.point).length;
  var d2 = (hit_point - path.lastSegment.point).length;
  //console.log(d1,d2);
  return Math.min(d1,d2);
}

function hitTestLines(hit_point) {
  var best_dist = null;
  var best_id = null;
  for(var id in lineInstances) {
    var l = hitTestLine(id,hit_point);
    //console.log("Hit test area#" + id + " = " + l);
    if(!best_dist || (l >= 0 && l < best_dist)) {
      best_dist = l;
      best_id = id;
      //console.log("Chose:" + id);
    }
  }
  //console.log("Best dist:"+ best_dist);
  if(!best_dist || best_dist > selectDist)
    return null;
  return best_id;
}

function selectItem(id,item) {
  var d = new Date();
  var nowMs = d.getTime();
  var controlPressed = ((nowMs - controlPressMs) < modPressDelay);
  if(!controlPressed) {   //if control pressed then do not clear previous
    for(var sid in selectedItems) {
      selectedItems[sid].selected = false;
      if(!!cursorImage && (selectedItems[sid] === cursorImage.raster))
        hideCursor();
    }
    selectedItems = [];  // leaves the problem for the garbage collector
  } else
    currentContextMenu = null;  // no context menu for multi selection
  if(selectedItems.hasOwnProperty(id)) {  //already selected so toggle
    selectedItems[id].selected = false;
    if(!!cursorImage && (selectedItems[id] === cursorImage.raster))
      hideCursor();
    delete selectedItems[id];
    item.selected = false;
  } else {
    selectedItems[id] = item;
    item.selected = true;
  }
}

// onmousedown callback for two point paths
// harder to use than picking the ends but the only way to drag whole line
function onLineMouseDown(event) {
  if(!editMode)
    return true;
  stopEvent(event);
  mouseDownHandled = true;
  console.log("Line mouse down");
  if(modalOpen)
    return;
  hideContextMenu('contextMenu');
  mouseDownPosition = event.point;

  lineSelected = this;
  selectLine(event);
  return false;
}

// called both by onLineMouseDown and onMouseDown
function selectLine(event) {
  if(rightButtonCheck(event)) {
    console.log("Right button down");
    var ids = findKey(lineInstances,'path',lineSelected);
    if(ids.length > 0) {
      console.log("Line found:"+ ids[0]);
      currentContextObject = {id:ids[0],type:'line',inst:lineSelected};  //to match image instance object
      setContextMenu("lineInstanceMenu");
      selectItem(ids[0],lineSelected);  //needs to happen after context select
      holdContext = true;  // cross browser solution to default mouse up reset
    }
    return;
  }
  lineSelectedPosition = [lineSelected.firstSegment.point.clone(),lineSelected.lastSegment.point.clone()];
  var line_select_fraction = (event.point - lineSelected.segments[0].point).length/lineSelected.length;
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
}

// universal mouse drag function can drag lines or images or create rubber band new line
function onMouseDrag(event) {
  // only fires when the mouse button is pressed
  if(modalOpen || !editMode)
    return;
  if(rightButton) {
    var v = event.point - mouseDownPosition;
    if(selectedMove) {
      for(var sid in selectedItems) {
        //console.log("Move id:",sid);
        if(lineInstances.hasOwnProperty(sid))
          lineInstances[sid].path.position += event.delta;
        else if(imageInstances.hasOwnProperty(sid))
          imageInstances[sid].raster.position += event.delta;
        else if(areaInstances.hasOwnProperty(sid)) {
          var sa =areaInstances[sid];
          if(sa.hasOwnProperty("path"))
            sa.path.position += event.delta;
          if(sa.hasOwnProperty("text"))
            sa.text.position += event.delta;
        }
      }
      return;
    }
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
  if(typeof p === 'undefined')  // not sure why this happens
    return;
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
  stopEvent(event);
  if(modalOpen) {
    return false;
  }
  if(editMode) {
    if(!!imageSelected) {
      console.log("Opacity was:" + imageSelected.opacity);
      imageSelected.opacity = 1.0;
    }
    if(rightButton) {
      if(selectedMove) {
        for(var sid in selectedItems) {
          console.log("validate moved for:"+sid);
          var item = selectedItems[sid];
          var prev_pos = selectedPos[sid];
          if(lineInstances.hasOwnProperty(sid)) {
            lineSelected = item;
            lineSelectedPosition = prev_pos;
            validatePath(item);
          } else if(imageInstances.hasOwnProperty(sid)) {
            imageMoved(item,prev_pos,false,null);
          } else if(areaInstances.hasOwnProperty(sid)) {
            areaMoved(item,prev_pos);
          }
        }
        selectedMove = false;
        rightButton = false;
        lineSelected = null;
        imageSelected = null;
        currentContextMenu = null;
        console.log("Area move completed");
        return false;
      }
      console.log("Not select move");
      var aid;
      if(!imageSelected && !lineSelected && !areaSelected) {
        if(areasVisible) {
          aid = hitTestAreas(mouseDownPosition);
          if(!!aid) {
            var a = areaInstances[aid];
            currentContextObject = {id:aid,type:'area',inst:a};  //to match image instance object
            setContextMenu("areaMenu");
            if(a.hasOwnProperty('path'))
              selectItem(aid,a.path); // needs to happen after context select
          }
        }
        if(!aid) {
          console.log("Not area clicked - check lines");
          var id = hitTestLines(mouseDownPosition);
          if(!!id) {
            console.log("Line found!="+id);
            var l = lineInstances[id];
            currentContextObject = {id:id,type:'line',inst:l};  //to match image instance object
            setContextMenu("lineMenu");
            if(l.hasOwnProperty('path')) {
              selectItem(id,l.path);  //needs to happen after context select
              currentContextObject = {id:id,type:'line',inst:l};
            }
          }
        }
      }
      console.log("Select check complete");
      rightButton = false;
      lineSelected = null;
      imageSelected = null;
      return false;
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
      imageMoved(imageSelected,imageSelectedPosition,(imageSelected.position == imageSelectedPosition),imageSelectedRotation);
      imageSelected = null;
    }  // end of edit mode
  } else {  // not edit mode
    var hit_id = hitTestAreas(mouseDownPosition);
    if(!!hit_id) {
      var area = areaInstances[hit_id];
      if(area.hasOwnProperty('hitCallback'))
        area.hitCallback(mouseDownPosition,event,hit_id,area);
      if(typeof window.globals.hitCallback === 'function')
        window.globals.hitCallback(hit_id);
    }
  }
  selectedMove = false;
  lineSelected = null;
  imageSelected = null;
  return false;
}

function imageMoved(img,prev_pos,spot_rotate,src_prev_rot) {
  // note that src_prev_rot is only no null for first symbol creation
  var img_id = findInstance(imageInstances,'raster',img,true);
  if(!!img_id) {  // shouldn't be any trouble here
    console.log("instance found with id:"+img_id);  // need to keep id as well - might be null for master objects in layout mode
    var round_only = !snapDefault;
    var inst = imageInstances[img_id];
    if(inst.hasOwnProperty('snap'))
      round_only = !inst.snap;
    var src = imageInstances[img_id].src;
    if(!src_prev_rot && spot_rotate) { // no movement or no prior position it being null
      rotateImage(img_id,'symbol',img,src,90);
      correctPosition(img,src,round_only);
    } else {
      correctPosition(img,src,round_only);
      // keeping the obj as record is fine for undo but not so good for redo if the object gets deleted further back
      doRecordAdd({action:'imageMove',id:img_id,type:'symbol',oldValue:prev_pos,pos:img.position});
    }
    if(!!src_prev_rot) {
      if(!prev_pos)  // raster is already rotated for initial drag
        img.rotate(-img.rotation);
      rotateImage(img_id,'symbol',img,src,src_prev_rot);
      //correctPosition(img,src,round_only);
    }
  }
}

function correctPosition(raster,src,round_only) {
  // snaps and rounds image postion raster
  //console.log("Before:"+raster.position);
  if(src.hasOwnProperty('origin')) {
    var oo = src.origin.rotate(raster.rotation);
    raster.position = snapPoint(raster.position-oo,round_only) + oo;
  } else {
    raster.position = snapPoint(raster.position,round_only);
  }
  //console.log("After snap:"+raster.position);
  raster.position = roundPoint(raster.position);
  //console.log("After round:"+raster.position);
}

function rotateImage(id,type,raster,src,angle) {
  var dorec = {action:'imageRotate',id:id,type:type};
  // use mouseDownPosition or event.posihtion to find the closest point of rotation in object
  var prev_rotation = Math.round(raster.rotation);
  var prev_pos = raster.position;
  if(src.hasOwnProperty('center')) {
    var cp = src.center * src.scale;
    raster.rotate(angle,raster.position-cp.rotate(raster.rotation));  //(new Point(30,30)));  // need to look up source to find centre of rotation - could also have 45 deg mode
  } else
    raster.rotate(angle);  // need to look up source to find centre of rotation - could also have 45 deg mode
  raster.rotation = Math.round(raster.rotation);  // prevent error creaping in
  dorec.pos = [raster.position,raster.rotation];
  dorec.oldValue =[prev_pos,prev_rotation];
  doRecordAdd(dorec);
}

function scaleCurrentImage(scale) {
  var obj = currentContextObject;
  obj.raster.scale(scale/obj.inst.scale);
  obj.inst.scale = scale;
  if(obj.type === 'image') {
    obj.symbol = new Symbol(obj.raster);
    var pos = obj.raster.position;
    var rot = obj.raster.rotation;
    var md = obj.raster.onMouseDown;
    console.log("Remove image raster"); // of keys:"+(Object.keys(obj.raster)));
    obj.raster.remove();
    obj.raster = obj.symbol.place();
    console.log("Restore as new raster");
    obj.raster.position = pos;
    obj.raster.rotation = rot;
    obj.inst.onMouseDown = md;
  }
}

function moveCurrentImage(x,y,r) {
  var im = currentContextObject.raster;
  console.log("Move from pos:"+im.position+" to "+x+","+y+","+r);
  var p = new Point(x,y);
  if(x !== im.position.x || y !== im.position.y) {
    //console.log(p);
    doRecordAdd({action:'imageMove',id:currentContextObject.id,type:currentContextObject.type,oldValue:im.position,pos:p});
    //console.log(doRecord[doRecordIndex-1].pos);
    im.position = p;
  }
  if(r !== im.rotation) {
    rotateImage(currentContextObject.id,currentContextObject.type,im,currentContextObject.src,r-im.rotation);
    // var rot = Math.round(r);
    // doRecordAdd({action:'imageRotate',id:currentContextObject.id,type:'symbol',rot:[im.rotation,rot],});
    // im.rotation = rot;
  }
}

function getLineID(path) {
  for(var id in lineInstances) {
    if(lineInstances[id].path == path) {
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
      lineInstances[next_id] = {path:path};
      if(lineColor != defaultLineColor)
        lineInstances[next_id].color = lineColor;
      //console.log(lineInstances[next_id]);
      //console.log(lineInstances[0]);
      if(next_id == nextID)
        nextID++;
      line_id = next_id;
    }
    if(typeof force_id == 'undefined') {  // else don't record redos
      var np = [lineSelected.firstSegment.point.clone(),lineSelected.lastSegment.point.clone()];
      var do_rec = {action:'lineMove',id:line_id,type:'line',pos:np };
      if(!!lineSelectedPosition)
        do_rec.oldValue = lineSelectedPosition;
      doRecordAdd(do_rec);
      selectItem(line_id,path);
      currentContextObject = {id:line_id,type:'line',inst:lineInstances[line_id]};  //to match image instance object
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

function removeLine(id, record) {
  if(lineInstances.hasOwnProperty(id)) {  // this path does exist
    var line = lineInstances[id];
    if(record) {
      var lp = [line.path.firstSegment.point.clone(),line.path.lastSegment.point.clone()];
      //console.log("Np:"+np[0]+","+np[1]);
      var do_rec = {action:'lineDelete',id:id,type:'line',oldValue:lp };
      if(line.hasOwnProperty('color'))
        do_rec.color = line.color;
      doRecordAdd(do_rec);  // zero length line
    }
    line.path.remove();  // should remove from screen
    delete lineInstances[id];  // removes from list
  }
  if(selectedItems.hasOwnProperty(id))
    delete selectedItems[id];
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
    console.log("Modal key:"+ event.key);
    if(event.key === 'escape' && paperGlue.closeDialog !== 'undefined') {
      paperGlue.closeDialog();
      return false;
    }
    return true;  //this allows dialogs to receive key strokes
  }
  if(!keyFocus) {
    console.log("Paper  glue ignoring keys");
    return false;
  }
  stopEvent(event);
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
    console.log("Key:"+event.key);
    switch(event.key) {
      case '+':
        console.log("Zoom screen");
        return true;
      case '-':
        console.log("Unzoom screen");
        return true;
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
            var remove_undo = confirm("Remove undo info?");
            doRecord = pruneDo(remove_undo);
            doRecordIndex = doRecord.length;
            console.log("Do record index ="+doRecordIndex);
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
          saveRecordAs();
        } else {
          saveRecord();
        }
        propagate = false;
        break;
      case 'o':
        console.log("cntrlO");
        if(confirm("Do you want to load from storage?"))
        { if(event.shiftPressed) {  // load from
            listFiles("loadRecord","pgl");
          } else {
            loadRecord();
          }
        }
        propagate = false;
        break;
      case '.':
        if(event.shiftPressed)
          stepState(1,1);
        else
          stepState(1,0);
        break;
      case ',':
        if(event.shiftPressed)
          stepState(-1,1);
        else
          stepState(-1,0);
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
      //console.log("Delta:"+delta);
      if(currentContextObject.type === 'symbol') {
        incMoveSymbol(currentContextObject,delta,!event.shiftPressed);
      } else if(currentContextObject.type === 'area') {
        incMoveArea(currentContextObject,delta,!event.shiftPressed);
      }
      propagate = false;
      if(typeof currentContextTable !== 'undefined')
        loadCurrentContextMenu(currentContextTable);
    }
  } else {
    switch(event.key) {
      case 'delete':
        var c = Object.keys(selectedItems).length;
        console.log("Selected items:"+c);
        if(c > 0 && confirm("Remove " + c + " items?")) {
          for(var id in selectedItems) {
            console.log("Delete "+id);
            if(lineInstances.hasOwnProperty(id))
              removeLine(id,true);
            else if(imageInstances.hasOwnProperty(id))
              removeImage(id,true);
            else if(areaInstances.hasOwnProperty(id))
              removeAreaInstance(id,true);
          }
        }
        console.log("Selected items:"+Object.keys(selectedItems));
        currentContextObject = null;
        propagate = false;
        hideContextMenu('contextMenu');
        hideCursor();
        break;
      case 'escape':
        if(!editMode) {
          if(confirm("Exit to edit mode?"))
            setEditMode(true);
        } else {
          if(event.shiftPressed) {
            if(confirm("Exit edit mode?"))
              setEditMode(false);
          } else {
            hideContextMenu('contextMenu');
            hideCursor();
          }
        }
        break;
    }
  }
  if(propagate && (typeof globals.keyhandler == 'function')) {
    console.log("Passing key upwards");
    propagate = globals.keyhandler(event);
  } else {
    stopEvent(event);
  }
  return propagate;
}

function incMoveSymbol(obj,direction,snap) {
  objPosition = obj.raster.position;
  var img_id = findInstance(imageInstances,'raster',obj.raster,true);
  if(snap) {
    obj.raster.position += [direction[0]*snapRect[2],direction[1]*snapRect[3]];
    if(!!img_id) {
      //console.log("instance found with id:"+img_id);  // need to keep id as well - might be null for master objects in layout mode
      //var src = imageInstances[img_id].src;  // could have used obj.src
      var round_only = !snapDefault;
      if(img_id !== null) {
        var inst = imageInstances[img_id];
        if(inst.hasOwnProperty('snap'))
          round_only = !inst.snap;
      }
      correctPosition(obj.raster,obj.src,round_only);
    }
  } else {
    obj.raster.position += direction;
  }
  doRecordAdd({action:'imageMove',id:img_id,type:'symbol',oldValue:objPosition,pos:obj.raster.position});
}

function incMoveArea(obj,direction,snap) {
  objRect = obj.inst.rect;
  var inst = obj.inst;
  var area_id = findInstance(areaInstances,'path',inst.path,true);
  var delta = direction;
  if(snap) {
    delta[0] *= snapRect[2];
    delta[1] *= snapRect[3];
  }
  inst.rect = new Rectangle(objRect.topLeft+delta,objRect.bottomRight+delta);
  showArea(area_id);
  doRecordAdd({action:'areaMove',id:area_id,type:'area',oldValue:objRect,pos:inst.rect});
}

function buildImgList() {
  var img_list = [];
  console.log("Type:"+(typeof img_list));
  var img_ids = Object.keys(imagesLoaded);
  for(var id in imagesLoaded) {
    var im = imagesLoaded[id];
    var img = {};
    for(var ik in im) {
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
  return img_list;
}

function buildRedoTxt(beautify,include_loader) {
  // made sort of JSON beautifier but may not use
  var txt = "";
  if(include_loader)
    txt += "var jdata='";
  var json_txt = buildRedoData();
  var indent = 0;
  var llc = null;
  var lc = null;
  var lt = [];  // whether brace level caused indent
  var bl = 0;
  var col = 0;
  for(var ji in json_txt) {
    var c = json_txt[ji];
    if(beautify) {
      var nl = false;  // assumption
      switch(c) {
        case '{':
        case '[':
          //if(lc === ':')
          //  break;
          //if(lc !== ',')  // array
          indent++;
          //lt[bl++] = 0;
          nl = true;
          break;
        case '}':
        case ']':
          bl--;
          indent -= 2;
          break;
      }
      if(lc === ',') {
        nl = true;
      }
      if(nl) {
        txt += "\n";
        for(var ti = 0; ti < indent; ti++)
          txt += "  ";
        col = indent*2;
      }
      if(nl && lc !== ',')
        indent++;
    }
    txt += c;
    col++;
    llc = c;
    lc = c;
  }
  if(include_loader)
    txt += doRecLoader;
  return txt;
}

function buildRedoData() {
  // build reduced image list
  var img_list = buildImgList();
  var project_data = {imglist:img_list,dolist:doRecord};
  //console.log("project data:"+Object.keys(project_data));
  var jdata ="";
  try {
     jdata = JSON.stringify(project_data);
  } catch(err) {
    console.error("JSON Stringify error:"+err);
  }
  return jdata;
}

function saveDoRec() {
  if(window.location.protocol == 'file:') {
    alert("Can only save dorec.js with server active.");
  }
  if(typeof nodeComms.sendData !== 'function')
    return;
  var jtxt = buildRedoTxt(true,true);
  var save_data = {command:'save',path:"dorec.js",data:jtxt};
  nodeComms.sendData(JSON.stringify(save_data));
}

function saveRecordAs() {
  listFiles("saveRecord","pgl");
}

function saveRecord(path,subpath) {
  var dolist = doRecord;  //pruneDo();
  console.log("Try to save");
  console.log("Globals:" + Object.keys(window.globals));
  console.log("SendData:",typeof nodeComms.sendData);
  var jdata = buildRedoData();
  console.log("jdata:"+jdata);
  if(window.location.protocol == 'file:') {
    // might try to impletement local storage some day
    console.log("Storage type:" + typeof(Storage));
    if(typeof(Storage) === "undefined") {
      console.log("Local storage not implemented");
    } else {
      console.log("Data:"+jdata);
      if(typeof path === 'undefined')
        subpath = "data";
        localStorage[subpath] = jdata;
      console.log("Local storage:" + localStorage);
    }
  } else if(typeof nodeComms.sendData === 'function') {
    var save_data = {command:'save',path:recordPath,data:jdata};
    if(typeof path !== 'undefined')
      save_data.path = path;
    if(typeof subpath !== 'undefined')
      save_data.subpath = subpath;
    nodeComms.sendData(JSON.stringify(save_data));
  }
}

function loadRecordAs() {
  listFiles("loadRecord","pgl");
}

function loadRecord(path,subpath) {
  console.log("Load");
  console.log(window.location.protocol);
  if(window.location.protocol === 'file:') {
    console.log("Using local storage");
    if(typeof(Storage) === "undefined") {
      console.log("Local storage not implemented");
    } else {
      if(typeof path === 'undefined')
        subpath = "data";
      if(localStorage.hasOwnProperty(subpath)) {
        console.log("Parsing length = " + localStorage[subpath].length);
        parseRecord(localStorage[subpath]);
      } else {
        alert("Local storage has no item of name:"+subpath);
      }
    }
  } else if(typeof nodeComms.sendData === 'function') {
    console.log("Loading from node js server storage");
    nodeComms.onReply = onLoadReply;
    console.log("Attempting to load:"+recordPath);
    postObject = {command:'load',path:recordPath};  //xtns not required
    if(typeof path !== 'undefined')
      postObject.path = path;
    if(typeof subpath !== 'undefined')
      postObject.subpath = subpath;
    nodeComms.sendData(JSON.stringify(postObject));
  }
}

function listFiles(objective,xtns,path,subpath) {
  console.log("List "+xtns+" from "+path+" / "+subpath + "for " +objective);
  listObjective = objective;
  listXtns = xtns;
  if(window.location.protocol === 'file:') {
    console.log("Local storage  listing");
    if(typeof paperGlue.fileSelector === 'function') {
      var local_storage_objects = Object.keys(localStorage);
      console.log("Local storage objects:"+local_storage_objects);
      // xtns don't really apply to local storage
      paperGlue.fileSelector(listObjective,listXtns,{type:"dir",path:"localStorage",dir:local_storage_objects});
    }
  } else if(typeof nodeComms.sendData === 'function') {
    // node js storage
    nodeComms.onReply = onLoadReply;
    if(typeof path !== 'undefined')
      relativePath += path;
    console.log("Attempting to list from:"+relativePath);
    postObject = {command:'list',xtns:listXtns,path:relativePath};
    if(typeof subpath !== 'undefined')
      postObject.subpath = subpath;
    // note: a special subpath can be "parent_directory"
    //       This is required as ".." is not allowed
    // note: relativePath will be corrected by onLoadReply
    nodeComms.sendData(JSON.stringify(postObject));
  }
}

function onLoadReply(res) {
  console.log("Onreply:"+res);
  if(res.indexOf('500') === 0) {  //starts with error code
    console.log("Report error:"+res);
  } else {
    console.log("attempting to parse json object");
    //try {
      var reply_obj = JSON.parse(res);
      console.log(reply_obj);
      switch(reply_obj.type) {
        case 'file':
          parseRecord(reply_obj.data);
          break;
        case 'dir':
          relativePath = reply_obj.path;
          if(typeof paperGlue.fileSelector === 'function')
            paperGlue.fileSelector(listObjective,listXtns,reply_obj);
          break;
      }
    //} catch(e1) {
    //  console.log("Error parsing reply"+e1);
    //}
  }
}

function parseRecord(jdata) {
    //try {
      console.log("Data="+jdata);
      var project_data = JSON.parse(jdata);
      if(doRecord.length > 0)
        removeAll();
      imglist = project_data.imglist;
      console.log("Images to load:"+imglist.length); //Array.isArray(imglist));
      // add any images not already loaded - does not check date
      var overload_images = true;
      if(editMode && imglist.length > 0 && Object.keys(imagesLoaded) > 0)
        overload_images = confirm("Overload existing images with same name?");
      var imgs_to_load = [];
      for(var ik in imglist) {
        //var ik = img_keys[ii];
        console.log("ik:"+ik+"="+imglist[ik].id);
        if(!overload_images && imagesLoaded.hasOwnProperty(imglist[ik].id)) {
          console.log("This image already loaded");
          continue;
        }
        var imgobj = parseImageObj(imglist[ik]);
        imgs_to_load.push(imgobj);
      }
      console.log("Images to load:"+imgs_to_load);
      loadImages(imgs_to_load);  //will add to previously set defaults
      var do_record = project_data.dolist;
      for(var di in do_record) {
        console.log("ID:"+do_record[di].id);
      }
      parsePaperRecord(do_record);
      for(di in doRecord) {
        console.log("ID:"+doRecord[di].id);
      }
      doRecordIndex = 0;
      doAll();

    //} catch(e2) {
    //   console.log("Error parsing file data"+e2);
    //}
}

function parsePaperRecord(do_record) {
  var new_nextID = 0;  // nextID will be set to this after finding highest ID
  for(var di in do_record) {
    var to_do = do_record[di];
    to_do.id = parseInt(to_do.id) + nextID;
    if(to_do.id >= new_nextID)
      new_nextID = to_do.id + 1;
    if(to_do.hasOwnProperty('pos')) {
      console.log("Fix pos");
      to_do.pos = parseLine(to_do.pos);  // check for paper.js object JSON conversion problems
      if(to_do.hasOwnProperty('oldValue'))
        to_do.oldValue = parseLine(to_do.oldValue);
    }
    else if(to_do.hasOwnProperty('rect')) {
      console.log("Fix rect");
      to_do.rect = parseRect(to_do.rect);  // check for paper.js object JSON conversion problems
    }
    else if(to_do.hasOwnProperty('size')) {
      console.log("Fix size");
      to_do.size = parseRect(to_do.size);  // check for paper.js object JSON conversion problems
    }
    doRecord.push(to_do);
  }
  nextID = new_nextID;
  console.log("NextID will be "+nextID);
}


function parsePoint(ord) {
  console.log(ord[0]);  // will be undefined for a real point
  if(ord[0] === 'Point')
    return new Point(ord[1],ord[2]);
  else
    return ord;  // no change
}

// JSON doesn't know how to create a paper.Point
function parseLine(arr) {
  if(!arr)
    return null;
  console.log("Type;"+(typeof arr));
  console.log(arr.length);
  if(arr.length === 2) {
    return [parsePoint(arr[0]),parsePoint(arr[1])];
  } else if(arr[0] === 'Point') {
    return parsePoint(arr);
  }
  return arr;  // no change needed
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

function parseImageObj(obj) {
  // correct all the JSON parsed points in the obj
  var nobj = {};
  for(var k in obj) {
    if(Array.isArray(obj[k]))
      nobj[k] = parsePoint(obj[k]);
    else
      nobj[k] = obj[k];
  }
  console.log(nobj);
  return nobj;
}

function removeLines() {
  console.log("Removing lines:"+Object.keys(lineInstances).length);
  for(var id in lineInstances) {
    removeLine(id);
  }
}

function removeSymbols() {
  console.log("Removing images:"+Object.keys(imageInstances).length);
  for(var id in imageInstances) {
    symbolRemove(id);
  }
}

function removeAll(){
  if(editMode && confirm("Do you want to clear current workspace?"))
  { removeLines();
    removeSymbols();
    removeAreas();
    doRecord = [];
    doRecordIndex = 0;
    nextID = 0;  // start again
  }
}

function removeImage(id,record) {
  if(record) {
    var obj = imageInstances[id];
    doRecordAdd({action:'symbolDelete',id:id,src_id:obj.src.id,pos:obj.raster.position,rot:obj.raster.rotation});
  }
  symbolRemove(id);
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
        if(Object.keys(lineInstances).indexOf(String(last_do.id)) < 0) {
          console.log('No instance of line id:' + last_do.id);
          break;
        }
        var path = lineInstances[last_do.id].path;
        if(!last_do.hasOwnProperty('oldValue') || !last_do.oldValue) {  // no previous existance
          removeLine(last_do.id);
        } else {
          path.firstSegment.point = last_do.oldValue[0];
          path.lastSegment.point = last_do.oldValue[1];
          console.log("Return path to " + last_do.oldValue);
        }
        break;
      case 'lineColor':  // also applies to all new lines
        if(last_do.hasOwnProperty('oldValue'))
          lineColor = last_do.oldValue;
        else
          lineColor = defaultLineColor;
        setLineColor(last_do.id,lineColor);
        break;
      case 'imageMove':
        if(last_do.type === 'image')
          raster = imagesLoaded[last_do.id].raster;
        else
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
          raster.position = last_do.oldValue;
          console.log("Return img position to " + last_do.oldValue);
        }
        break;
      case 'imageRotate':
        if(last_do.type === 'image')
          raster = imagesLoaded[last_do.id].raster;
        else
          raster = imageInstances[last_do.id].raster;
        console.log("oldValue:"+last_do.oldValue);
        if(typeof last_do.oldValue != 'undefined'){  // check it has a pos
          raster.position = last_do.oldValue[0];  // required for non centered rotation
          raster.rotation = last_do.oldValue[1];
          console.log("Return img rotation to " + raster.rotation + "at pos " + raster.position);
        }
        break;
      case 'lineDelete':
        remakeLine(last_do,last_do.oldValue);
        if(last_do.hasOwnProperty('color')) {
          var c = lineColor;
          setLineColor(last_do.id,last_do.color);
          lineColor = c;  // undelete should not change linecolor
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
          nameArea(last_do.oldValue,last_do.id);
        else
          nameImage(last_do.oldValue,last_do.id);
        break;
      case 'move':
        if(last_do.type === 'area')
          moveArea(last_do.oldValue,last_do.id);
        break;
      case 'areaDelete':
        areaInstances[last_do.id] = {rect:last_do.rect};
        if(typeof last_do.name !== 'undefined')
          areaInstances[last_do.id] = last_do.name;
        if(areasVisible)
          showArea(last_do.id);
    }
}

function remakeLine(to_do,pos) {
  newLine();  //set lineSelected
  //console.log(to_do.pos);
  lineSelected.add(pos[0]);
  lineSelected.add(pos[1]);
  //console.path("line:" + lineSelected);
  // need to reuse old id
  var id = validatePath(lineSelected,to_do.id);  // adds to lineInstances
  lineSelected = null;
}

function redo() {
  console.log("Redo");
  if(doRecordIndex >= doRecord.length)
    return false;  // nothing to undo
  var to_do = doRecord[doRecordIndex];
  if(to_do.id > nextID)
    nextID = to_do.id;  // this used to happen with loading of old data
  // now loads should advance all to_do ids to start after nextID
  //console.log(Object.keys(to_do));
  console.log("Redoing " + to_do.action);
  var raster;
  var imgobj;
  switch(to_do.action) {
    case 'lineMove':
      console.log(Object.keys(lineInstances).length);
      if(!lineInstances.hasOwnProperty(to_do.id)) {
        console.log("path id " + to_do.id + " nolonger exists - remaking");
        remakeLine(to_do,to_do.pos);
      } else {
        var path = lineInstances[to_do.id].path;
        path.firstSegment.point = to_do.pos[0];
        path.lastSegment.point = to_do.pos[1];
      }
      break;
    case 'lineColor':
      setLineColor(to_do.id,to_do.color);
      break;
    case 'imageMove':
      if(to_do.type === 'image')
        imgobj = imagesLoaded[to_do.id];
      else
        imgobj = imageInstances[to_do.id];
      raster = imgobj.raster;
      raster.position = to_do.pos;
      console.log("Moving to "+ to_do.pos);
      break;
    case 'imageRotate':
      if(to_do.type === 'image')
        imgobj = imagesLoaded[to_do.id];
      else
        imgobj = imageInstances[to_do.id];
      raster = imgobj.raster;
      raster.position = to_do.pos[0];  // required if rotation not about center
      raster.rotation = to_do.pos[1];
      break;
    case 'symbolPlace':
      symbolPlace(to_do.src_id,to_do.id);
      imageSelected = null;
      // this is normally followed by a drag move, so do this too
      to_do = doRecord[doRecordIndex+1];
      if(to_do.action == 'imageMove') {
        doRecordIndex++;
        console.log("ID:"+to_do.id);
        raster = imageInstances[to_do.id].raster;
        raster.position = to_do.pos;
      }
      break;
    case 'lineDelete':
      removeLine(to_do.id,false);
      break;
    case 'symbolDelete':
      removeImage(to_do.id,false);   // delete is already in records
      break;
    case 'setArea':
      areaInstances[to_do.id] = {rect:to_do.rect};
      if(areasVisible)
        showArea(to_do.id);
      break;
    case 'rename':
      if(to_do.type === 'area')
        nameArea(to_do.name,to_do.id);
      else
        nameImage(to_do.name,to_do.id);
      break;
    case 'move':
      if(to_do.type === 'area')
        moveArea(to_do.rect,to_do.id);
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

function pruneDo(remove_undo) {
  // returned current do record pruned down to minimum actions necessary to repeat result
  // also used for system save.
  // console.log("BEFORE");
  // for(var i in doRecord) {
  //     console.log("#"+i+"="+doRecord[i].action+" to "+doRecord[i].id);
  // }
  var keep_all = false;
  var prunedDo = [];  // a list of relevant do's.
  var ids_found = {};   // action arrays of objects already loaded into pruned list
  var to_do;
  for(var di = doRecordIndex-1; di >= 0; di--) {  // work backwards through do list
    //console.log("Do#"+di);
    to_do = doRecord[di];
    if(keep_all) {
      prunedDo.splice(0,0,to_do);
      continue;
    }
    switch(to_do.type) {
      case 'state':
        prunedDo.splice(0,0,to_do);
        if(di < doRecordIndex-1)
          keep_all = true;
        break;
      case 'symbol':
        if(!imageInstances.hasOwnProperty(to_do.id))
          continue;  // image nolonger exists
        break;
      case 'line':
        if(!lineInstances.hasOwnProperty(to_do.id))
          continue;
        break;
      case 'area':
        if(!areaInstances.hasOwnProperty(to_do.id))
          continue;
        break;
    }
    if(ids_found.hasOwnProperty(to_do.id)) {
      if(ids_found[to_do.id].indexOf(to_do.action) >= 0)
        continue;
      ids_found[to_do.id].push(to_do.action);
    } else {
      ids_found[to_do.id] = [to_do.action];  // this object covered one way or other - NOTE: push will convert everything to string without the + prefix but indexof only works with Strings
    }
    if(remove_undo && to_do.hasOwnProperty('oldValue'))
      delete to_do.oldValue;
    prunedDo.splice(0,0,to_do);
    //console.log("Pruned adding:"+to_do.action + " for:"+to_do.id);
  }
  keep_all = false;
  if(doRecordIndex > 0 && doRecord[doRecordIndex-1].type === 'state')
    keep_all = true;
  for(di = doRecordIndex; di < doRecord.length; di++) {
    // work forwards to look for future states
    //console.log("Do#"+di);
    to_do = doRecord[di];
    if(to_do.type === 'state')
      keep_all = true;
    if(keep_all)
      prunedDo.push(to_do);
  }
  // console.log("AFTER");
  // for(i in prunedDo) {
  //   console.log("#"+i+"="+prunedDo[i].action+" to "+prunedDo[i].id);
  // }
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

function getAreaInstances() {
  console.log("Returning area instances:", Object.keys(areaInstances).length);
  return areaInstances;
}

function getStateInstances() {
  console.log("Returning state instances:", Object.keys(stateInstances).length);
  return stateInstances;
}

function getDoRecord() {
  //console.log("Returning do record:", doRecord.length);
  return doRecord;
}

function getDoIndex() {
  //console.log("Returning do record index:", doRecordIndex);
  return doRecordIndex;
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
      src.center = (roundPoint(dp.rotate(-raster.rotation)))/src.scale;
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
  if(editMode)
    console.log("**EDIT MODE**");
  else
    console.log("**RUN MODE**");
}

function setModalOpen(state) {
  modalOpen = state;
}

function areaSelect() {
  var rect = new Rectangle(roundPoint(areaSelected.segments[0].point),
                           roundPoint(areaSelected.segments[2].point));
  console.log("rect:"+rect);
  if(areasVisible) {
    for(var aid in areaInstances) {
      var a = areaInstances[aid];
      console.log("TopLeft:"+a.rect.topLeft);
      console.log("BottomRight:"+a.rect.bottomRight);
      if(rect.contains(a.rect.topLeft) && rect.contains(a.rect.bottomRight)) {
        if(a.hasOwnProperty('path'))
        selectedItems[aid] = a.path;
        selectedPos[aid] = a.path.position;
        a.path.selected = true;
      }
    }
  }
  for(var id in lineInstances) {
    var l = lineInstances[id];
    if(rect.contains(l.path.firstSegment.point) && rect.contains(l.path.lastSegment.point)) {
      selectedItems[id] = l.path;
      // for lines, the selectedPos is both the start and end to match normal line moves
      selectedPos[id] = [l.path.firstSegment.point.clone(),l.path.lastSegment.point.clone()];
      l.path.selected = true;
    }
  }
  for(var iid in imageInstances) {
    var imgobj = imageInstances[iid];
    var bounds = imgobj.raster.bounds;
    console.log("Bounds"+bounds);
    if(rect.contains(bounds.topLeft) && rect.contains(bounds.bottomRight)) {
      selectedItems[iid] = imgobj.raster;
      selectedPos[iid] = imgobj.raster.position;
      imgobj.raster.selected = true;
    }
  }
  hideArea();
}

// for loading a static js doRecord
function loadDoRec(fname) {
  if(typeof fname === 'undefined')
    fname = "importRecord";
  console.log("Run global function "+fname);
  parseRecord(window.globals[fname]);
}

/* Add meta data to do record from external
   If to_seleted is true then it is added to select instances
   Otherwise a meta event is created with the data
*/
function addMeta(to_selected, meta_data) {
  if(to_selected) {
    var sok = Object.keys(selectedItems);
    if(sok.length > 0) {
      doRecordAdd({action:'addMeta',ids:Object.keys(selectedItems)}+meta_data);
      for(var sid in selectedItems) {
        if(lineInstances.hasOwnProperty(sid)) {
          lineInstances[sid] += meta_data;
        }
        else if(areaInstances.hasOwnProperty(sid)) {
          areaInstances[sid] += meta_data;
        }
        else if(imageInstances.hasOwnProperty(sid)) {
          imageInstances[sid] += meta_data;
        }
      }
    } else
      console.log("No selected items to add meta data to.");
  } else {
    doRecordAdd({action:'addMeta'}+meta_data);
  }
}

function getState() {
  // tricky - do we go to the next state or the previous
  // do we delete anything in between?
}

function setState(state) {
  var id = null;
  if(doRecordIndex > 0) {
    var to_do = doRecord[doRecordIndex-1];
    if(to_do.type === 'state') {  // this position already stated
      id = to_do.id;
      delete doRecord[--doRecordIndex];
    }
  }
  if(!id) {
    if(stateInstances.hasOwnProperty(state.nm)) {
      alert("A state with name " + state.nm + " already exists");
      return;
    }
    id = nextID;
    nextID++;
  }
  var inst = {id:nextID};
  var dorec = {action:'state',id:id,type:'state'};
  for(var k in state) {
    dorec[k] = state[k];
    inst[k] = state[k];
    console.log("State key:"+k+" = "+state[k]);
  }
  stateInstances[state.nm] = inst;
  console.log("Adding state:"+ Object.keys(state));
  doRecordAdd(dorec);  // where state is an object
  return doRecordIndex;
}

function getNextState(start_index) {
  var dorec = scanStateForward(start_index);
  if(!!dorec && stateInstances.hasOwnProperty(dorec.id))
    return stateInstances[dorec.id];
  return null;
}

function scanStateForward(state_point) {
  if(typeof start_index === 'undefined')
    start_index = doRecordIndex;
  for(var di = doRecordIndex; di < doRecord.length; di++) {
    var dorec = doRecord[di];
    if(dorec.type === 'state') {
      console.log("Found state at:"+di);
      return dorec;
    }
  }
  return null;
}

function gotoState(nm,direction,rate) {
  var dorec;
  do {
    dorec = stepState(direction,rate);
  } while(!!dorec && dorec.nm !== nm);
}
/* Go to a particular state

   rate = 1.0 then use dt as per state
   rate = 0.0 then go immediate
   rate = -ve then skip others to start at previous (or next reverse) state
*/
function stepState(direction, rate) {
  // direction = -1 for back or +1 for forward
  console.log("Step state direction:"+direction+" rate:"+rate);
  var steps = 0;
  while((direction < 0 && doRecordIndex > 1) ||
        (direction > 0 && doRecordIndex < doRecord.length)) {
    if(doRecordIndex > 0) {
      var dorec = doRecord[doRecordIndex-1];
      if(dorec.action === 'state') {
        console.log("Just past state:" + dorec.nm);
        if(direction < 0)
          currentStateRate = dorec.dt;
        else {  // scan forward for next state
          var dr = scanStateForward();
          if(!!dr) {
            currentStateRate = dr.dt;
          } else
            currentStateRate = 0.0;
        }
      }
      if(steps > 0)
        return dorec.nm;
    }
    console.log("Step");
    if(direction < 0)
      undo();
    else
      redo();
    steps++;
    console.log("RecordIndex:"+doRecordIndex);
  }
  return null; // to indicate that we failed to find state point
}

// the following is used for adding a loader to a doRec.js include
var doRecLoader = "';\nwindow.globals.importRecord = jdata;\n";
var imgAvailLoader = "';\nwindow.globals.imagesAvailable = idata;\n";

var walkerTree = [];
var imgFileList;

function buildImgAvail(res) {
  var path, subpath;
  if(typeof res === 'undefined') {
    if(window.location.protocol === 'file:') {
      alert("ABORT - Can only generate file list from server");
      return;
    }
    if(typeof nodeComms.sendData !== 'function')  // very odd if this happens
      return;
    // node js storage
    nodeComms.onReply = buildImgAvail;  // recursive call
    path = "";
    imgFileList = [];
  } else {
    console.log("Onreply:"+res);
    if(res.indexOf('500') === 0) {  //starts with error code
      console.log("Report error:"+res);
    } else {
      console.log("attempting to parse json object");
      //try {
        var reply_obj = JSON.parse(res);
        console.log(reply_obj);
        if(reply_obj.type !== 'dir') {
          console.log("Failed to return dir from image list");
          return;
        }
        // always arrives here with a new directory listing
        path = reply_obj.path;
        dir = reply_obj.dir;
        // first record all the files in this directory
        for(var i in dir) {
          if(dir[i].type === 'file') {
            var fo = {src:(path+'/'+dir[i].name)};
            for(var j in importDefaults) {
              if(importDefaults[j] != baseImportDefaults[j])
                fo[j] = importDefaults[j];
            }
            imgFileList.push(fo);  // will use baseImportDefaults unless specified
          }
        }
        // now look for subdirectories
        index = 0;
        walkerTree.push({path:path,dir:dir,index:0});
        while(index >= 0) {
          subpath = null;
          for(i = index; i < dir.length; i++) {
            var fd = dir[i];
            if(fd.type === 'dir') {
              subpath = fd.name;
              walkerTree[walkerTree.length-1].index = i+1;
              break;
            }
          }
          if(!!subpath)
            break;
          if(walkerTree.length === 0) {
              console.log("walker mission complete - "+imgFileList.length + " image found");
            // buildingimgAvail.js
            jdata = "var idata=\n'";
            var json_txt = JSON.stringify(imgFileList);
            for(var c in json_txt) {
              jdata += json_txt[c];
              if(json_txt[c] === '}')
                jdata += '\n';
            }
            jdata += imgAvailLoader;
            var save_data = {command:'save',path:"imgavail.js",data:jdata};
            if(typeof path !== 'undefined')
              postObject.path = path;
            if(typeof subpath !== 'undefined')
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
  console.log("Attempting to list from:" + path +" / "+subpath);
  postObject = {command:'list',xtns:imageExtensions,path:path,subpath:subpath};
  //if(typeof subpath !== 'undefined')
  nodeComms.sendData(JSON.stringify(postObject));
}

// think this needs to be at the bottom so under scripts find things fully loaded
console.log("PaperGlue functions to window globals");
// window global are use for cross scope communications
var exports = {
  init:init,
  appendMenus:appendMenus,
  loadImages:loadImages,
  loadImage:loadImage,
  getImages:getImageInstances,
  getLines:getLineInstances,
  getAreas:getAreaInstances,
  getStates:getStateInstances,
  getDoRecord:getDoRecord,
  getDoIndex:getDoIndex,
  setSnap:setSnap,
  setLineThickness:setLineThickness,
  getLineColor:getLineColor,
  setLineColor:setLineColor,
  setCurrentLineColor:setCurrentLineColor,
  keyHandler:null,
  enableKeyFocus:enableKeyFocus,
  removeAll:removeAll,
  getCurrentContextObject:getCurrentContextObject,
  nameCurrentImage:nameCurrentImage,
  moveCurrentImage:moveCurrentImage,
  scaleCurrentImage:scaleCurrentImage,
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
  setModalOpen:setModalOpen,
  areaSelect:areaSelect,
  loadDoRec:loadDoRec,
  buildRedoTxt:buildRedoTxt,
  saveRecord:saveRecord,
  loadRecord:loadRecord,
  listFiles:listFiles,
  parseRecord:parseRecord,
  addMeta:addMeta,
  setState:setState,
  getNextState:getNextState,
  importDefaults:importDefaults,
};
globals.paperGlue = exports;
paperGlue = globals.paperGlue;  // for dependant modules to add:
// - fileSelector(objective,dir_obj) = a gui to display directories returned by list()
// - closeDialog() = so pressing escape will close any modal dialogs



if(typeof globals.onPaperGlueLoad == 'function')  { // myScript couldn't find loadImages so provided a call to repeat the request
  console.log("PaperGlue loaded now so can use onPaperLoad to load images.");
  console.log(typeof globals.loadImages);
  globals.onPaperGlueLoad();
}
// that was a bit messy and my be avoided if I used requirejs or browserify - though I suspect that paper.js will not like it.
