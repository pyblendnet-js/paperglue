//note:objects in paperglue are in the paper scope
var paperGlue;  // see initApp below

var wireLinks = [];

var symbolMenu = [ {label:'name', propCall:imgGetNameCall},
                   {label:'pos',propCall:imgGetPosCall},
                   {label:'size', propCall:imgGetSizeCall},
                   {label:'snap',propCall:getSnapModeCall,callback:toggleSnap},
                   {label:'drag',propCall:getDragModeCall,callback:toggleDrag},
                   {label:'properties',callback:openImgPropDialog},
                   {label:'setCenter',propCall:imgGetCenterCall,callback:setCenterToCursor},
                   {label:'setOrigin',propCall:imgGetOriginCall,callback:setOriginToCursor},
                   {label:'remove',callback:objRemove}
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

// paperGlue will be looking for the following menus
window.globals.menuLookup = { symbolMenu:symbolMenu,
                              symbolInstanceMenu:symbolInstanceMenu,
                              lineInstanceMenu:lineInstanceMenu,
                              newAreaMenu:newAreaMenu,
                              areaMenu:areaMenu
                            };
var exportMenu = [
  {label:'list in new tab',callback:openActionsWindow},
  {label:'json in new tab',callback:openJSONWindow},
  {label:'  js in new tab',callback:openJSWindow},
];
var stateMenu = [
  {label:'set state',callback:setNewState},
  {label:'forward to state',callback:forwardToState},
  {label:'skip to state',callback:skipToState},
];
var optionsMenu = [
  {label:'import defaults',callback:openImgLoadDefaultDialog}
];

// menus to append keys must match the label for the desired submenu
// special case is defaultContextMenu
// tree by using underline eg. menu_submenu
menusToAppend = {
  export:exportMenu,
  options:optionsMenu,
  state:stateMenu
};

var defaultMenuAddendum = [
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
  paperGlue.appendMenus(menusToAppend);
  paperGlue.showAreas();
  paperGlue.closeDialog = closeDialog;
  paperGlue.fileSelector = fileSelectorDialog;
  loadDoRec();
  paperGlue.setEditMode(false);  // begin in run mode
  console.log("Press SHIFT ESC to exit run mode");
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
  lr.removeChildren();  // too many children slows things down
  lr.addChild(top_layer);  // now stripboard is one child
}

function imgGetNameCall(obj){
  //console.log('get name called');
  return obj.src.id;
}

function imgGetSizeCall(obj){
  //console.log('get size called');
  //console.log("Obj raster keys:"+Object.keys(obj.raster));
  //console.log(obj.raster.bounds);
  var rs= "W:"+Math.round(obj.raster.bounds.width)+" H:"+Math.round(obj.raster.bounds.height);
  if(obj.hasOwnProperty('src')) {
    if(obj.src.hasOwnProperty('scale') && obj.scale !== 1.0)
      rs +=" @ Scale:"+obj.src.scale;
  }
  return rs;
}

function imgGetInstanceNameCall(obj){
  var nm = "" + obj.src.id + "#" + obj.id;
  if(obj.inst.hasOwnProperty('name'))
    nm += ':'+obj.inst.name;
  return nm;
}

function roundPoint(p) {
  return "X:"+Math.round(p.x)+
         " Y:"+Math.round(p.y);
}

function imgGetPosCall(obj){
  console.log('pos called');
  console.log(Object.keys(obj));
  return roundPoint(obj.raster.position);
}

function objRemove(obj){
  console.log("remove called");
  paperGlue.delCurrentContextObject();
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

function getDragModeCall(obj){
  console.log("GetSnapMode for:"+obj);
  if(obj.src.hasOwnProperty('dragClone'))
    return obj.src.dragClone;
  return paperGlue.getDragDefault();
}

function toggleDrag() {
  paperGlue.toggleDrag();
  return true;
}

function imgGetCenterCall(obj){
  //console.log('pos called');
  //console.log(Object.keys(obj));
  return roundPoint(obj.src.center);
}

function imgGetOriginCall(obj){
  //console.log('pos called');
  //console.log(Object.keys(obj));
  return roundPoint(obj.src.origin);
}

function createActionTableBody() {
  var q = paperGlue.getDoRecord();
  var dri = paperGlue.getDoIndex();
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

var recordWindow = null;

/* generate a browser page which can be saved as a js file for
   inclusion in a paperglue project.
*/
function openRecordWindow(beautify,include_loader) {
    if(recordWindow)
      recordWindow.close();
    recordWindow = window.open("", "doRecord"); //, "width=200, height=100");
    //var q = globals.paperGlue.getDoRecord();
    //var dri = globals.paperGlue.getDoIndex();
    var txt = "";
    txt = "";
    if(!include_loader)
      txt += "<html><body><pre>";
    txt += paperGlue.buildRedoTxt(beautify,include_loader);
    if(!include_loader) {
      txt += "</pre></body></html>";
    }
    recordWindow.document.write(txt);
    recordWindow.stop();
}

function loadDoRec() {
  paperGlue.loadDoRec();
}

var tempMouseUp;
var dialogDiv;
var idRow;
var dialogType = "unknown";

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

function openDialogCommon(reply_buttons) {
  var rb = document.getElementById('DlgReplyButtons');
  if(typeof reply_buttons === 'undefined' || reply_buttons.length === 0)
    rb.style.display = 'none';
  else {
    rb.style.display = 'inline';
    var p = "";
    for(var bi in reply_buttons) {
      var bn = reply_buttons[bi];
      var bns = "'"+bn+"'";
      p += '<input type="button" value="'+bn+'" onclick="myScriptCmd('+"'dialogReturn',"+bns+')" />';
      console.log("Dialog button html:"+p);
    }
    rb.innerHTML = p;
  }
  paperGlue.enableKeyFocus(false);
  dialogDiv = document.getElementById('Dialog');
  dialogDiv.style.visibility = 'visible';
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  dialogDiv.style.fontSize = fontsize+'px';
  paperGlue.setModalOpen(true);  //make dialog modalish
  //dialogDiv.style.fontSize = fontsize;
  //dialogDiv.style = "font-size:"+fontsize+"px;visibility:visible;";
}

function closeDialog() {
  dialogDiv.style.visibility = 'hidden';
  paperGlue.setModalOpen(false);
  paperGlue.enableKeyFocus(true);
  dialogType = "unknown";  // force caller to set this
}

function openDialogPropCommon(id) {
  dialogType = 'obj_prop';
  openDialogCommon(['Apply','Ok','Cancel']);
  console.log("Opening property dialog:",id);
  var p = '<table><tr id="idRow"><td>ID</td><td>'+id+'</td></tr>';
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
  if(obj.type !== 'symbol') {
    p += '<tr><td>Scale</td><td>';
    p += '<input id="scale" type="text" value="'+obj.src.scale+'"/></td></tr>';
  }
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
  switch(dialogType) {
    case 'obj_prop':
      propDialogReturn(reply);
      break;
    case 'img_default':
      imgLoadDefaultDialogReturn(reply);
      break;
    case 'set_state':
      setStateDialogReturn(reply);
      break;
    case 'select_state':
      selectStateDialogReturn(reply);
      break;
    case 'file_select':
      fileSelectReturn(reply);
      break;
    default:
      console.log("Unknown dialog type:"+dialogType);
      break;
  }
}

function propDialogReturn(reply) {
  if(reply === 'Cancel') {
    paperGlue.hideCursor();
    closeDialog();
    return;
  }
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
  if(obj.type !== 'symbol') {
    var sfield = document.getElementById('scale');
    var s = parseFloat(sfield.value);
    if(obj.src.scale != s) {
      paperGlue.scaleCurrentImage(s);
    }
  }
  var x = parseFloat(xfield.value);
  var y = parseFloat(yfield.value);
  var r = parseFloat(rfield.value);
  //console.log("X:"+x);
  if(!!nmfield) {
    var name = nmfield.value;
    console.log("New name:"+name);
    paperGlue.nameCurrentImage(name);
  }
  paperGlue.moveCurrentImage(x,y,r);
  if(reply === 'Apply') {
    paperGlue.showImageCursors(obj,false);
    return;
  }
  paperGlue.hideCursor();
  closeDialog();
}

function setCenterToCursor() {
  paperGlue.setCenterToCursor();
}

function setOriginToCursor() {
  paperGlue.setOriginToCursor();
}

function openImgLoadDefaultDialog() {
  openDialogCommon(['Okay','Cancel']);
  dialogType = 'img_default';
  console.log("Opening image load default dialog");
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<div id="imgLoadOptionsTitle">Default Image Load Options</div>';
  p += '<table ' + fs + '>';
  p += '<tr><td>Scale</td><td>';
  p += '<input id="imgscale" type="text" value="'+paperGlue.importDefaults.scale+'"/></td></tr>';
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  setDialogMove("imgLoadOptionsTitle");
  return false;  //do not hide cursors yet
}

function imgLoadDefaultDialogReturn(reply) {
  if(reply !== 'Cancel') {
    var sfield = document.getElementById('imgscale');
    paperGlue.importDefaults.scale = parseFloat(sfield.value);
  }
  closeDialog();
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
  if(reply === 'Cancel') {
    closeDialog();
    return;
  }
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
  paperGlue.changeAreaName(name);  // beware name is volitile
  paperGlue.moveCurrentArea(new Rectangle(x,y,w,h));
  if(reply === 'Apply')
    return;
  closeDialog();
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
  openDialogCommon();
  var fontsize = window.innerWidth/80;
  console.log("Opening color select dialog");
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<table ' + fs + '>';

  var f = 'white';
  for(var c in ega) {
    var cf = "myScriptCmd('setCurrentLineColor','"+ega[c]+"')";
    p += '<tr><td><button style="color:'+f+';background-color:'+ega[c]+'" onclick="'+cf+'">'+c+'</button></td></tr>';
    f = 'black';
  }
  p += '</table>';
  //console.log(p);
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  return false;
}

function setCurrentLineColor(c) {
  window.globals.paperGlue.setCurrentLineColor(c);
  closeDialog();
  //var Dlg = document.getElementById('Dialog');
  //Dlg.style.visibility = 'hidden';
  //window.globals.paperGlue.setModalOpen(false);
  //window.globals.paperGlue.enableKeyFocus(true);
}

var nextStateID = 0;

function setNewState() {
  var state = paperGlue.getCurrentState();
  if(!state) {
    state = {id:paperGlue.getNextID(),
                name:"state#"+nextStateID};
    console.log("Create new state of name:"+state.name);
    nextStateID++;
  } else {
    if(state.hasOwnProperty("name"))
      console.log("Found state of name:"+state.name);
    if(state.hasOwnProperty("clearFlag"))
      console.log("ClearFlag:"+state.clearFlag);
  }
  setStateDialog(state);
}

function setStateDialog(state) {
  dialogType = 'set_state';
  openDialogCommon(['Okay','Cancel']);
  console.log("Opening set state dialog");
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<table ' + fs + '>';
  p += '<tr id="idRow"><td>ID</td><td>'+state.id+'</td></tr>';
  p += '<tr><td>State Name</td><td>';
  p += '<input id="statename" type="text" value="'+state.name+'"/></td></tr>';
  if(!state.hasOwnProperty('dt'))
    state.dt = 0;
  p += '<tr><td>DeltaTime</td><td>';
  p += '<input id="deltatime" type="number" value="'+state.dt+'"/></td></tr>';
  p += '<tr><td>Clear After</td><td>';
  var clearFlag = "";
  if(state.hasOwnProperty('clearFlag') && state.clearFlag)
    clearFlag = 'checked="true"';
  p += '<input id="clearflag" type="checkbox"'+clearFlag+'/></td></tr>';
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  setDialogMove("idRow");
  return false;
}

function setStateDialogReturn(reply) {
  var nfield = document.getElementById('statename');
  var name = nfield.value;
  var tfield = document.getElementById('deltatime');
  var dt = parseFloat(tfield.value);
  var cfield = document.getElementById('clearflag');
  var clearFlag = cfield.checked;
  if(reply !== 'Cancel') {
    var state = {name:name};
    if(dt !== 0)
      paperGlue.dt = dt;
    if(clearFlag)
      state.clearFlag = clearFlag;
    paperGlue.setState(state);
  }
  paperGlue.hideCursor();
  if(reply === 'Apply') {
    return;
  }
  //paperGlue.setModalOpen(false);
  //paperGlue.enableKeyFocus(true);
  closeDialog();
}

var stateSkipMode;

function forwardToState() {
  stateSkipMode = false;
  selectStateDialog(paperGlue.getNextState());
}

function skipToState() {
  stateSkipMode = true;
  selectStateDialog(paperGlue.getNextState());
}

function selectStateDialog(def_state) {
  var states = paperGlue.getStates();
  var states_count = Object.keys(states).length;
  console.log("Currently " + states_count + " states");
  dialogType = 'select_state';
  openDialogCommon();
  console.log("Opening select state dialog");
  // var state = def_state;
  // if(!state) {
  //   console.log("No state given for default target so going to start");
  //   state = paperGlue.getNextState(0);
  // }
  //console.log("Default to state"+state.name);
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<h2 id="state_select_heading">State Selector</h2>';
  var cf = "myScriptCmd('stateSelected',this.value)";
  p += '<div><select ' + fs + 'id="state_select" onchange="' + cf + '"></select></div>';
  // p += '<table' + fs + '>';
  // if(state.hasOwnProperty("dt"))
  //   p += '<tr><td>DeltaTime</td><td>'+state.dt+'</td></tr>';
  // p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  var ss = document.getElementById("state_select");
  //fs.style.display = "inline";
  ss.length = 0;  // may hang for very long lists - see: http://www.somacon.com/p542.php
  if(stateSkipMode) {
    var doption = document.createElement("option");
    doption.text = "START";
    doption.value = 0;
    ss.add(doption);
  }
  for(var i in states) {
    state = states[i].state;
    var option = document.createElement("option");
    option.text = state.name + " @ " + states[i].index;
    // option.onclick = fileSelected; - only works in firefox
    option.value = states[i].index;
    ss.add(option);
  }
  eoption = document.createElement("option");
  eoption.text = "END";
  eoption.value = paperGlue.getDoLength();
  ss.add(eoption);
  // set option to current location
  var ci = paperGlue.getDoIndex();
  for(var si in ss.children) {
    var v = ss.children[si].value;
    if(v === ci) {
      ss.value = v;
      break;
    }
  }
  if(ss.value != ci) {
    eoption = document.createElement("option");
    eoption.text = "select";
    eoption.value = -1;  // dummy option
    ss.add(eoption);
    ss.value = -1;
  }
  setDialogMove("state_select_heading");
  return false;
}

function stateSelected(value) {
  var index = parseInt(value);
  console.log("Going to index:"+ index);
  if(stateSkipMode)
    paperGlue.skipToIndex(index);
  else
    paperGlue.forardToIndex(index);
  closeDialog();
}

var savePath = "";  // kept from listing to give base path for save
var existingFileName = null; //used to determine is saving over

function fileSelectorDialog(objective,xtns,dir_obj) {
  if(objective === 'saveRecord')
    openDialogCommon(['Okay','Cancel']);
  else
    openDialogCommon();
  console.log("Opening file selector dialog");
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<div id="fileSelectTitle">'+objective;
  if(dir_obj.path === ".")
    dir_obj.path = "";
  // xtnlist = xtns.split(",");
  existingFileName = null;  // nothing chosen yet
  if(dir_obj.path !== "")
    p += " from "+dir_obj.path;
  p += "</div>";
  if(objective === 'saveRecord') {
    dialogType = 'file_select';
    p += '<div>Save to:<input id="nameField" type="text" value=" "/></div>';
    savePath = dir_obj.path;
  }
  p += '<table ' + fs + '>';
  p += '<thead><tr><th>Name</th></tr></thead>';
  p += '<tbody>';
  var cf;
  var col;
  var btnstyle = ';width:100%;height:100%;'+
                 'border:0px;padding:0px;' +
                 'text-align:left;'+
                 '" onclick="';
  console.log("Listing for path:"+dir_obj.path);
  if(dir_obj.path !== "" && dir_obj.path !== 'localStorage') {
    if(xtns === 'localImages')
      cf = "paperGlueCmd('loadImage','"+dir_obj.path+"','parent_directory')";
    else
      cf = "paperGlueCmd('listFiles','"+objective+"','"+xtns+"','"+dir_obj.path+"','parent_directory')";
    p += '<tr><td><button style="color:red'+btnstyle+cf+'">..</button></td></tr>';
  }
  for(var i in dir_obj.dir) {
    var fd = dir_obj.dir[i];
    var type, name;
    if(dir_obj.path === 'localStorage') {
      type = 'object';
      name = fd;
    } else {
      type = fd.type;
      name = fd.name;
      //if(type !== 'dir' && xtns.length > 0) {
        // var xfound = false;
        // for(var i in xtnlist) {
        //   if(name.endsWith("."+xtns[i])) {
        //     xfound = true;
        //     break;
        //   }
        // }
        // if(!xfound) // this file does not match any of the xtns
        //   continue;
      //}
    }
    //console.log("fd:"+Object.keys(fd));
    if(type === 'dir') {
      if(xtns === 'localImages')
        cf = "paperGlueCmd('loadImage','"+dir_obj.path+"','"+fd.name+"')";
      else
        cf = "paperGlueCmd('listFiles','"+objective+"','"+xtns+"','"+dir_obj.path+"','"+fd.name+"')";
      col = 'blue';
    } else {
      if(objective === 'saveRecord' )
        cf = "myScriptCmd('setNameField','"+name+"')";
      else   // includes loadRecord and loadImage
        cf = "myScriptCmd('selectFile','"+objective+"','"+dir_obj.path+"','"+name+"')";
      col = 'black';
    }
    p += '<tr><td><button style="color:'+col+btnstyle+cf+'">'+name+'</button></td></tr>';
    f = 'black';
  }
  p += '</tbody></table>';
  //console.log("Dialog content:"+p);
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  setDialogMove("fileSelectTitle");
  return false;
}
// in initApp() you will find paperGlue.fileSelector = fileSelectorDialog;

function setNameField(nm) {
  var nmElement = document.getElementById('nameField');
  nmElement.value = nm;
  existingFileName = nm;
}

function selectFile(objective,path,subpath) {
  switch(objective) {
    case 'loadRecord':
      paperGlue.loadRecord(path,subpath);
      break;
    // case 'saveRecord':
    //   paperGlue.saveRecord(path,subpath);
    //   break;
    case 'loadImage':
      paperGlue.loadImage(path,subpath);
      break;
  }
  closeDialog();
}

function fileSelectReturn(reply) {
  var nfield = document.getElementById('nameField');
  var nm = nfield.value;
  if(reply !== 'Cancel') {
    console.log("Save path:"+nm);
    console.log("existing:"+existingFileName);
    if(existingFileName === nm) {
      if(!confirm("Save over existing?"))
        return;
    }
    paperGlue.saveRecord(savePath,nm);
  }
  closeDialog();
}

function writeStatusLine(msg) {
  var se = document.getElementById('statusInfo');
  se.innerHTML = msg;
}
window.globals.writeStatus = writeStatusLine;

function setMode(state) {
  var se = document.getElementById('statusInfo');
  if(state === 'edit')
    se.style.display = 'inline';
  else
    se.style.display = 'none';
}
window.globals.setMode = setMode;

//window.globals.keyhandler = keyDown;  // requests paperglue to pass event here
var globals = window.globals;
var exports = {
  listActions : openActionsWindow,
  dialogReturn : dialogReturn,
  setCurrentLineColor : setCurrentLineColor,
  selectFile : selectFile,
  setNameField : setNameField,
  stateSelected : stateSelected,
};
globals.myScript = exports;

//console.log("Globals:");
//console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
