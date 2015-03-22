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

console.log("PaperGlue functions to window globals");
// window global are use for cross scope communications
window.globals.loadImages = loadImages;
window.globals.getInstances = getInstances();
window.globals.getLines = getLines();

function addImage(source, id) {
  var img = document.createElement("img");
  img.src = source;
  img.id = id;
  img.hidden = true;
  //img.hidden = true;
  var src = document.getElementById("body");
  src.appendChild(img);
}

function imageMouseDown(event) {
  if(rightButtonCheck(event)) {
    console.log("Right button down");
  }
  console.log("image mouse down");
  for(var i in imagesLoaded) {
    var imgobj = imagesLoaded[i];
    if(this == imgobj.raster) {
      if(rightButton) {
        if(imgobj.contextMenu)
          currentContextMenu = imgobj.contextMenu;
          currentContextObject = {imageObject:imgobj,raster:imgobj.raster};  //to match image instance object
          return;
      }
      if(imgobj.dragClone === true) {
        //console.log("Symbol:" + imgobj.symbol);
        imageSelected = imgobj.symbol.place();
        imageSelected.position = this.position;
        imageSelected.scale(0.5);
        imageSelected.onMouseDown = imageMouseDown;
        imageInstances.push({imageObject:imgobj, raster:imageSelected, id:imgobj.instances});
        imgobj.instances += 1;
      }
      return;
    }
  }
  if(rightButton) {
    for(i in imageInstances) {
      var imginst = imageInstances[i];
      if(this == imginst.raster) {
        if(imginst.imageObject.instanceContextMenu)
          currentContextMenu = imginst.imageObject.instanceContextMenu;
          currentContextObject = imginst;
      }
    }
  }
  imageSelected = this;
}

var firstFrame = true;

function frameHandler(event) {
}

function loadImages(images_to_load) {
  while(images_to_load.length > 0) {
    var img = images_to_load.pop();
    imagesLoaded.push(img);
    addImage(img.src,img.id);
    img.raster = new Raster(img.id);
    console.log(img.isSymbol);
    if(img.isSymbol === true) {   // needs true comparison
      img.symbol = new Symbol(img.raster);
      img.raster.remove();  //dont need this cluttering the document
      img.raster = img.symbol.place();
      img.instances = 0;
    }
    if(img.pos) {
      //if(typeof img.pos == 'aper.point')
      console.log("Pos:" + img.pos);
      img.raster.position = img.pos;
    } else  // Move the raster to the center of the view
      img.raster.remove();  //dont need this cluttering the document
    if(img.scale)
      img.raster.scale(image.scale);
    img.raster.onMouseDown = imageMouseDown;
  }
}

function getInstances() {
  return imageInstances;
}

function getLines() {
  return lines;
}

view.on('frame', frameHandler);

function lineMouseDown(event) {
  if(rightButtonCheck(event)) {
    console.log("Right button down");
    return;
  }
  console.log("link mouse down");
  linkSelected = this;
  linkSelectFraction = (event.point - this.segments[0].point).length/this.length;
  console.log("Selected fraction:" + linkSelectFraction);
  console.log("Selected pos:" + linkSelected.position);
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

  if(rightButtonCheck(event)) {
    console.log("Right button down");
    return;
  }

  if(!!linkSelected) {
    console.log("Link selected");
    return;
  }
  console.log("Mouse down");
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
