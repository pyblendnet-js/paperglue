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
var lineInstanceMenu = [ {label:'color', propCall:lineGetColor, callback:setLineColor}];
var newAreaMenu = [ {label:'set area#', propCall:getAreaCount, callback:setArea},
                    {label:'select', callback:areaSelect }];
var areaMenu = [ {label:'name', propCall:getAreaNameCall},
                 {label:'rect', propCall:getAreaRectCall},
                 {label:'properties',callback:openAreaPropDialog}];
window.globals.menuLookup = { symbolMenu:symbolMenu,
                              symbolInstanceMenu:symbolInstanceMenu,
                              lineInstanceMenu:lineInstanceMenu,
                              newAreaMenu:newAreaMenu,
                              areaMenu:areaMenu
                            };
var defaultMenuAddendum = [
  {label:'list in new tab',callback:openActionsWindow},
  {label:'json in new tab',callback:openJSONWindow},
  {label:'  js in new tab',callback:openJSWindow},
  {label:'import dorec.js',callback:loadDoRec}
];

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
  paperGlue.loadImages([],default_image_menus);  //first_image
  paperGlue.setSnap([5,5,10,10]);
  paperGlue.showAreas();
  for(var i in defaultMenuAddendum)
    paperGlue.addToDefaultMenu(defaultMenuAddendum[i]);
  paperGlue.closeDialog = closeDialog;
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
  //console.log('get name called');
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
  var dri = globals.paperGlue.getDoIndex();
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
    var vl;
    if(qi < dri)
      vl = 'FF';
    else
      vl = 'C0';
    var rhtml = '<tr style="background-color:#F0'+vl+bl + '"><td class="dtd" style="width:100px;border-left:0">'+dr.action+'</td><td class="dtd" style="width:30px;background-color:#E0'+vl+bl+'">'+dr.id+'</td><td class="dtd" style="border-right:0">'+propstr+'</td></tr>';
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
    //console.log(tb.attributes);
    var ss = "overflow:scroll;height:"+window.innerHeight+"px;width:100%;overflow:auto;maxHeight:80%;";
    //console.log("Style:"+ss);
    tb.style = ss;
    tb.style.maxHeight = "400px";
    //console.log(tb.attributes);
    //console.log(tb.style);
    myWindow.stop();
}

function openJSONWindow() {
  openRecordWindow(true,false);
}

function openJSWindow() {
  openRecordWindow(false,true);
}

/* generate a browser page which can be saved as a js file for
   inclusion in a paperglue project.
*/
function openRecordWindow(beautify,include_loader) {
    var myWindow = window.open("", "Actions"); //, "width=200, height=100");
    //var q = globals.paperGlue.getDoRecord();
    //var dri = globals.paperGlue.getDoIndex();
    var txt = "";
    txt = "";
    if(include_loader)
      txt += "var jdata='";
    else
      txt += "<html><body><pre>";
    txt += buildRedoData(beautify);
    if(include_loader) {
      txt += "';\n";
      txt += "function getRecord() {\n\t"+
             "return jdata;\n}\n";
      txt += "window.globals.importRecord = getRecord;\n";
    } else {
      txt += "</pre></body></html>";
    }
    myWindow.document.write(txt);
    myWindow.stop();
}

function buildRedoData(beautify) {
  // made sort of JSON beautifier but may not use
    var txt = "";
    var json_txt = paperGlue.buildRedoData();
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
          //case '[':
          //  lt[bl++] = 1;
          //  break;
          //case ']':
          //  bl--;
          //  break;
        }
        if(lc === ',') {
          //if(col > 80 || llc === '}' || llc === ']')
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
    return txt;
}

function loadDoRec() {
  paperGlue.loadStaticRec("importRecord");
}

var tempMouseUp;
var dialogDiv;
var idRow;

function mouseDown(e) {
  e.stopPropagation();
  //dragFlag = true;
  idRow = this;
  this.onmousemove = mouseMove;
  var bdy = document.getElementById('body');
  tempMouseup = bdy.onmouseup;
  bdy.onmouseup = mouseUp;
  var rect = this.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
}

function mouseUp(e) {
  e.stopPropagation();
  idRow.onmousemove = null;
  this.onmouseup = tempMouseup;
}

function mouseMove(e) {
  dialogDiv.style.left = (e.clientX-mouseX) + 'px';
  dialogDiv.style.top = (e.clientY-mouseY) + 'px';
  //console.log('Move');
}

function openDialogCommon(show_reply_buttons) {
  var rb = document.getElementById('replyButtons');
  if(typeof show_reply_buttons === 'undefined' || show_reply_buttons)
    rb.style.display = 'inline';
  else
    rb.style.display = 'none';
  paperGlue.enableKeyFocus(false);
  dialogDiv = document.getElementById('Overlay');
  dialogDiv.style.visibility = 'visible';
  paperGlue.setModalOpen(true);  //make dialog modalish
  //dialogDiv.style.fontSize = fontsize;
  //dialogDiv.style = "font-size:"+fontsize+"px;visibility:visible;";
}

