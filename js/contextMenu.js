(function() { // using the module pattern to provide name space

	/* Requires the following in the calling html

	<div style="display:none;" id="contextMenu">
	  <table  border="0" cellpadding="0" cellspacing="0"
	  style="border: thin solid #808080; cursor: default; white-space: nowrap"
	  bgcolor="White">
	  </table>
	</div>
	*/

	var enabled = true;
	var defaultContextMenu = [];
	var currentContextMenu = [];
  var currentContextObject = null;
  var eventPos = null;

	function setDefault(menu) {
		defaultContextMenu = menu;
		currentContextMenu = defaultContextMenu;
	}

	function setEnable(state) {
		enabled = state;
	}

	function set(context_type, obj) {
		currentContextMenu = defaultContextMenu;
    currentContextObject = obj;
		if (typeof context_type === undefined)
			return;
		// object context menus have been set in other modules
		if (window.globals.hasOwnProperty("menuLookup")) {
			var choices = window.globals.menuLookup;
			if (choices.hasOwnProperty(context_type))
				currentContextMenu = window.globals.menuLookup[context_type];
		}
		//console.log("Context menu:"+currentContextMenu);
	}

	/* Will be linked to  window.oncontextmenu  (use document.oncontextmenu for ie8)
	 */
	function onContextMenu(event) {
		console.log("Call for context menu");
		stopEvent(event);
		if (!enabled)
			return false;
		if (typeof globals.modalKey === 'function' || !currentContextMenu) {
			console.log("Modal or no currentContextMenu");
			return false;
		}
		showContextMenu(event); // standard context menu
		console.log("Console menu display complete");
		return false;
	}

	// mostly from http://www.codeproject.com/Tips/630793/Context-Menu-on-Right-Click-in-Webpage
	// called by onContextMenu above
	function showContextMenu(e) {
		eventPos = new Point(e.clientX, e.clientY);
		console.log("EventPOS:"+eventPos);
		var posx = e.clientX + window.pageXOffset + 'px'; //Left Position of Mouse Pointer
		var posy = e.clientY + window.pageYOffset + 'px'; //Top Position of Mouse Pointer
		var el = document.getElementById('contextMenu');
		if (!!el) {
			el.style.position = 'absolute';
			el.style.display = 'inline';
			el.style.left = posx;
			el.style.top = posy;
			var tbl = el.children[0]; //assumes menu has table as first child
			currentContextTable = tbl;
			loadCurrentContextMenu(tbl);
		}
	}


	function stopEvent(event) {
		if (typeof event.preventDefault !== 'undefined')
			event.preventDefault();
		if (typeof event.stopPropagation !== 'undefined')
			event.stopPropagation();
	}

	/* Call to generate and show the contextmenu for the current object if any
	    called by showContextMenu and also for control key + arrows for stepped moves,
	    to show the changed positions.
	*/
	function loadCurrentContextMenu(tbl) {
		tbl.innerHTML = "";
		//console.log("window width:"+window.innerWidth);
		//console.log("window height:"+window.innerHeight);
		var fontsize = window.innerWidth / 80;
		for (var mi in currentContextMenu) {
			var m = currentContextMenu[mi];
			//console.log(m);
			var txt = m.label;
			if (m.hasOwnProperty('propCall')) {
				//console.log("Has propCall");
				if (typeof m.propCall == 'function') {
					//console.log("Has propCall as function");
					txt += " " + m.propCall(currentContextObject);
				}
			}
			tbl.innerHTML += '<tr><td style="padding:0;"><div style="font-size:' +
				fontsize +
				'px;" class="ContextItem" onmouseup="contextMenuCallback(' +
				mi +
				')" >' + txt + '</div></td></tr>';
		}
	}

	function hide() {
		var el = document.getElementById('contextMenu');
		if (!!el) {
			el.style.display = 'none';
			var tbl = el.children[0]; //assumes menu has table as first
			tbl.innerHTML = "";
		}
		currentContextMenu = defaultContextMenu;
		//cursorPos[0] = currentContextObject.raster.position;
    // hideCursor();
	}

	window.oncontextmenu = onContextMenu; // document.oncontextmenu might be better

	/* Callback for generated context menu
	  as set in loadCurrentContextMenu
	*/
	window.contextMenuCallback = function(menu_index) {
		console.log('context menu call for item:' + menu_index);
		//console.log(currentContextMenu);
		if (currentContextMenu !== null) {
			var menu_item = currentContextMenu[menu_index];
			//console.log(Object.keys(menu_item));
			if (menu_item.hasOwnProperty('callback')) {
				var callback = menu_item.callback;
				//console.log("Type of:"+typeof callback);
				if (typeof callback == 'function') {
					//console.log("Calling callback:" + callback);
					callback();
				}
			} else if (menu_item.hasOwnProperty('submenu')) {
				console.log("Loading sub menu length:" + menu_item.submenu.length);
				if (Array.isArray(menu_item.submenu))
					currentContextMenu = menu_item.submenu;
				else // assume it is a string descriptor
					set(menu_item.submenu);
				loadCurrentContextMenu(currentContextTable);
				return;
			}
		}
		hide();
	};

	function append(menus_to_append) {
		// console.log("ThisVars:"+Object.keys(this));
		// console.log("WindowVars:"+Object.keys(window));
		for (var m in menus_to_append) {  //scan through menu names
			var dm = defaultContextMenu;
			if (m.length > 0 && m !== 'defaultContextMenu') {
				dm = findMenu(m);  // look for current menu
				if (!dm) {
          console.log("m:"+m);
					alert("Could not find default menu " + m + " to append");
					continue;
				}
			}
			console.log("Found menu to append:" + dm);
			var am = menus_to_append[m];
			for (var i in am)
				dm.push(am[i]);
		}
	}

	// assumes for the moment that each menu item has a unique label
	function findMenu(m, base) {
		if (typeof base === 'undefined')
			base = defaultContextMenu;
		for (var i in base) {
			var mi = base[i];
			if (mi.hasOwnProperty('submenu')) {
				if (mi.label === m)
					return base[i].submenu;
				var rv = findMenu(m, mi.submenu);
				if (!!rv)
					return rv;

			}
		}
		return null;
	}

	function getEventPos() {
		return eventPos;
	}

	var globals = window.globals;
	var exports = {
    setDefault: setDefault,
		set: set,
		append: append,
		hide: hide,
		setEnable: setEnable,
		getEventPos: getEventPos
	};

	globals.contextMenu = exports;

	//console.log("Loading dialog");
	if (typeof globals.moduleLoaded === 'function')
		globals.moduleLoaded('contextMenu');
}());
