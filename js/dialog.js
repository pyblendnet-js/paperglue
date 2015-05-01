(function() { // using the module pattern to provide name space
  // see http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
  // but exporting public methods via window.globals - no public variables

  var clientArea;
  var dialogDiv;
  var content;
  var replyButtons;
  var hasFocus = false;
  var isModal = false;
  var dialogProp = {}; // set in
  var dialogRtn; // function to return results to
  var tempMouseUp;
  var fontStyle;

  // other modules using the keyboard should check here to see if dialog has focus
  function onKey() {
    return !keyFocus;
  }

  function openCommon(dialog_rtn, reply_buttons) {
    // paper.js note: do not mess with the body unless in same scope or maybe use createElement
    if (typeof clientArea === 'undefined') { // prepare page for dialog
      clientArea = document.getElementById('clientArea');
      dialogDiv = document.getElementById('Dialog');
      //dialogDiv.innerHTML +=
      //  '<div>id="DlgContent"></div><div id="DlgReplyButtons"></div></div></div>';
      dialogDiv.style.position = 'absolute';
      dialogDiv.style.left = '20px';
      dialogDiv.style.top = '60px';
      dialogDiv.style.padding = '2px';
      dialogDiv.style['text-align'] = 'center';
      dialogDiv.style.border = 'solid';
      dialogDiv.style['background-color'] = 'lightgray';
      content = document.getElementById('DlgContent');
    }
    dialogRtn = dialog_rtn;
    var fontsize = window.innerWidth / 80;
    fontStyle = 'style="font-size:' + fontsize + 'px;"';
    replyButtons = document.getElementById('DlgReplyButtons');
    if ((typeof reply_buttons === 'undefined') || (!reply_buttons) || (
        reply_buttons.length === 0))
      replyButtons.style.display = 'none';
    else {
      replyButtons.style.display = 'inline';
      var p = "";
      for (var bi in reply_buttons) {
        var bn = reply_buttons[bi];
        var bns = "'" + bn + "'";
        p += '<input type="button" ' + fontStyle + ' value="' + bn +
          '" onclick="moduleCmd(' +
          "'dialog','dialogReturn'," + bns + ')" />';
        //console.log("Dialog button html:" + p);
      }
      replyButtons.innerHTML = p;
    }
    keyFocus = true;
    isModal = true;
    paperGlue.enableKeyFocus(false);
    dialogDiv.style.visibility = 'visible';
    dialogDiv.style.fontSize = fontsize + 'px';
    paperGlue.setModalOpen(true); //make dialog modalish
    //dialog.style.fontSize = fontsize;
    //dialog.style = "font-size:"+fontsize+"px;visibility:visible;";
    dialogProp = {};
    return fontStyle;
  }

  function setMove(id) {
    var row = document.getElementById(id);
    row.onmousedown = mouseDown;
  }

  function mouseDown(e) {
    e.stopPropagation();
    if(typeof this.setCapture === 'function')  // no work on chrome
      this.setCapture();
    //dragFlag = true;
    tempMouseMove = clientArea.onmousemove;
    this.onmousemove = mouseMove;
    //clientArea.onmousemove = mouseMove;
    tempMouseUp = clientArea.onmouseup;
    //clientArea.onmouseup = mouseUp;
    this.onmouseup = mouseUp;
    var rect = this.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }

  function mouseUp(e) {
    e.stopPropagation();
    //clientArea.onmousemove = tempMouseMove;
    //clientArea.onmouseup = tempMouseUp;
    this.onmousemove = null;
    this.onmouseup = null;
    if(typeof this.setCapture === 'function')  // no work on chrome
      this.releaseCapture();
    console.log("MouseMoveUp");
  }

  function mouseMove(e) {
    var rect = this.getBoundingClientRect();
    var inside = true;  // alternative for chrome
    if(typeof this.setCapture !== 'function')  // no work on chrome
      inside = e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom;
    if(inside) {
    dialogDiv.style.left = (e.clientX - mouseX) + 'px';
    dialogDiv.style.top = (e.clientY - mouseY) + 'px';
  } else
    mouseUp(e);
    //console.log('Move');
  }

  function propertyRow(obj, def, nm, le) {
    // obj is the item which has a numeric or string value
    // def is the default value if obj is undefined
    //   or it can be an object with various input field parameters such as:
    //     default_value
    //     max
    //     min
    //     step
    // nm is the text label for the field
    // le is the id for the field
    //console.log(obj,def,nm,le);
    var p = '<tr><td ' + fontStyle + '>' + nm + '</td><td>';
    var val = "";
    var para = "";
    if (typeof def === 'number') {
      para = ' defaultValue="' + def + '"';
      val = def;
    } else if (typeof def === 'object') { // can include value, step, max, min etc.
      for (var pn in def) {
        para += ' ' + pn + '="' + def[pn] + '"';
      }
      if (def.hasOwnProperty('defaultValue'))
        val = def.defaultValue;
      // any type value will be overridden if object iis set
    }
    if (typeof obj !== 'undefined') {
      val = obj;
    }
    if (val !== "")
      para += ' value="' + val + '"';
    para += ' type="' + (typeof val) + '"';
    dialogProp[le] = {
      value: val
    };
    //if(typeof val === 'number')
    //console.log("Value type:"+(typeof val));
    p += '<input ' + fontStyle + ' id="' + le + '" ' + para +
      '/></td></tr>';
    return p;
  }

  function setContent(p) {
    content.innerHTML = p;
  }

  function getPropValues() {
    var rtnval = {};
    for (var le in dialogProp) {
      var field = document.getElementById(le);
      //if(!field) this should not happen
      var p = dialogProp[le];
      var typ = (typeof p.value);
      //console.log("Element:" + le + " of type:" + typ + " has field:" + field.value);
      //console.log(field);
      rtnval[le] = null;
      switch (typ) {
        case 'number':
          var num = parseFloat(field.value);
          //if(p.value !== num)
          rtnval[le] = num;
          break;
        case 'string':
          //if(p.value !== field.value)
          rtnval[le] = field.value;
          break;
      }
    }
    return rtnval;
  }

  function dialogReturn(reply) {
    if (typeof dialogRtn === 'function') {
      dialogRtn(reply, getPropValues());
    }
    if (reply != 'Apply')
      closeDialog();
  }

  function closeDialog() {
    dialogDiv.style.visibility = 'hidden';
    paperGlue.setModalOpen(false);
    isModal = false;
    paperGlue.enableKeyFocus(true);
    hasFocus = false;
  }

  // special dialogs

  var ega = {
    black: '#000000',
    brown: '#B08000',
    red: '#FF0000',
    orange: '#FFA000',
    yellow: '#FFFF00',
    green: '#40FF40',
    blue: '#4040FF',
    violet: '#FF00FF',
    grey: '#808080',
    white: '#FFFFFF'
  };

  var setColorCallback;

  function colorSelector(set_callback, getColorCallback) {
    setColorCallback = set_callback;
    openCommon(setColor);
    var fontsize = window.innerWidth / 80;
    console.log("Opening ega color select dialog");
    var fs = 'style="font-size:' + fontsize + 'px;"';
    var p = '<table ' + fs + '>';

    var f = 'white';
    for (var c in ega) {
      var cf = "moduleCmd('dialog','setColor','" + ega[c] + "')";
      p += '<tr><td><button style="color:' + f + ';background-color:' + ega[
          c] +
        '" onclick="' + cf + '">' + c + '</button></td></tr>';
      f = 'black';
    }
    p += '</table>';
    //console.log(p);
    var content = document.getElementById('DlgContent');
    content.innerHTML = p;
    return false;
  }

  function setColor(c) {
    if (typeof setColorCallback === 'function')
      setColorCallback(c);
    closeDialog();
  }


  var savePath = ""; // kept from listing to give base path for save
  var existingFileName = null; //used to determine is saving over
  var selectFileCallback;

  function fileSelector(objective, xtns, dir_obj, dir_cmd, select_callback) {
      var save_mode = (objective.substr(0, 4) === 'save');
      if (save_mode) {
        openCommon(fileSelectReturn, ['Okay', 'Cancel']);
        dialogRtn = select_callback;
      } else {
        openCommon(fileSelectReturn);
        if (typeof select_callback === 'function')
          selectFileCallback = select_callback; // for immediate file selection - only used for file load
      }
      console.log("Opening file selector dialog");
      var fontsize = window.innerWidth / 80;
      var fs = 'style="font-size:' + fontsize + 'px;"';
      var p = '<div id="fileSelectTitle">' + objective;
      if (dir_obj.path === ".")
        dir_obj.path = "";
      var xtn_list = xtns.split(",");
      existingFileName = null; // nothing chosen yet
      if (dir_obj.path !== "")
        p += " from " + dir_obj.path;
      p += "</div>";
      if (save_mode) {
        dialogType = 'file_select';
        p +=
          '<div>Save to:<input id="nameField" type="text" value=" "/></div>';
        savePath = dir_obj.path;
      }
      p += '<table ' + fs + '>';
      p += '<thead><tr><th>Name</th></tr></thead>';
      p += '<tbody>';
      var cf;
      var col;
      var btnstyle = ';width:100%;height:100%;' +
        'border:0px;padding:0px;' +
        'text-align:left;' +
        '" onclick="';
      console.log("Listing for path:" + dir_obj.path);
      if (dir_obj.path !== "" && dir_obj.path !== 'localStorage') {
        p += '<tr><td><button style="color:red' + btnstyle + dir_cmd.parent_rtn +
          '">..</button></td></tr>';
      }
      for (var i in dir_obj.dir) {
        var fd = dir_obj.dir[i];
        var type, name;
        if (dir_obj.path === 'localStorage') {
          type = 'object';
          name = fd;
        } else {
          type = fd.type;
          name = fd.name;
          if ((type !== 'dir') && (xtn_list.length > 0)) {
            var xfound = false;
            for (var j in xtn_list) {
              var xtn = "." + xtn_list[j];
              if (name.length > xtn.length && name.slice(-xtn.length) === xtn) {
                xfound = true;
                break;
              }
            }
            if (!xfound) // this file does not match any of the xtns
              continue;
          }
        }
        //console.log("fd:"+Object.keys(fd));
        if (type === 'dir') {
          col = 'blue';
          cf = dir_cmd.list;
        } else {
          if (save_mode)
            cf = "moduleCmd('dialog','setNameField','" + name + "')";
          else // includes loadRecord and loadImage
            cf = "moduleCmd('dialog','selectFile','" + objective + "','" +
            dir_obj.path +
            "','" + name + "')";
          col = 'black';
        }
        p += '<tr><td><button style="color:' + col + btnstyle + cf + '">' +
          name +
          '</button></td></tr>';
        f = 'black';
      }
      p += '</tbody></table>';
      //console.log("Dialog content:"+p);
      var content = document.getElementById('DlgContent');
      content.innerHTML = p;
      setMove("fileSelectTitle");
      return false;
    }
    // in initApp() you will find paperGlue.fileSelector = fileSelectorDialog;

  function selectFile(objective, path, subpath) {
    selectFileCallback(objective, path, subpath);
    // switch (objective) {
    // 	case 'loadRecord':
    // 		paperGlue.loadRecord(path, subpath);
    // 		break;
    // 		// case 'saveRecord':
    // 		//   paperGlue.saveRecord(path,subpath);
    // 		//   break;
    // 	case 'loadImage':
    // 		paperGlue.loadImage(path, subpath);
    // 		break;
    // }
    closeDialog();
  }

  function fileSelectReturn(reply) {
    var nfield = document.getElementById('nameField');
    var nm = nfield.value;
    if (reply !== 'Cancel') {
      //console.log("Save path:" + nm);
      //console.log("existing:" + existingFileName);
      if (existingFileName === nm) {
        if (!confirm("Save over existing?"))
          return;
      }
      dialogRtn("save", savePath, nm);
    }
    closeDialog();
  }


  function setNameField(nm) {
    var nmElement = document.getElementById('nameField');
    nmElement.value = nm;
    existingFileName = nm;
  }

  var globals = window.globals;
  var exports = {
    hasFocus: function() {
      return hasfocus;
    },
    isModal: function() {
      return isModal;
    },
    openCommon: openCommon,
    closeDialog: closeDialog,
    propertyRow: propertyRow,
    setMove: setMove,
    setContent: setContent,
    getPropValues: getPropValues,
    dialogReturn: dialogReturn,
    colorSelector: colorSelector,
    setColor: setColor,
    fileSelector: fileSelector,
    setNameField: setNameField,
    selectFile: selectFile
  };
  globals.dialog = exports;

  //console.log("Loading dialog");
  if (typeof globals.moduleLoaded === 'function')
    globals.moduleLoaded('dialog');
}());