function closeDialog() {
  dialogDiv.style.visibility = 'hidden';
  paperGlue.setModalOpen(false);
  paperGlue.enableKeyFocus(true);
}

function openDialogPropCommon(id) {
  openDialogCommon();
  console.log("Opening property dialog:",id);
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<table ' + fs + '><tr id="idRow"><td>ID</td><td>'+id+'</td></tr>';
  return p;
}

function setDialogMove(id) {
  var row = document.getElementById(id);
  row.onmousedown=mouseDown;
}

function openImgPropDialog() {
  var obj = paperGlue.getCurrentContextObject();
  paperGlue.showImageCursors(obj,false);
  var p = openDialogPropCommon(obj.id);
  if(obj.type === 'symbol') {
    p += '<tr><td>Name</td><td>';
    var nm = obj.src.id + "#" + obj.id;
    if(obj.inst.hasOwnProperty('name')) {
      nm = obj.inst.name;
    }
    p += '<input id="name" type="text" value="'+nm+'"/></td></tr>';
  } // otherwise symbol
  p += '<tr><td>X</td><td>';
  p += '<input id="xpos" type="number" value="'+obj.raster.position.x+'"/></td></tr>';
  p += '<tr><td>Y</td><td>';
  p += '<input id="ypos" type="number" value="'+obj.raster.position.y+'"/></td></tr>';
  p += '<tr><td>Rot</td><td>';
  p += '<input id="rot" type="number" value="'+obj.raster.rotation+'"/></td></tr>';
  //}
  // var ks = Object.keys(obj);
  // for(var ki in ks ) {
  //   var k = ks[ki];
  //   p += '<tr><td>'+k+'</td><td>'+obj[k]+'</td></tr>';
  // }
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  setDialogMove("idRow");
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
  var nmfield = null;
  if(obj.type === 'symbol')
    nmfield = document.getElementById('name');
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

function areaSelect() {
  paperGlue.areaSelect();
}

function getAreaCount() {
  return paperGlue.getAreaCount();
}

function setArea() {
  paperGlue.setArea();
}

function getAreaNameCall(obj){
  console.log('get name called');
  var nm = "Area#" + obj.id;
  if(obj.inst.hasOwnProperty('name'))
    nm += ":" + obj.inst.name;
  return nm;
}

function getAreaRectCall(obj){
  //console.log("areaRect:" + Object.keys(obj));
  return obj.inst.rect;
}

function openAreaPropDialog() {
  var obj = paperGlue.getCurrentContextObject();
  var p = openDialogPropCommon(obj.id);
  var a = obj.inst;
  p += '<tr><td>Name</td><td>';
  var nm = "area#" + obj.id;
  if(a.hasOwnProperty('name'))
    nm = a.name;
  p += '<input id="name" type="text" value="'+nm+'"/></td></tr>';
  p += '<tr><td>X</td><td>';
  p += '<input id="xpos" type="number" value="'+a.rect.x+'"/></td></tr>';
  p += '<tr><td>Y</td><td>';
  p += '<input id="ypos" type="number" value="'+a.rect.y+'"/></td></tr>';
  p += '<tr><td>W</td><td>';
  p += '<input id="width" type="number" value="'+a.rect.width+'"/></td></tr>';
  p += '<tr><td>H</td><td>';
  p += '<input id="height" type="number" value="'+a.rect.height+'"/></td></tr>';
  //}
  // var ks = Object.keys(obj);
  // for(var ki in ks ) {
  //   var k = ks[ki];
  //   p += '<tr><td>'+k+'</td><td>'+obj[k]+'</td></tr>';
  // }
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  setDialogMove('idRow');
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

function lineGetColor(obj) {
  var lc = paperGlue.getLineColor(obj.id);
  for(var c in ega) {
    var nc = ega[c];
    if(nc === lc)
      return c;
  }
  return lc;
}

var ega = { black:'#000000',
            brown:'#B08000',
            red:'#FF0000',
            orange:'#FFA000',
            yellow:'#FFFF00',
            green:'#40FF40',
            blue:'#4040FF',
            violet:'#FF00FF',
            grey:'#808080',
            white:'#FFFFFF' };

function setLineColor() {
  openDialogCommon(false);
  var fontsize = window.innerWidth/80;
  console.log("Opening color select dialog");
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<table ' + fs + '>';

  var f = 'white';
  for(var c in ega) {
    var cf = "setCurrentLineColor('"+ega[c]+"')";
    p += '<tr><td><button style="color:'+f+';background-color:'+ega[c]+'" onclick="'+cf+'">'+c+'</button></td></tr>';
    f = 'black';
  }
  p += '</table>';
  //console.log(p);
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  return false;  //do not hide cursors yet
}

//window.globals.keyhandler = keyDown;  // requests paperglue to pass event here
window.globals.listActions = openActionsWindow;
window.globals.dialogReturn = dialogReturn;
//console.log("Globals:");
//console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
