var wireLinks = [];
var path;
var linkSelected = null;
var imageSelected = null;
var linkSelectFraction = 0.5;
var snapQuantum = 40;
var rightButton = false;

var first_image = {src:"img/verodes.png", id:"verodes", clone:true };

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
    return;
  }
  console.log("image mouse down");
  if(this == first_image.raster) {
    console.log("Symbol:" + first_image.symbol);
    imageSelected = first_image.symbol.place();
    imageSelected.position = this.position;
    imageSelected.scale(0.5);
    imageSelected.onMouseDown = imageMouseDown;
  } else {
    imageSelected = this;
  }
}

var firstFrame = true;

function frameHandler(event) {
  if(firstFrame) {
    console.log("First Frame");
    firstFrame = false;
    addImage(first_image.src,first_image.id);
    first_image.raster = new Raster(first_image.id);
    first_image.symbol = new Symbol(first_image.raster);
    first_image.raster.remove();
    first_image.raster = first_image.symbol.place();
    // Move the raster to the center of the view
    first_image.raster.position = view.center;
    // Scale the raster by 50%
    first_image.raster.scale(0.5);
    first_image.raster.onMouseDown = imageMouseDown;
  }
}

view.on('frame', frameHandler);

function linkMouseDown(event) {
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

function onContextMenu() {
  console.log("Call for context menu");
  return false;
}

// from http://www.codeproject.com/Tips/630793/Context-Menu-on-Right-Click-in-Webpage
function ShowMenu(control, e) {
  var posx = e.clientX +window.pageXOffset +'px'; //Left Position of Mouse Pointer
  var posy = e.clientY + window.pageYOffset + 'px'; //Top Position of Mouse Pointer
  document.getElementById(control).style.position = 'absolute';
  document.getElementById(control).style.display = 'inline';
  document.getElementById(control).style.left = posx;
  document.getElementById(control).style.top = posy;
}
function HideMenu(control) {

  document.getElementById(control).style.display = 'none';
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
  path.onMouseDown = linkMouseDown;
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
    if(wireLinks.indexOf(path) == -1)
      wireLinks.push(path);
  } else {
    path.remove();
    if(wireLinks.indexOf(path) != -1)
      wireLinks.pop(path);
  }
}
