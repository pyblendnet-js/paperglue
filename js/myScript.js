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

//console.log("innerWidth:"+window.innerWidth);
//console.log("outerWidth:"+window.outerWidth);
//console.log(window.showPaper);
//console.log(myCanvas);
console.log("Starting myScript");
drawStripBoard(10,100,34);
console.log(Object.keys(window));
console.log(Object.keys(window.globals));
console.log(typeof window.globals.loadImages);
if(typeof window.globals.loadImages === 'undefined')  { // means myScript got here first and paperGlue was not ready
  console.log("paperGlue not ready yet to load images.");
  window.globals.onPaperLoad = initImages;  // paperGlue will call this when it is ready
} else {
  console.log("PaperGlue already loaded so can load images.");
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
  //console.log("Layer counter:"+lr._children.length);
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

function createActionTableBody() {
  var q = globals.getDoRecord();
  var ihtml = "";
  for(var qi in q) {
    var dr = q[qi];
    var propstr = "";
    var oks = Object.keys(dr);
    for(var ki in oks) {
      var k = oks[ki];
      if(k == 'action' || k == 'id')
        continue;
      propstr += k + ":" + dr[k] + ";";
    }
    var bl;
    if((qi % 2) === 0)
      bl = 'FF';
    else
      bl = 'C0';
    var rhtml = '<tr style="background-color:#F0F0' + bl + '""><td class="dtd" style="width:100px;border-left:0">'+dr.action+'</td><td class="dtd" style="width:30px;background-color:#FFE0E0">'+dr.id+'</td><td class="dtd" style="border-right:0">'+propstr+'</td></tr>';
    //console.log(rhtml);
    ihtml += rhtml;
  }
  return ihtml;
}

function keyDown(event) {  // note: This is accessed from paperglue.js - not directly
  // added controlPressed,shiftPressed,altPressed as values in event
  // if(event.key == 'control' || event.key == 'shift' || event.key == 'alt')
  //   return;
  console.log(event);
  console.log("myScript received:",event.key);
  if(event.controlPressed) {
    if(event.key == 'q') {
      console.log("cntrlQ");
      event.stopPropagation();
      var ab = document.getElementById("actionTableBody");
      console.log("Actions:"+ab.length);
      ab.innerHTML = createActionTableBody();
      // var lines = globals.getLines();
      // var images = globals.getImages();
      // var paper_screen = {lines:lines,images:images};
      // json_str = JSON.stringify(paper_screen);
      // console.log(json_str);
      var ca = document.getElementById("clientArea");
      var canvasDiv = document.getElementById("canvasDiv");
      var canvas = document.getElementById('myCanvas');
      //var context = canvas.getContext('2d');
      // translate context to center of canvas
      //context.translate(canvas.width / 2, canvas.height / 2);
      // scale y component
      //context.scale(0.5, 0.5);

      canvasDiv.style.height = ca.clientHeight/2 + 'px';
      var ad = document.getElementById("actionTableDiv");
      ad.style.height = ca.clientHeight/2 + 'px';
      ad.style.display = "inline";

      return false;
    }
  }
  return true;
}

function openActionsWindow() {
    var myWindow = window.open("", "Actions") //, "width=200, height=100");
    var ad = document.getElementById("actionTableDiv");
    myWindow.document.write(ad.innerHTML);
    var ab = myWindow.document.getElementById("actionTableBody");
    //console.log("Actions:"+ab.length);
    ab.innerHTML = createActionTableBody();
    var tb = myWindow.document.getElementById("actionTableBodyDiv");
    console.log(tb.attributes);
    var ss = "overflow:scroll;height:1300px;width:100%;overflow:auto;maxHeight:80%;";
    console.log(ss);
    tb.style = ss;
    //tb.style.maxHeight = "400px";
    console.log(tb.attributes);
    console.log(tb.style);
    myWindow.stop();
}

//window.globals.keyhandler = keyDown;  // requests paperglue to pass event here
window.globals.listActions = openActionsWindow;
console.log("GLobals:");
console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
