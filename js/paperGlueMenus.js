(function() { // using the module pattern to provide name space
	var globals = window.globals;
	var paperGlue = globals.paperGlue; // see initApp below
	var dialog = globals.dialog;
	var pgdialogs = globals.pgdialogs;
	var dependancies = ['paperGlue', 'pgdialogs'];

	var symbolMenu = [{
		label: 'name',
		propCall: imgGetNameCall
	}, {
		label: 'pos',
		propCall: imgGetPosCall
	}, {
		label: 'size',
		propCall: imgGetSizeCall
	}, {
		label: 'snap',
		propCall: getSnapModeCall,
		callback: toggleSnap
	}, {
		label: 'dragClones',
		propCall: getDragModeCall,
		callback: toggleDrag
	}, {
		label: 'properties',
		callback: pgdialogs.openImgPropDialog
	}, {
		label: 'setCenter',
		propCall: imgGetCenterCall,
		callback: setCenterToCursor
	}, {
		label: 'setOrigin',
		propCall: imgGetOriginCall,
		callback: setOriginToCursor
	}, {
		label: 'remove',
		callback: objRemove
	}];
	var symbolInstanceMenu = [{
		label: 'name',
		propCall: imgGetInstanceNameCall
	}, {
		label: 'pos',
		propCall: imgGetPosCall
	}, {
		label: 'snap',
		propCall: getSnapModeCall,
		callback: toggleSnap
	}, {
		label: 'properties',
		callback: pgdialogs.openImgPropDialog
	}];
	var lineInstanceMenu = [{
		label: 'color',
		propCall: pgdialogs.lineGetColor,
		callback: pgdialogs.selectLineColor //setCurrentLineColor
	}];
	var newAreaMenu = [{
		label: 'set area#',
		propCall: paperGlue.getAreaCount,
		callback: paperGlue.setArea
	}, {
		label: 'select',
		callback: paperGlue.areaSelect
	}];
	var areaMenu = [{
		label: 'name',
		propCall: paperGlue.getAreaNameCall
	}, {
		label: 'rect',
		propCall: paperGlue.getAreaRectCall
	}, {
		label: 'properties',
		callback: pgdialogs.openAreaPropDialog
	}];

	// paperGlue will be looking for the following menus
	window.globals.menuLookup = {
		symbolMenu: symbolMenu,
		symbolInstanceMenu: symbolInstanceMenu,
		lineInstanceMenu: lineInstanceMenu,
		newAreaMenu: newAreaMenu,
		areaMenu: areaMenu
	};
	var exportMenu = [{
		label: 'list in new tab',
		callback: openActionsWindow
	}, {
		label: 'json in new tab',
		callback: openJSONWindow
	}, {
		label: '  js in new tab',
		callback: openJSWindow
	}, ];
	var stateMenu = [{
		label: 'set state',
		callback: paperGlue.setNewState
	}, {
		label: 'forward to state',
		callback: pgdialogs.forwardToState
	}, {
		label: 'skip to state',
		callback: pgdialogs.skipToState
	}, ];
	var optionsMenu = [{
		label: 'import defaults',
		callback: pgdialogs.openImgLoadDefaultDialog
	}];

	// menus to append keys must match the label for the desired submenu
	// special case is defaultContextMenu
	// tree by using underline eg. menu_submenu
	menusToAppend = {
		export: exportMenu,
		options: optionsMenu,
		state: stateMenu
	};

	var defaultMenuAddendum = [];

	var default_image_menus = {
		contextMenu: "symbolMenu",
		instanceContextMenu: "symbolInstanceMenu"
	};

	function init() {
		console.log("Initialising paperGlue menus");
		paperGlue.appendMenus(menusToAppend);
	}

	function imgGetNameCall(obj) {
		//console.log('get name called');
		return obj.src.id;
	}

	function imgGetSizeCall(obj) {
		//console.log('get size called');
		//console.log("Obj raster keys:"+Object.keys(obj.raster));
		//console.log(obj.raster.bounds);
		var rs = "W:" + Math.round(obj.raster.bounds.width) + " H:" + Math.round(
			obj.raster
			.bounds.height);
		if (obj.hasOwnProperty('src')) {
			if (obj.src.hasOwnProperty('scale') && obj.scale !== 1.0)
				rs += " @ Scale:" + obj.src.scale;
		}
		return rs;
	}

	function imgGetInstanceNameCall(obj) {
		var nm = "" + obj.src.id + "#" + obj.id;
		if (obj.inst.hasOwnProperty('name'))
			nm += ':' + obj.inst.name;
		return nm;
	}

	function roundPoint(p) {
		return "X:" + Math.round(p.x) +
			" Y:" + Math.round(p.y);
	}

	function imgGetPosCall(obj) {
		console.log('pos called');
		//console.log(Object.keys(obj));
		return roundPoint(obj.raster.position);
	}

	function objRemove(obj) {
		console.log("remove called");
		paperGlue.delCurrentContextObject();
	}

	function getSnapModeCall(obj) {
		console.log("GetSnapMode for:" + obj);
		var inst = obj.inst;
		if (inst.hasOwnProperty('snap'))
			return inst.snap;
		return paperGlue.getSnapDefault();
	}

	function toggleSnap() {
		paperGlue.toggleSnap();
		return true;
	}

	function getDragModeCall(obj) {
		console.log("GetSnapMode for:" + obj);
		if (obj.src.hasOwnProperty('dragClone'))
			return obj.src.dragClone;
		return paperGlue.getDragDefault();
	}

	function toggleDrag() {
		paperGlue.toggleDrag();
		return true;
	}

	function imgGetCenterCall(obj) {
		//console.log('pos called');
		//console.log(Object.keys(obj));
		//console.log(obj.src);
		if (!obj.src.hasOwnProperty('center'))
			return {
				X: 0,
				Y: 0
			};
		return roundPoint(obj.src.center);
	}

	function imgGetOriginCall(obj) {
		//console.log('pos called');
		//console.log(Object.keys(obj));
		if (!obj.src.hasOwnProperty('origin'))
			return {
				X: 0,
				Y: 0
			};
		return roundPoint(obj.src.origin);
	}

	function createActionTableBody() {
		var q = paperGlue.getDoRecord();
		var dri = paperGlue.getDoIndex();
		var ihtml = "";
		for (var qi in q) {
			var dr = q[qi];
			var propstr = "";
			var oks = Object.keys(dr);
			for (var ki in oks) {
				var k = oks[ki];
				if (k == 'action' || k == 'id')
					continue;
				propstr += k + ":" + dr[k] + ";";
			}
			var bl;
			if ((qi % 2) === 0)
				bl = 'FF';
			else
				bl = 'C0';
			var vl;
			if (qi < dri)
				vl = 'FF';
			else
				vl = 'C0';
			var rhtml = '<tr style="background-color:#F0' + vl + bl +
				'"><td class="dtd" style="width:100px;border-left:0">' + dr.action +
				'</td><td class="dtd" style="width:30px;background-color:#E0' + vl +
				bl +
				'">' + dr.id + '</td><td class="dtd" style="border-right:0">' +
				propstr +
				'</td></tr>';
			//console.log(rhtml);
			ihtml += rhtml;
		}
		return ihtml;
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
		var ss = "overflow:scroll;height:" + window.innerHeight +
			"px;width:100%;overflow:auto;maxHeight:80%;";
		//console.log("Style:"+ss);
		tb.style = ss;
		tb.style.maxHeight = "400px";
		//console.log(tb.attributes);
		//console.log(tb.style);
		myWindow.stop();
	}

	function openJSONWindow() {
		openRecordWindow(true, false);
	}

	function openJSWindow() {
		openRecordWindow(false, true);
	}

	var recordWindow = null;

	/* generate a browser page which can be saved as a js file for
	   inclusion in a paperglue project.
	*/
	function openRecordWindow(beautify, include_loader) {
			if (recordWindow)
				recordWindow.close();
			recordWindow = window.open("", "doRecord"); //, "width=200, height=100");
			//var q = globals.paperGlue.getDoRecord();
			//var dri = globals.paperGlue.getDoIndex();
			var txt = "";
			txt = "";
			if (!include_loader)
				txt += "<html><body><pre>";
			txt += paperGlue.buildRedoTxt(beautify, include_loader);
			if (!include_loader) {
				txt += "</pre></body></html>";
			}
			recordWindow.document.write(txt);
			recordWindow.stop();
		}
		//
		// function loadDoRec() {
		//   paperGlue.loadDoRec();
		// }

	var dialogDiv;
	var idRow;
	var dialogType = "unknown";

	function setCenterToCursor() {
		paperGlue.setCenterToCursor();
	}

	function setOriginToCursor() {
		paperGlue.setOriginToCursor();
	}

	var exports = {
		listActions: openActionsWindow,
    default_image_menus: default_image_menus  //read only
	};
	globals.pgMenus = exports;

	if (typeof globals.moduleLoaded === 'function')
		globals.moduleLoaded('pgMenus', dependancies, init);

}());
