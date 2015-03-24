//note:objects in paperglue are in the paper scope
var paperGlue;  // see initApp below

var wireLinks = [];

var symbolMenu = [ {label:'name', propCall:imgGetNameCall},
                   {label:'size', propCall:imgGetSizeCall},
                   {label:'pos',propCall:imgGetPosCall},
                   {label:'properties',callback:openImgPropDialog},
                   {label:'setCenter',propCall:imgGetCenterCall,callback:setCenterToCursor},
                   {label:'setOrigin',propCall:imgGetOriginCall,callback:setOriginToCursor}
                 ];
var symbolInstanceMenu = [ {label:'name', propCall:imgGetInstanceNameCall},
                           {label:'pos',propCall:imgGetPosCall},
                           {label:'snap',propCall:getSnapModeCall,callback:toggleSnap},
                           {label:'properties',callback:openImgPropDialog} ];
var newAreaMenu = [ {label:'set area#', propCall:getAreaCount, callback:setArea}];
var areaMenu = [ {label:'area', propCall:getAreaNameCall},
                 {label:'rect', propCall:getAreaRectCall},
                 {label:'properties',callback:openAreaPropDialog}];
window.globals.menuLookup = { symbolMenu:symbolMenu,
                              symbolInstanceMenu:symbolInstanceMenu,
                              newAreaMenu:newAreaMenu,
                              areaMenu:areaMenu
                            };
var first_image = {src:"img/con_Block_5.08mm_12.png", scale:0.6, id:"conBlock1", isSymbol:true, dragClone:true, pos:view.center };
var default_image_menus = { contextMenu:"symbolMenu", instanceContextMenu:"symbolInstanceMenu"};
// other parameters:
//   origin = point in image which represents position
//   center = point in image for rotation  e.g , center:[30,0]

console.log("Starting myScript");
drawStripBoard(10,100,34);
//console.log(Object.keys(window));
//console.log(Object.keys(window.globals));
if(typeof window.globals.paperGlue === 'undefined')  { // means myScript got here first and paperGlue was not ready
  console.log("paperGlue not ready yet to init app.");
  window.globals.onPaperGlueLoad = initApp;  // paperGlue will call this when it is ready
} else {
  console.log("PaperGlue already loaded so can init app.");
  initApp();  // paperglue is already ready so can loadImages now
}
// that was a bit messy and my be avoided if I used requirejs or browserify - though I suspect that paper.js will not like it.
// see http://eloquentjavascript.net/10_modules.html on the subject of slow module loads

function initApp() {
  console.log("Initialising application");
  paperGlue = window.globals.paperGlue;  //to access paperGlue commands
  paperGlue.init();  // sets up extra layers
  paperGlue.loadImages([first_image],default_image_menus);
  paperGlue.setSnap([5,5,10,10]);
  paperGlue.showAreas();
}

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

function imgGetSizeCall(obj){
  console.log('get size called');
  console.log("Obj raster keys:"+Object.keys(obj.raster));
  console.log(obj.raster.bounds);
  return new Size(obj.raster.bounds.width,obj.raster.bounds.height);
}

function imgGetInstanceNameCall(obj){
  var nm = "" + obj.src.id + "#" + obj.id;
  if(obj.inst.hasOwnProperty('name'))
    nm += ':'+obj.inst.name;
  return nm;
}

function imgGetPosCall(obj){
  console.log('pos called');
  console.log(Object.keys(obj));
  return obj.raster.position;
}

function getSnapModeCall(obj){
  console.log("GetSnapMode for:"+obj);
  var inst = obj.inst;
  if(inst.hasOwnProperty('snap'))
    return inst.snap;
  return paperGlue.getSnapDefault();
}

function toggleSnap() {
  paperGlue.toggleSnap();
  return true;
}

function imgGetCenterCall(obj){
  console.log('pos called');
  console.log(Object.keys(obj));
  return obj.src.center;
}

