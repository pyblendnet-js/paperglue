//(function() { // using the module pattern to provide name space

// import dependancies when you are sure all are loaded
function init() {
  paperGlue = window.globals.paperGlue;
  dialog = window.globals.dialog;
}

function openDialogPropCommon(id) {
  dialog.openCommon(propDialogReturn, ['Apply', 'Ok', 'Cancel']);
  console.log("Opening property dialog:", id);
  var p = '<table><tr id="idRow"><td>ID</td><td>' + id + '</td></tr>';
  return p;
}


var flashChanged = false; // used to determine if flash parameters need saving

function openImgPropDialog(force_flash) {
  dialog.openCommon(propDialogReturn, ['Apply', 'Ok', 'Cancel']);
  var obj = paperGlue.getCurrentContextObject();
  //console.log("ObjKeys:"+Object.keys(obj));
  paperGlue.showImageCursors(obj, false);
  var p = openDialogPropCommon(obj.id);
  if (obj.type === 'symbol') {
    //p += '<tr><td>Name</td><td>';
    var nm = obj.src.id + "#" + obj.id;
    if (obj.inst.hasOwnProperty('name')) {
      nm = obj.inst.name;
    }
    //p += '<input id="name" type="text" value="'+nm+'"/></td></tr>';
    p += dialog.propertyRow(obj.inst.name, nm, 'Name', 'name');
  } // otherwise symbol
  p += dialog.propertyRow(obj.raster.position.x, 0, 'X', 'xpos');
  p += dialog.propertyRow(obj.raster.position.y, 0, 'Y', 'ypos');
  //console.log("Obj key:" + Object.keys(obj.raster));
  p += dialog.propertyRow(obj.raster.rotation, {
    defaultValue: 0,
    type: 'number',
    max: 360,
    min: 0
  }, 'Rot', 'rot');
  if (obj.type !== 'symbol') {
    p += dialog.propertyRow(obj.src.scale, {
      defaultValue: 1.0,
      step: 0.1
    }, 'Scale', 'scale');
  }
  p += '<tr><td>Flash Image</td><td>';
  var flashFlag = "";
  var click_cmd = "moduleCmd('pgdialogs','openImgPropDialog',true)";
  var flashing = false;
  flashChanged = (typeof force_flash);
  if ((typeof force_flash !== 'undefined' && force_flash) || (obj.inst.hasOwnProperty(
      'flashUp') && obj.inst.flashUp)) {
    flashFlag = 'checked="true"';
    click_cmd = "moduleCmd('pgdialogs','openImgPropDialog',false)";
    flashing = true;
  }
  p += '<input id="flashflag" type="checkbox"' + flashFlag + ' onclick="' +
    click_cmd + '"/></td></tr>';
  var op_para = {
    step: 0.1,
    max: 1.0,
    min: 0.0
  };
  if (flashing) {
    op_para.defaultValue = 0.1;
    p += dialog.propertyRow(obj.inst.flashUpRate, op_para, 'UpRate',
      'flashUpRate');
    p += dialog.propertyRow(obj.inst.flashDownRate, op_para, 'DownRate',
      'flashDownRate');
    op_para.defaultValue = 1.0;
    p += dialog.propertyRow(obj.inst.flashHigh, op_para, 'MaxOpacity',
      'flashHigh');
    op_para.defaultValue = 0.0;
    p += dialog.propertyRow(obj.inst.flashLow, op_para, 'MinOpacity',
      'flashLow');
  } else {
    op_para.defaultValue = 1.0;
    p += dialog.propertyRow(obj.inst.opacity, op_para, 'Opacity', 'opacity');
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
  dialog.setMove("idRow");
  return false; //do not hide cursors yet
}

//
// switch (dialogType) {
//   case 'obj_prop':
//     propDialogReturn(reply);
//     break;
//   case 'img_default':
//     (reply);
//     break;
//   case 'set_state':
//     setStateDialogReturn(reply);
//     break;
//   case 'select_state':
//     (reply);
//     break;
//   case 'file_select':
//     (reply);
//     break;
//   default:
//     console.log("Unknown dialog type:" + dialogType);
//     break;
// }
// }

function propDialogReturn(reply) {
  if (reply === 'Cancel') {
    paperGlue.hideCursor();
    dialog.closeDialog();
    return;
  }
  var obj = paperGlue.getCurrentContextObject();
  //console.log("Object type:" + obj.type);
  if (obj.type === 'area') {
    areaDialogReturn(reply);
    return;
  }
  var rtnval = dialog.getPropValues();
  console.log("RtnVals for:" + Object.keys(rtnval));
  if (rtnval.hasOwnProperty('scale')) {
    console.log(obj.src.scale, rtnval.scale);
    if (obj.src.scale != rtnval.scale)
      paperGlue.scaleCurrentImage(rtnval.scale);
  }
  if (rtnval.hasOwnProperty('name')) {
    var name = rtnval.name;
    console.log("New name:" + name);
    paperGlue.nameCurrentImage(name);
  }
  //console.log("rtnval"+rtnval.flashup);
  paperGlue.moveCurrentImage(rtnval.xpos, rtnval.ypos, rtnval.rot);
  var ffield = document.getElementById('flashflag');
  if (ffield.checked) {
    if (flashChanged ||
      obj.inst.flashUpRate !== rtnval.flashUpRate ||
      obj.inst.flashDownRate !== rtnval.flashDownRate ||
      obj.inst.flashHigh !== rtnval.flashHigh ||
      obj.inst.flashLow !== rtnval.flashLow) {
      obj.inst.flashUpRate = rtnval.flashUpRate;
      obj.inst.flashDownRate = rtnval.flashDownRate;
      obj.inst.flashHigh = rtnval.flashHigh;
      obj.inst.flashLow = rtnval.flashLow;
      paperGlue.recordFlash(obj.id, rtnval);
    }
  } else {
    console.log("Ops:" + obj.inst.opacity + " " + rtnval.opacity);
    if (paperGlue.recordOpacity(obj.id, rtnval.opacity)) {
      // only returns true if there has been a change
      obj.inst.opacity = rtnval.opacity;
      obj.raster.opacity = rtnval.opacity;
    }
  }
  if (reply === 'Apply') {
    paperGlue.showImageCursors(obj, false);
    return;
  }
  paperGlue.hideCursor();
  dialog.closeDialog();
}

function openImgLoadDefaultDialog() {
  openDialogCommon(imgLoadDefaultDialogReturn, ['Okay', 'Cancel']);
  console.log("Opening image load default dialog");
  var fontsize = window.innerWidth / 80;
  var fs = 'style="font-size:' + fontsize + 'px;"';
  var p =
    '<div id="imgLoadOptionsTitle">Default Image Load Options</div>';
  p += '<table ' + fs + '>';
  p += '<tr><td>Scale</td><td>';
  p += '<input id="imgscale" type="text" value="' + paperGlue.importDefaults
    .scale +
    '"/></td></tr>';
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  dialog.setMove("imgLoadOptionsTitle");
  return false; //do not hide cursors yet
}

function imgLoadDefaultDialogReturn(reply) {
  if (reply !== 'Cancel') {
    var sfield = document.getElementById('imgscale');
    paperGlue.importDefaults.scale = parseFloat(sfield.value);
  }
  dialog.closeDialog();
}

// function areaSelect() {
// 	paperGlue.areaSelect();
// }
//
// function getAreaCount() {
// 	return paperGlue.getAreaCount();
// }
//
// function setArea() {
// 	paperGlue.setArea();
// }

function openAreaPropDialog() {
  var obj = paperGlue.getCurrentContextObject();
  var p = openDialogPropCommon(obj.id);
  var a = obj.inst;
  //p += '<tr><td>Name</td><td>';
  var nm = "area#" + obj.id;
  if (a.hasOwnProperty('name'))
  	nm = a.name;
  //p += '<input id="name" type="text" value="' + nm + '"/></td></tr>';
  p += dialog.propertyRow(nm, "area#" + obj.id, 'Name', 'name');
  p += dialog.propertyRow(a.rect.x, 0, 'X', 'xpos');
  p += dialog.propertyRow(a.rect.y, 0, 'Y', 'ypos');
  p += dialog.propertyRow(a.rect.width, 0, 'Width', 'width');
  p += dialog.propertyRow(a.rect.height, 0, 'Height', 'height');
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  dialog.setMove('idRow');
  return false; //do not hide cursors yet
}

function areaDialogReturn(reply) {
  if (reply === 'Cancel') {
    dialog.closeDialog();
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
  paperGlue.changeAreaName(name); // beware name is volitile
  paperGlue.moveCurrentArea(new Rectangle(x, y, w, h));
  if (reply === 'Apply')
    return;
  dialog.closeDialog();
}


function fileSelectorDialog(objective, xtns, dir_obj) {
  var parent_rtn_cmd, list_dir_cmd;
  if (xtns === 'localImages') {
    parent_rtn = "moduleCmd('paperGlue','loadImage','" + dir_obj.path +
      "','parent_directory')";
    list_dir_cmd = "moduleCmd('paperGlue','loadImage','" + dir_obj.path +
      "','" + fd.name +
      "')";
  } else {
    parent_rtn = "moduleCmd('paperGlue','listFiles','" + objective + "','" +
      xtns + "','" +
      dir_obj.path + "','parent_directory')";
    list_dir_cmd = "moduleCmd('paperGlue','listFiles','" + objective + "','" +
      xtns + "','" +
      dir_obj.path + "','" + fd.name + "')";
  }
  dialog.fileSelector(objective, xtns, dir_obj, {
    parent_rtn: parent_rtn,
    list: list_dir_cmd
  });
}

// paperGlue.saveRecord
//
//
function selectLineColor() {
  dialog.colorSelector(setCurrentLineColor, lineGetColor);
}

function lineGetColor(obj) {
  var lc = paperGlue.getLineColor(obj.id);
  for (var c in dialog.ega) {
    var nc = dialog.ega[c];
    if (nc === lc)
      return c;
  }
  return lc;
}

function setCurrentLineColor(c) {
  window.globals.paperGlue.setCurrentLineColor(c);
  dialog.closeDialog();
}

function setStateDialog(state) {
  openDialogCommon(setStateDialogReturn, ['Okay', 'Cancel']);
  console.log("Opening set state dialog");
  var fontsize = window.innerWidth / 80;
  var fs = 'style="font-size:' + fontsize + 'px;"';
  var p = '<table ' + fs + '>';
  p += '<tr id="idRow"><td>ID</td><td>' + state.id + '</td></tr>';
  p += '<tr><td>State Name</td><td>';
  p += '<input id="statename" type="text" value="' + state.name +
    '"/></td></tr>';
  if (!state.hasOwnProperty('dt'))
    state.dt = 0;
  // obj is the item which has a numeric or string value
  // def is the default value if obj is undefined
  // nm is the text label for the field
  // le is the id for the field
  //p += '<tr><td>DeltaTime</td><td>';
  //p += '<input id="deltatime" type="number" value="' + state.dt +
  //	'"/></td></tr>';
  p += dialog.propertyRow(state.dt, 0, 'Deltatime', 'deltatime');
  p += '<tr><td>Clear After</td><td>';
  var clearFlag = "";
  if (state.hasOwnProperty('clearFlag') && state.clearFlag)
    clearFlag = 'checked="true"';
  p += '<input id="clearflag" type="checkbox"' + clearFlag +
    '/></td></tr>';
  p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  dialog.setMove("idRow");
  return false;
}

function setStateDialogReturn(reply) {
  var nfield = document.getElementById('statename');
  var name = nfield.value;
  var tfield = document.getElementById('deltatime');
  var dt = parseFloat(tfield.value);
  var cfield = document.getElementById('clearflag');
  var clearFlag = cfield.checked;
  if (reply !== 'Cancel') {
    var state = {
      name: name
    };
    if (dt !== 0)
      paperGlue.dt = dt;
    if (clearFlag)
      state.clearFlag = clearFlag;
    paperGlue.setState(state);
  }
  paperGlue.hideCursor();
  if (reply === 'Apply') {
    return;
  }
  dialog.closeDialog();
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
  openDialogCommon(selectStateDialogReturn);
  console.log("Opening select state dialog");
  // var state = def_state;
  // if(!state) {
  //   console.log("No state given for default target so going to start");
  //   state = paperGlue.getNextState(0);
  // }
  //console.log("Default to state"+state.name);
  var fontsize = window.innerWidth / 80;
  var fs = 'style="font-size:' + fontsize + 'px;"';
  var p = '<h2 id="state_select_heading">State Selector</h2>';
  var cf = "moduleCmd('pgdialogs','stateSelected',this.value)";
  p += '<div><select ' + fs + 'id="state_select" onchange="' + cf +
    '"></select></div>';
  // p += '<table' + fs + '>';
  // if(state.hasOwnProperty("dt"))
  //   p += '<tr><td>DeltaTime</td><td>'+state.dt+'</td></tr>';
  // p += '</table>';
  var content = document.getElementById('DlgContent');
  content.innerHTML = p;
  var ss = document.getElementById("state_select");
  //fs.style.display = "inline";
  ss.length = 0; // may hang for very long lists - see: http://www.somacon.com/p542.php
  if (stateSkipMode) {
    var doption = document.createElement("option");
    doption.text = "START";
    doption.value = 0;
    ss.add(doption);
  }
  for (var i in states) {
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
  for (var si in ss.children) {
    var v = ss.children[si].value;
    if (v === ci) {
      ss.value = v;
      break;
    }
  }
  if (ss.value != ci) {
    eoption = document.createElement("option");
    eoption.text = "select";
    eoption.value = -1; // dummy option
    ss.add(eoption);
    ss.value = -1;
  }
  dialog.setMove("state_select_heading");
  return false;
}

function stateSelected(value) {
  var index = parseInt(value);
  console.log("Going to index:" + index);
  if (stateSkipMode)
    paperGlue.skipToIndex(index);
  else
    paperGlue.forardToIndex(index);
  dialog.closeDialog();
}

function writeStatus(msg) {
  var se = document.getElementById('statusInfo');
  se.innerHTML = msg;
}

// show status line if edit mode
function setMode(state) {
  var se = document.getElementById('statusInfo');
  if (state === 'edit')
    se.style.display = 'inline';
  else
    se.style.display = 'none';
}

var globals = window.globals;
globals.setMode = setMode;
globals.writeStatus = writeStatus;

var exports = {
  writeStatus: writeStatus,
  setMode: setMode,
  //setCurrentLineColor: setCurrentLineColor,
  // setNameField: setNameField,
  stateSelected: stateSelected,
  openImgPropDialog: openImgPropDialog,
  lineGetColor: lineGetColor,
  selectLineColor: selectLineColor,
  openAreaPropDialog:openAreaPropDialog
};
globals.pgdialogs = exports;
globals.moduleLoaded('pgdialogs', ['paperGlue', 'dialog'],
  init);

//}());
