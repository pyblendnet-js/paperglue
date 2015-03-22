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

var lines = [];
var path;
var linkSelected = null;
var imageSelected = null;
var linkSelectFraction = 0.5;
var snapQuantum = 40;
var rightButton = false;
var imagesLoaded = [];
var imageInstances = [];  //images that have been cloned from sybols in imagesLoaded.
var defaultContextMenu = [ {label:'view', callback:viewCall},{label:'open',callback:openCall} ];
var currentContextMenu = defaultContextMenu;
var currentContextObject = null;
var holdContext = false;  // don't reset contextMenu till after mouseUp


console.log("PaperGlue functions to window globals");
// window global are use for cross scope communications
var globals = window.globals;
globals.loadImages = loadImages;
globals.getInstances = getInstances();
globals.getLines = getLines();

// global hooks for created objects
function getInstances() {
  return imageInstances;
}

function getLines() {
  return lines;
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
          imageSelected = imgobj.symbol.place();
          imageSelected.position = this.position;
          imageSelected.scale(0.5);
          imageSelected.onMouseDown = imageMouseDown;
          imageInstances.push({imageObject:imgobj, raster:imageSelected, id:imgobj.instances});
          imgobj.instances += 1;
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
  linkSelected = this;
  linkSelectFraction = (event.point - this.segments[0].point).length/this.length;
  console.log("Selected fraction:" + linkSelectFraction);
  console.log("Selected pos:" + linkSelected.position);
  return false;
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

function onMouseDown(event) {
  console.log("Basic Mouse down");
  if(rightButtonCheck(event)) {
    console.log("Right button down");
    if(holdContext === false)  // cross browser solution to default mouse up reset
      currentContextMenu = defaultContextMenu;
    return false;
  }
  if(!!linkSelected) {
    console.log("Link selected");
    return false;
  }
  path = new Path();
  path.strokeColor = 'black';
  path.strokeWidth = 10;
  path.strokeCap = 'round';
  path.onMouseDown = lineMouseDown;
}

function onMouseDrag(event) {
  if(rightButton)
    return;
  if(!!linkSelected) {
    console.log("Link selected");
    if(linkSelectFraction < 0.25) {  //drag start of link
      linkSelected.firstSegment.point += event.delta;
    } else if (linkSelectFraction > 0.75) {  // drag end of link
      linkSelected.lastSegment.point += event.delta;
    } else {
      linkSelected.position += event.delta;   // drag whole link
    }
    return;
  } else if(!!imageSelected) {
    imageSelected.position += event.delta;
  } else {
     if(path.segments.length < 2) {
       path.add(event.point);
     } else {
       path.lastSegment.point = event.point;
     }
   }
}

function snap(p) {
  var rp = p.firstSegment.point/snapQuantum;
  p.firstSegment.point = rp.round()*snapQuantum;
  rp = p.lastSegment.point/snapQuantum;
  p.lastSegment.point = rp.round()*snapQuantum;
}

function onMouseUp(event) {
  console.log("Mouse up");
  if(rightButton) {
    rightButton = false;
    return;
  }
  if(!!linkSelected) {
    path = linkSelected;
    snap(linkSelected);
    linkSelected = null;
  } else if(!!imageSelected) {
    var rp = imageSelected.position/snapQuantum;
    imageSelected.position = rp.round()*snapQuantum;
    imageSelected = null;
    return;
  }
  if(path.length > 10) {
    snap(path);
    if(lines.indexOf(path) == -1)  //this path doesn't exist
      lines.push(path);
  } else {
    path.remove();
    if(lines.indexOf(path) != -1)  // this path does exist
      lines.pop(path);
  }
}