function imgGetOriginCall(obj){
  console.log('pos called');
  console.log(Object.keys(obj));
  return obj.src.origin;
}

function createActionTableBody() {
  var q = globals.paperGlue.getDoRecord();
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
      var ca = document.getElementById("clientArea");
      var canvasDiv = document.getElementById("canvasDiv");
      var canvas = document.getElementById('myCanvas');

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
    var myWindow = window.open("", "Actions"); //, "width=200, height=100");
    var ad = document.getElementById("actionTableDiv");
    myWindow.document.write(ad.innerHTML);
    var ab = myWindow.document.getElementById("actionTableBody");
    //console.log("Actions:"+ab.length);
    ab.innerHTML = createActionTableBody();
    var tb = myWindow.document.getElementById("actionTableBodyDiv");
    console.log(tb.attributes);
    var ss = "overflow:scroll;height:"+window.innerHeight+"px;width:100%;overflow:auto;maxHeight:80%;";
    console.log("Style:"+ss);
    tb.style = ss;
    tb.style.maxHeight = "400px";
    console.log(tb.attributes);
    console.log(tb.style);
    myWindow.stop();
}

dragFlag = false;

function mouseDown(e) {
  e.stopPropagation();
  dragFlag = true;
  var rect = this.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
}

function mouseUp(e) {
  e.stopPropagation();
  dragFlag = false;
}

function mouseMove(e) {
  //console.log(e);
  if(dragFlag) {
    this.style.left = (e.clientX-mouseX) + 'px';
    this.style.top = (e.clientY-mouseY) + 'px';
  }
}

function openDialogCommon() {
  paperGlue.enableKeyFocus(false);
  var Dlg = document.getElementById('Overlay');
  Dlg.style.visibility = 'visible';
  Dlg.onmousedown=mouseDown;
  Dlg.onmousemove=mouseMove;
  Dlg.onmouseup=mouseUp;
  paperGlue.setModalOpen(true);  //make dialog modalish
  //Dlg.style.fontSize = fontsize;
  //Dlg.style = "font-size:"+fontsize+"px;visibility:visible;";
}

function openImgPropDialog() {
  openDialogCommon();
  var obj = paperGlue.getCurrentContextObject();
  paperGlue.showImageCursors(obj,false);
  console.log("Opening property dialog:",obj.id);
  console.log("Prop:"+Object.keys(obj));

  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<table ' + fs + '><tr><td>ID</td><td>'+obj.id+'</td></tr>';
  // if(obj.hasOwnProperty('raster')) {
  if(obj.type === 'image') {
    p += '<tr><td>Name</td><td>';
    var nm = obj.id;
    if(obj.inst.hasOwnProperty('name')) {
      nm = obj.inst.name;
    }
    p += '<input '+fs+' id="name" type="text" value="'+nm+'"/></td></tr>';
  } // otherwise symbol
  p += '<tr><td>X</td><td>';
  p += '<input '+fs+' id="xpos" type="number" value="'+obj.raster.position.x+'"/></td></tr>';
  p += '<tr><td>Y</td><td>';
  p += '<input '+fs+' id="ypos" type="number" value="'+obj.raster.position.y+'"/></td></tr>';
  p += '<tr><td>Rot</td><td>';
  p += '<input '+fs+' id="rot" type="number" value="'+obj.raster.rotation+'"/></td></tr>';
  //}
  // var ks = Object.keys(obj);
  // for(var ki in ks ) {
  //   var k = ks[ki];
  //   p += '<tr><td>'+k+'</td><td>'+obj[k]+'</td></tr>';
  // }
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  return false;  //do not hide cursors yet
}

