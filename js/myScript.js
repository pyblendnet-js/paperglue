//note:objects in paperglue are in the paper scope

var wireLinks = [];

var objectMenu = [ {label:'name', propCall:imgGetNameCall},{label:'pos',propCall:imgGetPosCall} ];
var objectInstanceMenu = [ {label:'name', propCall:imgGetInstanceNameCall},{label:'pos',propCall:imgGetPosCall} ];
var first_image = {src:"img/con_Block_5.08mm_12.png", id:"conBlock1", isSymbol:true, dragClone:true, contextMenu:objectMenu, instanceContextMenu:objectInstanceMenu, pos:view.center };
//
// var oldOnLoad = window.globals.onload;
// console.log("Settings window.globals");
// window.globals.onload = function() {
//   console.log("Loading images");
//   // if there is not any function hooked to it
//   if (typeof oldOnLoad != 'function')
//       oldOnLoad();
//   console.log("Loading images");
//   imagesToLoad.push(first_image);
//   loadImages();
// };

//view.on('frame', frameHandler);

console.log(window.innerWidth);
console.log(window.outerWidth);
//console.log(window.showPaper);
//console.log(myCanvas);
drawStripBoard(10,100,34);
console.log(Object.keys(window));
console.log(Object.keys(window.globals));
console.log(typeof window.globals.loadImages);
if(typeof window.globals.loadImages === 'undefined')  { // means myScript got here first and paperGlue was not ready
  console.log("paperGlue not ready yet to load images.")
  window.globals.onPaperLoad = initImages();  // paperGlue will call this when it is ready
} else {
  console.log("PaperGlue already loaded so can load images.")
  initImages();  // paperglue is already ready so can loadImages now
}
// that was a bit messy and my be avoided if I used requirejs or browserify - though I suspect that paper.js will not like it.
// see http://eloquentjavascript.net/10_modules.html on the subject of slow module loads


function initImages() {
  window.globals.loadImages([first_image]);
}
//window.globals.init = myScriptInit;

//
// window.onload = function() {
//   console.log("Window loaded");
// };
//
// window.onshow = function() {
//   console.log("Window Show");
// };

function drawGrid(spacing) {
  var l;
  for(var y = 0; y < myCanvas.height; y += spacing) {
    l = new Path();
    l.strokeColor = '#e0e0e0';
    l.add([0,y],[myCanvas.width,y]);
  }
  for(var x = 0; x < myCanvas.width; x += spacing) {
    l = new Path();
    l.strokeColor = '#e0e0e0';
    l.add([x,0],[x,myCanvas.height]);
  }
}

function drawStripBoard(spacing,length,width) {
  var l;
  var vh = width*spacing;
  var vw = (length+1)*spacing;
  var path = new Path.Circle([0,0], spacing*0.2);
  path.fillColor = 'white';
  var hole = new Symbol(path);
  for(var y = spacing/2; y < vh; y += spacing) {
    l = new Path();
    l.strokeColor = '#e0e0e0';
    l.strokeWidth = spacing*0.8;
    l.add([0,y],[vw,y]);
    for(var x = spacing/2; x < vw; x += spacing) {
      hole.place([x,y]);
    }
  }
  var lr = project.layers[0];
  console.log(lr._children.length);
  var top_layer = lr.rasterize();
  lr.removeChildren();
  lr.addChild(top_layer);
}

function imgGetNameCall(obj){
  console.log('get name called');
  return obj.src.id;
}

function imgGetInstanceNameCall(obj){
  console.log('get name called');
  return "" + obj.src.id + "#" + obj.id;
}

function imgGetPosCall(obj){
  console.log('pos called');
  return obj.raster.position;
}

function onKeyDown(event) {
  if(event.key == 'control' || event.key == 'shift' || event.key == 'alt')
    return;
  console.log(event);
  console.log("myScript received:",event.key);
  if(event.modifiers.control) {
    if(event.key == 's') {
      console.log("cntrlS");
      event.stopPropagation();

      var lines = globals.getLines();
      var images = globals.getImages();
      var paper_screen = {lines:lines,images:images};
      json_str = JSON.stringify(paper_screen);
      console.log(json_str);
      return false;
    }
  }
  return true;
}

window.globals.keyhandler = onKeyDown;  // requests paperglue to pass event here
