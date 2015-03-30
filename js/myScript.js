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
var exportMenu = [
  {label:'list in new tab',callback:openActionsWindow},
  {label:'json in new tab',callback:openJSONWindow},
  {label:'  js in new tab',callback:openJSWindow}
];
window.globals.menuLookup = { symbolMenu:symbolMenu,
                              symbolInstanceMenu:symbolInstanceMenu,
                              lineInstanceMenu:lineInstanceMenu,
                              newAreaMenu:newAreaMenu,
                              areaMenu:areaMenu,
                              exportMenu:exportMenu
                            };

var defaultMenuAddendum = [
  {label:'export',submenu:"exportMenu"},
  {label:'import dorec.js',callback:loadDoRec},
  {label:'set state',callback:setNewState}
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
  paperGlue.fileSelector = fileSelectorDialog;
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
    recordWindow.document.write(txt);
    recordWindow.stop();
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
    case 'state':
      stateDialogReturn(reply);
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
  if(reply === 'Apply') {
    paperGlue.showImageCursors(obj,false);
    return;
  }
  dialogClose();
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
    if(reply === 'Apply')
      return;
  }
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
var nextStateTime = 0;

function setNewState() {
  var new_state = {nm:"state#"+nextStateID,dt:0};
  nextStateID++;
  setState(new_state,'new');
}

function setState(state,id) {
  dialogType = 'state';
  openDialogCommon(['Okay','Cancel']);
  console.log("Opening set state dialog");
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<table ' + fs + '>';
  p += '<tr id="idRow"><td>ID</td><td>'+id+'</td></tr>';
  p += '<tr><td>State Name</td><td>';
  p += '<input id="statename" type="text" value="'+state.nm+'"/></td></tr>';
  p += '<tr><td>DeltaTime</td><td>';
  p += '<input id="deltatime" type="number" value="'+state.dt+'"/></td></tr>';
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  setDialogMove("idRow");
  return false;
}

function stateDialogReturn(reply) {
  var nfield = document.getElementById('statename');
  var nm = nfield.value;
  var tfield = document.getElementById('deltatime');
  var dt = parseFloat(tfield.value);
  if(reply !== 'cancel') {
    paperGlue.setState({nm:nm,dt:dt});
  }
  paperGlue.hideCursor();
  if(reply === 'Apply') {
    return;
  }
  paperGlue.setModalOpen(false);
  paperGlue.enableKeyFocus(true);
}

var savePath = "";  // kept from listing to give base path for save
var existingFileName = null; //used to determine is saving over

function fileSelectorDialog(objective,dir_obj) {
  if(objective === 'saveRecord')
    openDialogCommon(['Okay','Cancel']);
  else
    openDialogCommon();
  console.log("Opening set state dialog");
  var fontsize = window.innerWidth/80;
  var fs = 'style="font-size:'+fontsize+'px;"';
  var p = '<div id="fileSelectTitle">'+objective;
  if(dir_obj.path === ".")
    dir_obj.path = "";
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
    cf = "paperGlueCmd('listFiles','"+objective+"','"+dir_obj.path+"','parent_directory')";
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
    }
    //console.log("fd:"+Object.keys(fd));
    if(type === 'dir') {
      cf = "paperGlueCmd('listFiles','"+objective+"','"+dir_obj.path+"','"+fd.name+"')";
      col = 'blue';
    } else {
      if(objective === 'loadRecord')
        cf = "myScriptCmd('selectFile','"+objective+"','"+dir_obj.path+"','"+name+"')";
      else
        cf = "myScriptCmd('setNameField','"+name+"')";
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
      closeDialog();
      break;
    // case 'saveRecord':
    //   paperGlue.saveRecord(path,subpath);
    //   break;
  }
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

//window.globals.keyhandler = keyDown;  // requests paperglue to pass event here
var globals = window.globals;
var exports = {
  listActions : openActionsWindow,
  dialogReturn : dialogReturn,
  setCurrentLineColor : setCurrentLineColor,
  selectFile : selectFile,
  setNameField : setNameField
};
globals.myScript = exports;

//console.log("Globals:");
//console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