function dialogReturn(reply) {
  var obj = paperGlue.getCurrentContextObject();
  console.log("Object type:" + obj.type);
  if(obj.type === 'area') {
    areaDialogReturn(reply);
    return;
  }
  // otherwise hope this is an image or symbol
  var nmfield = document.getElementById('name');
  var xfield = document.getElementById('xpos');
  var yfield = document.getElementById('ypos');
  var rfield = document.getElementById('rot');
  var x = parseFloat(xfield.value);
  var y = parseFloat(yfield.value);
  var r = parseFloat(rfield.value);
  //console.log("X:"+x);
  if(reply !== 'cancel') {
    if(!!nmfield) {
      var name = nmfield.value;
      console.log("New name:"+name);
      paperGlue.nameCurrentImage(name);
    }
    paperGlue.moveCurrentImage(x,y,r);
  }
  paperGlue.hideCursor();
  if(reply === 'apply') {
    paperGlue.showImageCursors(obj,false);
    return;
  }
  paperGlue.setModalOpen(false);
  paperGlue.enableKeyFocus(true);
}

function setCenterToCursor() {
  paperGlue.setCenterToCursor();
}

function setOriginToCursor() {
  paperGlue.setOriginToCursor();
}

function getAreaCount() {
  return paperGlue.getAreaCount();
}

function setArea() {
  paperGlue.setArea();
}

function getAreaNameCall(obj){
  console.log('get name called');
  var nm = "" + obj.id;
  if(obj.inst.hasOwnProperty('name'))
    nm += ":" + obj.inst.name;
  return nm;
}

function getAreaRectCall(obj){
  console.log("areaRect:" + Object.keys(obj));
  return obj.inst.rect;
}

function openAreaPropDialog() {
  openDialogCommon();
  var fontsize = window.innerWidth/80;
  var obj = paperGlue.getCurrentContextObject();
  console.log("Opening property dialog:",obj.id);
  console.log("Prop:"+Object.keys(obj));
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<table ' + fs + '><tr><td>ID</td><td>'+obj.id+'</td></tr>';
  var a = obj.inst;
    p += '<tr><td>Name</td><td>';
    var nm = obj.id;
    if(a.hasOwnProperty('name'))
      nm = a.name;
    p += '<input '+fs+' id="name" type="text" value="'+nm+'"/></td></tr>';
    p += '<tr><td>X</td><td>';
    p += '<input '+fs+' id="xpos" type="number" value="'+a.rect.x+'"/></td></tr>';
    p += '<tr><td>Y</td><td>';
    p += '<input '+fs+' id="ypos" type="number" value="'+a.rect.y+'"/></td></tr>';
    p += '<tr><td>W</td><td>';
    p += '<input '+fs+' id="width" type="number" value="'+a.rect.width+'"/></td></tr>';
    p += '<tr><td>H</td><td>';
    p += '<input '+fs+' id="height" type="number" value="'+a.rect.height+'"/></td></tr>';
  //}
  // var ks = Object.keys(obj);
  // for(var ki in ks ) {
  //   var k = ks[ki];
  //   p += '<tr><td>'+k+'</td><td>'+obj[k]+'</td></tr>';
  // }
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  return false;  //do not hide cursors yet
}

function areaDialogReturn(reply) {
  var name = document.getElementById('name').value;
  var xfield = document.getElementById('xpos');
  var yfield = document.getElementById('ypos');
  var wfield = document.getElementById('width');
  var hfield = document.getElementById('height');
  var x = parseFloat(xfield.value);
  var y = parseFloat(yfield.value);
  var w = parseFloat(wfield.value);
  var h = parseFloat(hfield.value);
  //console.log("X:"+x);
  if(reply !== 'cancel') {
    paperGlue.changeAreaName(name);  // beware name is volitile
    paperGlue.moveCurrentArea(new Rectangle(x,y,w,h));
    if(reply === 'apply')
      return;
  }
  paperGlue.setModalOpen(false);
  paperGlue.enableKeyFocus(true);
}


//window.globals.keyhandler = keyDown;  // requests paperglue to pass event here
window.globals.listActions = openActionsWindow;
window.globals.dialogReturn = dialogReturn;
//console.log("Globals:");
//console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
