/*!
 * paperglue.js v0.0.01 - Sandbox editor using Paper.js.
 * See paper.ps
 *
 * Current features:
 *   - click drag to create snap locked lines
 *   - click ends or middle to drag line end or whole lines
 *   - click on master image to clone and drag to locate clone
 *   - right click and drag to make area then select action
 *   - right click on images or areas for context menu and properties
 *   - cntrl z to undo, cntrl shift z to redo, ctrl x to undeo forever
 *   - cntrl s to save, cntrl o to open, cntrl shift x to prune do record
 *   - communication with external paperscript via window.globals
 *
 * paperglue.js Copyright (c) 2015 - 2015, Robert Parker
 * http://grapevine.com.au/~wisteria/index.html
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 *
 * Date: Sat Jan 10 2015
 */
(function() { // using the module pattern to provide name space
	// see http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
	// but exporting public methods via window.globals - no public variables
	console.log("Loading paperGlue");
	// includes
	var globals = window.globals;
	dependancies = ['body', 'paper'];
	// see exports at bottom for public functions
	//note:objects here are all somewhere within the paper scope
	// To make visibile to window, declare as window.object

	var body; // cached in init()
	var baseLayer;
	var areaLayer;
	var cursorLayer;
	var layerFlip = [1, 1];
	var editMode = true;
	var mouseDownHandled = false; // prevent propogation to onMouseDown
	var selectDist = 10; // how close to a line for right click select closest
	var keyFocus = true;
	var nextID = 0; // for keeping track of all objects with a unique id
	var lineInstances = {};
	var lineSelected = null;
	var imageSelected = null;
	var imageSelectedPositiion = null;
	var lineSelectMode = 0;
	var areaSelected = null;
	var areaSelectMode = 0;
	var areaInstances = {};
	var areasVisible = false;
	var areaColor = 'blue';
	var newAreaColor = 'green';
	var minAreaSide = 10;
	var areaStrokeThickness = 2;
	var snapRect = [5, 5, 10, 10]; // offset x,y and then quantum x, y
	var snapDefault = true;
	var dragDefault = true;
	var lineThickness = 3;
	var defaultLineColor = 'black';
	var lineColor = 'black';
	var mouseDownPosition;
	var rightButton = false;
	var customDefaultProps = {};
	var selectedItems = {};
	var selectedPos = {}; // for prev pos following are move
	var selectedMove = false;
	var imagesLoaded = {};
	var symbolInstances = {}; //images that have been cloned from sybols in imagesLoaded.
	var flashingImages = [];
	var sprites = [];

	var holdContext = false; // don't reset contextMenu till after mouseUp
	var doRecord = []; // record of all clonings and moves  {action:string,src_id:src.id,raster:image or line:path,pos:point}
	var doRecordIndex = 0; // points to next do location
	var postObject;
	var listObjective;
	var listXtns;
	var importDefaults = {
		scale: 1.0,
		isSymbol: true,
		dragClone: true,
		pos: null
	};
	var baseImportDefaults = cloneShallow(importDefaults);
	var cursorPos = []; // mouse, raster, origin, center
	var cursorImage = null; // to allow cursor hide in selectItem
	var cursorColors = ['#f00', '#ff0', '#88f', '#8f8'];
	var currentStateRate = 0.0; // immediate jumps to state

	function cloneShallow(obj) {
		var ro = {};
		for (var i in obj)
			ro[i] = obj[i];
		return ro;
	}

	/** Set quantum [x,y] for snap on lines and images
	  @param {float} typically greater than 1
	 */
	function setSnap(q) {
		snapRect = [q[0], q[1], 0.000001, 0.000001]; //min values for quantum
		for (var qi = 2; qi < 4; qi++) {
			if (q[qi] > 0.000001)
				snapRect[qi] = q[qi];
		}
	}

	function getSnapDefault() {
		return snapDefault;
	}

	function getDragDefault() {
		return dragDefault;
	}

	function getDragMode(obj) {
		if (obj.src.hasOwnProperty('dragClone'))
			return obj.src.dragClone;
		return paperGlue.getDragDefault();
	}

	function toggleSnap() {
		var obj = currentContextObject.inst;
		console.log(Object.keys(obj));
		console.log("Toggle snap was:" + obj.snap);
		if (obj.hasOwnProperty('snap'))
			obj.snap = !obj.snap;
		else
			obj.snap = !snapDefault;
		if (currentContextObject.hasOwnProperty('raster'))
			obj.raster.position = snapPoint(obj.raster.position, !obj.snap);
		console.log("Toggle snap now:" + obj.snap);
	}

	function toggleDrag() {
		var obj = currentContextObject.inst;
		if (obj.hasOwnProperty('dragClone'))
			obj.dragClone = !obj.dragClone;
		else
			obj.dragClone = !dragDefault;
	}

	function setLineThickness(t) {
		lineThickness = t;
	}

	function getLineColor(id) {
		if (lineInstances.hasOwnProperty(id)) {
			if (lineInstances[id].hasOwnProperty('color'))
				return lineInstances[id].color;
		}
		return '#000000';
	}

	function setCurrentLineColor(c) {
		if (!!currentContextObject) {
			var id = currentContextObject.id;
			var do_rec = {
				action: 'lineColor',
				id: id,
				type: 'line',
				color: c
			};
			if (lineColor != defaultLineColor) // applies to future lines
				do_rec.oldValue = lineColor;
			doRecordAdd(do_rec);
			setLineColor(id, c);
		}
	}

	function setLineColor(id, c) {
		if (lineInstances.hasOwnProperty(id)) {
			lineInstances[id].path.strokeColor = c;
			lineInstances[id].color = c;
		}
		lineColor = c;
	}

	// helper to add hidden image to document before reference as paper image
	function addImage(source, id) {
		var img = document.createElement("img");
		img.src = source; // this will cause a GET call from the browser
		img.id = id;
		img.hidden = true;
		body.appendChild(img);
		return img;
	}

	// finds an instance of an object based on element key and value
	// if first_only is true then the key for one instance is returned
	// otherwise an array of keys is returned
	// if search value is undefined then all instances with the search_by
	// element are returned
	function findInstance(obj, search_by, first_only, search_value) {
		// search through obj.search_by == search_key
		// if first_only is true then return first match
		if (typeof first_only === 'undefined')
			first_only = false;
		var keys = [];
		for (var key in obj) {
			//console.log("Checking id:"+id);
			var inst = obj[key];
			if (inst.hasOwnProperty(search_by)) {
				if ((typeof search_value === 'undefined') ||
					inst[search_by] == search_value) {
					if (first_only)
						return key;
					keys.push(key);
				}
			}
		}
		if (first_only)
			return null;
		return keys;
	}

	function drawCross(pos, size, color) {
		var s = size / 2;
		var p = new Path();
		p.strokeColor = color;
		p.strokeWidth = 2;
		p.add(new Point(pos.x - s, pos.y));
		p.add(new Point(pos.x + s, pos.y));
		p = new Path();
		p.strokeColor = color;
		p.strokeWidth = 2;
		p.add(new Point(pos.x, pos.y - s));
		p.add(new Point(pos.x, pos.y + s));
	}

	function init() {
		body = document.getElementById("body");
		paper.install(window);
		paper.setup('myCanvas');
		importDefaults.pos = view.center;
		view.onFrame = onFrame;
		var tool = new Tool();
		tool.onKeyDown = onKeyDown;
		tool.onMouseDown = onMouseDown;
		tool.onMouseUp = onMouseUp;
		tool.onMouseDrag = onMouseDrag;

		// there may or maynot be an activeLayer when this code is run
		//baseLayer = project._activeLayer;
		//for some reason no layer exists yet so lets make one
		baseLayer = new Layer();
		cursorLayer = new Layer();
		areaLayer = new Layer();
		project._activeLayer = baseLayer;
		console.log("Project Layers:" + project.layers);
		console.log("ActiveLayer;" + project._activeLayer);
	}

	function rasterize() {
		var lr = project._activeLayer; //layers[0];
		//console.log("Layer counter:" + lr._children.length);
		var top_layer = lr.rasterize(); // creates new layer
		lr.removeChildren(); // too many children slows things down
		lr.insertChild(0, top_layer); // now stripboard is one child
		//console.log("Inserted background:" + lr._children.length);
		project._activeLayer = baseLayer;
		console.log("ProjectLayers:" + project.layers);
		console.log("ActiveLayer;" + project._activeLayer.name);
	}

	function hideCursor() {
		console.log("Hide cursor");
		cursorLayer.removeChildren();
		cursorLayer.position = [0, 0];
		cursorImage = null;
	}

	function showCursor(ci) {
		console.log("Show cursor#" + ci + " @pos:" + cursorPos[ci]);
		drawCross(cursorPos[ci], 20, '#000');
		drawCross(cursorPos[ci].subtract([1, 1]), 20, cursorColors[ci]);
	}

	function showImageCursors(obj, show_mouse_cursor) {
		hideCursor();
		project._activeLayer = cursorLayer;
		//console.log("Show cursors:"+Object.keys(obj));
		var imgobj;
		if (obj.hasOwnProperty('id'))
			imgobj = obj; // this is a image, possibly a master for clones
		else
			imgobj = obj.src; // this is a clone from master symbol
		var raster = obj.raster;
		cursorImage = obj;
		cursorPos[0] = mouseDownPosition;
		if (show_mouse_cursor)
			showCursor(0);
		cursorPos[1] = raster.position;
		showCursor(1);
		console.log("Show cursors:" + Object.keys(imgobj));
		if (imgobj.hasOwnProperty('center')) {
			var cp = imgobj.center;
			if (imgobj.hasOwnProperty('scale'))
				cp.multiply(imgobj.scale);
			console.log("Scaled center:" + cp + " Scale:" + imgobj.scale);
			cursorPos[2] = raster.position.subtract(cp.rotate(raster.rotation));
			showCursor(2);
		}
		if (imgobj.hasOwnProperty('origin')) {
			var op = imgobj.origin;
			if (imgobj.hasOwnProperty('scale'))
				op.multiply(imgobj.scale);
			cursorPos[3] = raster.position.subtract(op.rotate(raster.rotation));
			showCursor(3);
		}
		project._activeLayer = baseLayer;
	}

	// onmousedown callback for images that are cloneable, dragable or have context menu
	function onImageMouseDown(event) {
		mouseDownHandled = true;
		stopEvent(event); // doesn't work
		mouseDownPosition = event.point;
		hideArea();
    if(typeof contextMenu !== 'undefined')
  		contextMenu.hide();
		if (rightButtonCheck(event)) { // this will set rightButton global
			console.log("Right button down");
		}
		//console.log("ActiveLayer:"+project.activeLayer);
		console.log("image mouse down");
		// look to see if this object is the raster for one of the master images
		var imgobj;
		console.log("Loaded images:" + Object.keys(imagesLoaded));
		for (var id in imagesLoaded) {
			console.log("Check id:" + id);
			imgobj = imagesLoaded[id];

			if (this === imgobj.raster) { //master image found
				console.log("Master image found");
				if (!editMode) {
					if (imgobj.hasOwnProperty('hitCallback'))
						imgobj.hitCallback(mouseDownPosition, event, hit_id, imgobj);
					return false;
				}
				console.log("rb:"+rightButton);
				if (rightButton) {
					if (imgobj.hasOwnProperty('contextMenu')) { // if not defined then stay with default
						console.log("Attaching image context menu");
						currentContextObject = {
							id: id,
							type: 'image',
							inst: imgobj,
							src: imgobj,
							raster: imgobj.raster
						}; //to match image instance object
            if(typeof contextMenu !== 'undefined')
						  contextMenu.set(imgobj.contextMenu, currentContextObject);
						// currentContextObject object has some redundant info but seems simpler to use this way
						selectItem(id, imgobj.raster);
						imageSelected = this;
						holdContext = true; // cross browser solution to default mouse up reset
						showImageCursors(imgobj, true);
						return false; // just show context menu now - see context menu callback below
					}
				}
				if (imgobj.hasOwnProperty('dragClone')) { // if not defined then assume false
					if (imgobj.dragClone === true) { // this image object can be dragged, so it should have isSymbol set true also
						//console.log("Symbol:" + imgobj.symbol);
						var inst = symbolPlace(imgobj.id); //sets imageSelected to the new raster
						imageSelected.opacity = 0.5;
						imageSelected.position = imgobj.raster.position;
						imageSelected.rotation = imgobj.raster.rotation;
						imageSelectedPosition = null; // so we can tell there was no prior position
						imageSelectedRotation = imgobj.raster.rotation;
						showImageCursors(inst, false);
						return false;
					}
				} // otherwise this image is dragable
				imageSelected = this;
				imageSelected.opacity = 0.5;
				imageSelectedPosition = this.position.clone(); // need to dereference
				imageSelectedRotation = null; // indicating it rotation is a seperate issue
				return false; // master image found, so no need to look at clones in symbolInstances
			}
		}
		// no master image found, so maybe this is a clone
		id = findInstance(symbolInstances, "raster", true, this);
		if (!!id) {
			console.log("Clone image found ID=" + id);
			imgobj = symbolInstances[id];
			if (!editMode) {
				if (imgobj.hasOwnProperty('hitCallback'))
					imgobj.hitCallback(mouseDownPosition, event, hit_id, imgobj);
				return false;
			}
			//if(this == imginst.raster) {  // clone image found
			src = imgobj.src;
			showImageCursors(imgobj, false);
			if (rightButton) {
				if (src.hasOwnProperty('instanceContextMenu')) { // if not defined then stay with default
					currentContextObject = {
						id: id,
						type: 'symbol',
						inst: imgobj,
						src: src,
						raster: this
					};
          if(typeof contextMenu !== 'undefined')
  					contextMenu.set(src.instanceContextMenu, currentContextObject);
					// currentContextObject object has some redundant info but seems simpler to use this way
					// name may not be defined
					console.log("name:" + imgobj.name);

					selectItem(id, imgobj.raster);
					holdContext = true; // cross browser solution to default mouse up reset
					return false; // clone image not selected for right click
				}
			}
			imageSelected = this;
			imageSelected.opacity = 0.5;
			imageSelectedPosition = this.position.clone(); // need to dereference
			imageSelectedRotation = null; // indicating it rotation is a seperate issue
			return false; //found so done looking
			//}
		}
		return false;
	}

	// uses master image raster to create clone
	// only use force_id for redo so that it uses old id
	function symbolPlace(imgid, force_id) {
		if (typeof force_id !== 'undefined') {
			if (symbolInstances.hasOwnProperty(force_id)) {
				console.log("This image symbol still exists");
				return;
			}
		}
		var imgobj = imagesLoaded[imgid];
		console.log("Placing clone of:" + imgobj.id);
		imageSelected = imgobj.symbol.place();
		//imageSelected.scale(0.5);
		imageSelected.onMouseDown = onImageMouseDown;
		var img_id;
		var inst;
		if (typeof force_id === 'undefined') {
			inst = {
				src: imgobj,
				raster: imageSelected
			};
			img_id = nextID;
			doRecordAdd({
				action: 'symbolPlace',
				id: img_id,
				type: 'symbol',
				src_id: imgobj.id
			});
			selectItem(img_id, imageSelected);
			currentContextObject = {
				id: img_id,
				type: 'symbol',
				inst: inst,
				src: imgobj,
				raster: imageSelected
			};
      if(typeof contextMenu !== 'undefined')
  			contextMenu.set(null, currentContextObject); // not sure why this is necessary
			nextID += 1;
		} else { // used by redo to accept old id - so need to record do action
			inst = {
				src: imgobj,
				raster: imageSelected
			};
			img_id = force_id;
			console.log("Forces instance is:" + inst);
		}
		symbolInstances[img_id] = inst;
		imgobj.instances += 1;
		return inst;
	}

	// find img_id for imgobj in symbolInstances
	function symbolRemove(id) {
		var inst = symbolInstances[id];
		inst.raster.remove();
		delete symbolInstances[id];
		if (selectedItems.hasOwnProperty(id))
			delete selectedItems[id];
	}

	/**
	 * Called from external script via window.globals to add images to the document with behaviour parameters
	 * @param {array} images_to_load is array of image objects having parameters src, id, [isSymbol:bool, dragClone:bool, contextMenu:object, instanceContextMenu:object, pos:point, scale:float]
	 */
	function loadImages(images_to_load, custom_default_props) {
		if (typeof custom_default_props === 'undefined')
			custom_default_props = customDefaultProps;
		else {
			customDefaultProps = custom_default_props;
			console.log("Custom default properties being set");
		}
		console.log("Loading " + images_to_load.length + " images");
		while (images_to_load.length > 0) { // continue till empty - not sure if this is valid
			var imgobj = images_to_load.pop();
			imgobj.initialProp = Object.keys(imgobj);
			if (imagesLoaded.hasOwnProperty(imgobj.id)) {
				if (confirm("Image name "+imgobj.id+ " is already loaded. Add 'C' to id string or cancel to reload?")) {
					imgobj.id += 'C';
					// note: images are loaded from three different events:
					// initApp in myScript.js calls with array of required images
					// initApp then calls loadDoRec which will look for a dorec.js
					//   which is holds a paperGlue undo record.
					// Finally in edit mode the user my load an image seperately or
					//   as part of a paperGlue undo record.
				} else {
					var previous = imagesLoaded[imgobj.id];
					previous.raster.remove(); // assume this is a reload
				}
			}
			imagesLoaded[imgobj.id] = imgobj; // record master images
			var img = addImage(imgobj.src, imgobj.id); // add image to document
			imgobj.element = img;
			// the following is not reliable on chrome until image loaded
      //  imgobj.width = img.naturalWidth;
			//	imgobj.height = img.naturalHeight;
			// use raster size instead after load
			imgobj.raster = new Raster(imgobj.id); // make this a paper image
			imgobj.raster.onLoad = imageOnLoad;

			if (imgobj.hasOwnProperty('scale')) {
				imgobj.raster.scale(imgobj.scale);
			}
			console.log(imgobj.isSymbol);
			if (imgobj.hasOwnProperty('isSymbol')) { // this image can appear many times as instances
				if (imgobj.isSymbol === true) { // needs true comparison
					console.log("Image "+imgobj.id+" is symbol");
					imgobj.symbol = new Symbol(imgobj.raster);
					imgobj.raster.remove(); //dont need this cluttering the document
					imgobj.raster = imgobj.symbol.place();
					imgobj.instances = 0;
				}
			}
			if (imgobj.hasOwnProperty('pos')) { // a position given so it will be visible
				console.log("Pos:" + imgobj.pos);
				imgobj.raster.position = imgobj.pos;
			} else { // no position so dont show yet
				imgobj.raster.remove();
				console.log("don't need this cluttering the document");
			}
			var listen_to_mouse = imgobj.hasOwnProperty('contextMenu');
			if (imgobj.hasOwnProperty('dragClone')) { // if not defined then assume false
				if (imgobj.dragClone === true)
					listen_to_mouse = true;
			}
			if (listen_to_mouse)
				imgobj.raster.onMouseDown = onImageMouseDown; // needed for drag or context
			var default_keys = Object.keys(custom_default_props);
			console.log("Image default props:" + default_keys);
			for (var di in default_keys) {
				dk = default_keys[di];
				if (!imgobj.hasOwnProperty(dk))
					imgobj[dk] = custom_default_props[dk];
			}
			imgobj.loadedProp = Object.keys(imgobj);
		}
	}

	function imageOnLoad() {
		//console.log("Loaded:"+this);
		for(var id in imagesLoaded) {
			//console.log("Check:"+id);
			var img = imagesLoaded[id];
			if(img.raster === this) {
			  console.log("Found id:"+id);
				if(img.hasOwnProperty('onLoad'))  // callback for animation init
				  img.onLoad(id,img);
				break;
			}
		}
	}

	function loadSingleImage(full_path, subpath, props) {
		//e.g var first_image = {src:"img/con_Block_5.08mm_12.png", scale:0.6, id:"conBlock1", isSymbol:true, dragClone:true, pos:view.center };
		var img = importDefaults;
		if (typeof props != 'undefined') {
			for(var p in props) {
			  img[p] = props[p];
				console.log("Img prop:"+p+"="+props[p]);
			}
		}
		img.src = full_path;
		img.id = subpath;
		var images_to_load = [img];
		loadImages(images_to_load);
		return imagesLoaded[subpath];
	}

	function nameCurrentImage(name) {
		var id = currentContextObject.id;
		nameImage(name, id);
	}

	function nameImage(name, id) {
		var imgobj = symbolInstances[id];
		console.log("ID:" + id);
		if (name === id) { // no need for name if it is the same as id
			if (imgobj.hasOwnProperty('name'))
				delete imgobj.name;
		} else {
			imgobj.name = name;
			console.log("Image renamed:" + imgobj.name);
		}
	}

	function stopEvent(event) {
		if (typeof event.preventDefault !== 'undefined')
			event.preventDefault();
		if (typeof event.stopPropagation !== 'undefined')
			event.stopPropagation();
	}

	// default mouse down event handler - most browser will bubble to this from the other mouseDown handlers
	function onMouseDown(event) {
		if (mouseDownHandled) { // another onfunction has handled this event already
			mouseDownHandled = false;
			return false;
		}
		console.log("Basic Mouse down");
		if (typeof globals.modalKey === 'function')
			return false;
		mouseDownPosition = event.point;
		hideArea();
    if(typeof contextMenu !== 'undefined')
  		contextMenu.hide();
		if (editMode) {
			if (!!lineSelected || !!imageSelected) { // an existing line has been selected
				console.log("Something selected");
			} else {
				var id = hitTestLines(mouseDownPosition);
				if (!!id) {
					lineSelected = lineInstances[id].path;
					selectLine(event);
				}
			}
		}
		if (rightButtonCheck(event)) {
			console.log("Right button down");
			var d = new Date();
			var nowMs = d.getTime();
			var shiftPressed = ((nowMs - shiftPressMs) < modPressDelay);
			if (shiftPressed) { //if control pressed then do not clear previous
				selectedMove = true;
			}
			if (!holdContext && typeof contextMenu !== 'undefined') // cross browser solution to default mouse up reset
				contextMenu.set();
		}
		return false;
	}

	function newLine() {
		console.log("Start new path");
		lineSelected = new Path();
		lineSelected.strokeColor = lineColor;
		lineSelected.strokeWidth = lineThickness;
		lineSelected.strokeCap = 'round';
		lineSelected.onMouseDown = onLineMouseDown; // the call to use for mod
		lineSelectMode = 0; // drag last point
	}

	function newArea() {
		console.log("Start new area path");
		areaSelected = new Path();
		areaSelected.strokeColor = newAreaColor;
		areaSelected.strokeWidth = areaStrokeThickness;
		areaSelected.strokeCap = 'butt';
		areaSelected.strokeJoin = 'mitre';
		areaSelected.dashArray = [6, 6];
		//areaSelected.onMouseDown = onLineMouseDown;  // the call to use for mod
		areaSelectMode = 0; // drag last point
	}

	function hideArea() {
		if (!!areaSelected) {
			// if(areasVisible) {
			//   areaSelected.strokeColor = areaColor;
			// } else {
			areaSelected.remove();
			//}
		}
		areaSelected = null;
	}

	function getAreaCount() {
		return Object.keys(areaInstances).length;
	}

	function getAreaNameCall(obj) {
		console.log('get name called');
		var nm = "Area#" + obj.id;
		if (obj.inst.hasOwnProperty('name'))
			nm += ":" + obj.inst.name;
		return nm;
	}

	function getAreaRectCall(obj) {
		//console.log("areaRect:" + Object.keys(obj));
		return obj.inst.rect;
	}

	function setArea() {
		var rect = new Rectangle(roundPoint(areaSelected.segments[0].point),
			roundPoint(areaSelected.segments[2].point));
		areaInstances[nextID] = {
			rect: rect
		};
		doRecordAdd({
			action: 'setArea',
			id: nextID,
			type: 'area',
			rect: rect
		});
		if (areasVisible) {
			showArea(nextID);
			selectItem(nextID, areaInstances[nextID].path);
		}
		nextID++;
		hideArea();
	}

	function nameCurrentArea(name) {
		var id = currentContextObject.id;
		var a = areaInstances[id];
		//console.log("id:"+id+" name:"+name);
		//console.log("Current name:"+a.name);
		var oldname = id;
		if (a.hasOwnProperty('name')) {
			if (name === a.name)
				return; // nothing to do
			oldname = a.name;
		}
		doRecordAdd({
			action: 'rename',
			id: id,
			type: 'area',
			oldValue: oldname,
			name: name
		});
		nameArea(name, id);
	}

	function nameArea(name, id) {
		var a = areaInstances[id];
		if (name === id) {
			if (a.hasOwnProperty('name'))
				delete a.name;
		} else {
			a.name = name;
		}
		console.log("Props:" + Object.keys(a));
		if (a.hasOwnProperty('text')) {
			showAreaText(a, id);
		}
	}

	function moveCurrentArea(rect) {
		var id = currentContextObject.id;
		var a = areaInstances[id];
		if (a.rect.x === rect.x && a.rect.y === rect.y &&
			a.rect.width === rect.width && a.rect.height === rect.height) {
			return; // nothing to do
		}
		doRecordAdd({
			action: 'move',
			id: id,
			type: 'area',
			oldValue: a.rect,
			rect: rect
		});
		moveArea(rect, id);
	}

	function moveArea(rect, id) {
		var a = areaInstances[id];
		a.rect = rect;
		showArea(id);
	}

	function removeAreaInstance(id, record) {
		if (areaInstances.hasOwnProperty(id)) { // this path does exist
			var a = areaInstances[id];
			removeAreaPath(a);
			if (record) {
				// note: name may not be defined
				doRecordAdd({
					action: 'areaDelete',
					id: id,
					rect: a.rect,
					name: a.name
				});
			}
			delete areaInstances[id]; // removes from object items
			if (selectedItems.hasOwnProperty(id))
				delete selectedItems[id];
		}
	}

	function removeAreas() {
		console.log("Removing area instances:" + Object.keys(areaInstances).length);
		for (var id in areaInstances)
			removeAreaInstance(id);
	}

	function removeAreaPath(a) {
		console.log("Removing:" + a.rect);
		if (a.hasOwnProperty('path')) {
			a.path.remove(); // should remove from screen
			delete a.path;
		}
		if (a.hasOwnProperty('text')) {
			a.text.remove();
			delete a.text;
		}
	}

	function showArea(id) {
		// assumes path and text do not exist
		var a = areaInstances[id];
		var rect = a.rect;
		console.log("Rect:" + rect);
		if (!a.hasOwnProperty('path')) {
			project._activeLayer = areaLayer;
			var path = new Path();
			project._activeLayer = baseLayer;
			a.path = path;
		}
		a.path.strokeColor = areaColor;
		a.path.strokeWidth = areaStrokeThickness;
		a.path.strokeCap = 'butt';
		a.path.strokeJoin = 'mitre';
		a.path.dashArray = [6, 6];
		a.path.clear();
		a.path.add(rect.topLeft);
		a.path.add(rect.topRight);
		a.path.add(rect.bottomRight);
		a.path.add(rect.bottomLeft);
		a.path.closed = true;
		showAreaText(a, id);
	}

	function showAreaText(a, id) {
		if (a.hasOwnProperty('text'))
			a.text.remove();
		project._activeLayer = areaLayer;
		var text = new PointText();
		project._activeLayer = baseLayer;
		a.text = text;
		a.text.point = a.rect.topLeft.add([20, 20]);
		console.log("New text location:"+a.text.point);
		if (a.hasOwnProperty('name'))
			a.text.content = a.name;
		else
			a.text.content = id;
		a.text.justification = 'center';
		a.text.fontSize = 15;
		a.text.fillColor = areaColor;
		currentContextObject = {
			id: id,
			type: 'area',
			inst: a
		};
		selectItem(id, a.path);
	}

	function showAllAreas() {
		areasVisible = true;
		for (var id in areaInstances) {
			//console.log("Show area#" + id);
			showArea(id);
		}
	}

	function hideAreas() {
		for (var id in areaInstances) {
			removeAreaPath(areaInstances[id]);
		}
	}

	function hideAllAreas() {
		hideAreas();
		areasVisible = false;
	}

	function toggleAreas() {
		if (areasVisible) {
			hideAllAreas();
		} else {
			showAllAreas();
		}
		return areasVisible;
	}

	function hitTestArea(id, hit_point) {
		var rect = areaInstances[id].rect;
		//console.log("Is "+hit_point + " in " + rect + " = " +rect.contains(hit_point));
		return rect.contains(hit_point);
	}

	function hitTestAreas(hit_point) {
		for (var id in areaInstances) {
			//console.log("Hit test area#" + id);
			if (hitTestArea(id, hit_point)) {
				console.log("Hit test area#" + id);
				return id;
			}
		}
		return null;
	}

	function areaMoved(path, prev_pos) {
		console.log("Area moved");
		var aid = findInstance(areaInstances, 'path', true, path);
		if (!!aid) { // shouldn't be any trouble here
			console.log("area instance found with id:" + aid); // need to keep id as well - might be null for master objects in layout mode
			var inst = areaInstances[aid];
			// keeping the obj as record is fine for undo but not so good for redo if the object gets deleted further back
			var new_rect = new Rectangle(roundPoint(path.firstSegment.point),
				roundPoint(
					path.segments[2].point));
			doRecordAdd({
				action: 'move',
				id: aid,
				type: 'area',
				oldValue: inst.rect,
				rect: new_rect
			});
			inst.rect = new_rect;
		}
	}

	function hitTestLine(id, hit_point) {
		var path = lineInstances[id].path;
		// var rect = new Rectangle(path.firstSegment.point,path.lastSegment.point);
		// //console.log("Is "+hit_point + " in " + rect + " = " +rect.contains(hit_point));
		// if(!rect.contains(hit_point))
		//   return -1;
		// return distance to closer end
		var d1 = hit_point.subtract(path.firstSegment.point).length;
		var d2 = hit_point.subtract(path.lastSegment.point).length;
		//console.log(d1,d2);
		return Math.min(d1, d2);
	}

	function hitTestLines(hit_point) {
		var best_dist = null;
		var best_id = null;
		for (var id in lineInstances) {
			var l = hitTestLine(id, hit_point);
			//console.log("Hit test area#" + id + " = " + l);
			if (!best_dist || (l >= 0 && l < best_dist)) {
				best_dist = l;
				best_id = id;
				//console.log("Chose:" + id);
			}
		}
		//console.log("Best dist:"+ best_dist);
		if (!best_dist || best_dist > selectDist)
			return null;
		return best_id;
	}

	function selectItem(id, item) {
		var d = new Date();
		var nowMs = d.getTime();
		var controlPressed = ((nowMs - controlPressMs) < modPressDelay);
		if (!controlPressed) { //if control pressed then do not clear previous
			for (var sid in selectedItems) {
				selectedItems[sid].selected = false;
				if (!!cursorImage && (selectedItems[sid] === cursorImage.raster))
					hideCursor();
			}
			selectedItems = []; // leaves the problem for the garbage collector
		} else
			//???currentContextMenu = null; // no context menu for multi selection
		if (selectedItems.hasOwnProperty(id)) { //already selected so toggle
			selectedItems[id].selected = false;
			if (!!cursorImage && (selectedItems[id] === cursorImage.raster))
				hideCursor();
			delete selectedItems[id];
			item.selected = false;
		} else {
			selectedItems[id] = item;
			item.selected = true;
		}
	}

	// onmousedown callback for two point paths
	// harder to use than picking the ends but the only way to drag whole line
	function onLineMouseDown(event) {
		if (!editMode)
			return true;
		stopEvent(event);
		mouseDownHandled = true;
		console.log("Line mouse down");
		if (typeof globals.modalKey === 'function')
			return;
    if(typeof contextMenu !== 'undefined')
  		contextMenu.hide();
		mouseDownPosition = event.point;
		lineSelected = this;
		selectLine(event);
		return false;
	}

	function rightButtonCheck(event) {
		//console.log(event);
		rightButton = false;  // global record
		if (event.event) {
			if (event.event.button) {
				//console.log(event.event.button);
				rightButton = (event.event.button == 2);
			}
		} else if (event.which) {
			rightButton = (event.which == 3);
		} else if (event.button) {
			rightButton = (event.button == 2);
		}
		if (!rightButton && typeof contextMenu !== 'undefined')
			contextMenu.hide();
		return rightButton;
	}

	// called both by onLineMouseDown and onMouseDown
	function selectLine(event) {
		if (rightButtonCheck(event)) {
			console.log("Right button down");
			var ids = findInstance(lineInstances, 'path', true, lineSelected);
			if (ids.length > 0) {
				console.log("Line found:" + ids[0]);
				currentContextObject = {
					id: ids[0],
					type: 'line',
					inst: lineSelected
				}; //to match image instance object
				contextMenu.set("lineInstanceMenu",currentContextObject);
				selectItem(ids[0], lineSelected); //needs to happen after context select
				holdContext = true; // cross browser solution to default mouse up reset
			}
			return;
		}
		lineSelectedPosition = [lineSelected.firstSegment.point.clone(),
			lineSelected
			.lastSegment.point.clone()
		];
		var line_select_fraction = (event.point.subtract(lineSelected.segments[
				0].point))
			.length /
			lineSelected.length;
		if (line_select_fraction < 0.25) { //drag start of link
			lineSelectMode = 1;
		} else if (line_select_fraction > 0.75) { // drag end of link
			lineSelectMode = 0;
		} else {
			lineSelectMode = 2; // drag whole link
		}
		console.log("Selected fraction:" + line_select_fraction);
		console.log("Line select mode:" + lineSelectMode);
		console.log("Selected pos:" + lineSelected.position);
	}

	// universal mouse drag function can drag lines or images or create rubber band new line
	function onMouseDrag(event) {
		// only fires when the mouse button is pressed
		if (typeof globals.modalKey === 'function' || !editMode)
			return;
		if (rightButton) {
			var v = event.point.subtract(mouseDownPosition);
			if (selectedMove) {
				for (var sid in selectedItems) {
					//console.log("Move id:",sid);
					if (lineInstances.hasOwnProperty(sid))
						lineInstances[sid].path.position = lineInstances[sid].path.position
						.add(
							event.delta);
					else if (symbolInstances.hasOwnProperty(sid))
						symbolInstances[sid].raster.position = symbolInstances[sid]
						.raster.position
						.add(event.delta);
					else if (areaInstances.hasOwnProperty(sid)) {
						var sa = areaInstances[sid];
						if (sa.hasOwnProperty("path"))
							sa.path.position = sa.path.position.add(event.delta);
						if (sa.hasOwnProperty("text"))
							sa.text.position = sa.text.position.add(event.delta);
					}
				}
				return;
			}
			if (Math.abs(v.x) > minAreaSide && Math.abs(v.y) > minAreaSide) {
				if (!areaSelected) {
					newArea();
					// currentContextObject = {
					// 	id: aid,
					// 	type: 'area',
					// 	inst: selectedArea
					// }; //to match image instance object
					contextMenu.set("newAreaMenu");  //,newArea);
				}
				switch (areaSelectMode) { //chosen in onlinemousedown
					case 0: //move last point
						if (areaSelected.segments.length < 4) {
							areaSelected.add(mouseDownPosition);
							areaSelected.add(mouseDownPosition);
							areaSelected.add(mouseDownPosition);
							areaSelected.add(mouseDownPosition);
							areaSelected.closed = true;
							areaSelectedPosition = null; // to indicate it is new
						}
						areaSelected.segments[2].point = areaSelected.segments[2].point
							.add(
								event.delta);
						areaSelected.segments[1].point.y = areaSelected.segments[2]
							.point.y;
						areaSelected.segments[3].point.x = areaSelected.segments[2]
							.point.x;
						break;
					case 1:
						break;
				}
			}
			return;
		}
		if (!!imageSelected) { // drag image
			imageSelected.position = imageSelected.position.add(event.delta);
			cursorLayer.position = cursorLayer.position.add(event.delta);
		} else {
			if (!lineSelected) //no line selected yet
				newLine(); // create new line
			if (!!lineSelected) { // link selected so drag existing
				switch (lineSelectMode) { //chosen in onlinemousedown
					case 0: //move last point
						if (lineSelected.segments.length < 2) {
							lineSelected.add(event.point.subtract(event.delta));
							lineSelectedPosition = null; // to indicate it is new
						} else {
							lineSelected.lastSegment.point = lineSelected.lastSegment
								.point.add(
									event.delta);
						}
						break;
					case 1: //move first point
						lineSelected.firstSegment.point = lineSelected.firstSegment
							.point.add(
								event.delta);
						break;
					default: // move all
						lineSelected.position = lineSelected.position.add(event.delta); // drag whole link
				}
			}
		}
		return false;
	}

	function roundPoint(p) {
		return new Point(Math.round(p.x), Math.round(p.y));
	}

	function snapPoint(p, round_only) {
		var p2;
		if (round_only) {
			p2 = new Point(Math.round(p.x), Math.round(p.y));
		} else {
			p2 = new Point(
				Math.round((p.x - snapRect[0]) / snapRect[2]) * snapRect[2] +
				snapRect[0],
				Math.round((p.y - snapRect[1]) / snapRect[3]) * snapRect[3] +
				snapRect[1]
			);
		}
		//console.log("Snap delta:" + (p2 - p));
		return p2;
	}

	// snaps both ends of the line path to grid quantum
	function snapLine(p, round_only) {
		if (typeof p === 'undefined') // not sure why this happens
			return;
		if (typeof p.firstSegment === 'undefined')
			return;
		//console.log("Before:" + p.firstSegment.point);
		//console.log("Snap Rect:" + snapRect);
		p.firstSegment.point = snapPoint(p.firstSegment.point, round_only);
		//console.log("After:" + p.firstSegment.point);
		p.lastSegment.point = snapPoint(p.lastSegment.point, round_only);
		var dx = p.firstSegment.point.x - p.lastSegment.point.x;
		var dy = p.firstSegment.point.y - p.lastSegment.point.y;
		return ((dx !== 0) || (dy !== 0));
	}

	// universal mouse up handler - mainly just tidy up
	function onMouseUp(event) {
		console.log("Mouse up");
		stopEvent(event);
		if (typeof globals.modalKey === 'function') {
			return false;
		}
		if (editMode) {
			if (!!imageSelected) {
				//console.log("Opacity was:" + imageSelected.opacity);
				imageSelected.opacity = 1.0;
			}
			if (rightButton) {
				if (selectedMove) {
					for (var sid in selectedItems) {
						console.log("validate moved for:" + sid);
						var item = selectedItems[sid];
						var prev_pos = selectedPos[sid];
						if (lineInstances.hasOwnProperty(sid)) {
							lineSelected = item;
							lineSelectedPosition = prev_pos;
							validatePath(item);
						} else if (symbolInstances.hasOwnProperty(sid)) {
							imageMoved(item, prev_pos, false, null);
						} else if (areaInstances.hasOwnProperty(sid)) {
							areaMoved(item, prev_pos);
						}
					}
					selectedMove = false;
					rightButton = false;
					lineSelected = null;
					imageSelected = null;
					//currentContextMenu = null;
					console.log("Area move completed");
					return false;
				}
				console.log("Not select move");
				var aid;
				if (!imageSelected && !lineSelected && !areaSelected) {
					if (areasVisible) {
						aid = hitTestAreas(mouseDownPosition);
						if (!!aid) {
							var a = areaInstances[aid];
							currentContextObject = {
								id: aid,
								type: 'area',
								inst: a
							}; //to match image instance object
							contextMenu.set("areaMenu",currentContextObject);
							if (a.hasOwnProperty('path'))
								selectItem(aid, a.path); // needs to happen after context select
						}
					}
					if (!aid) {
						console.log("Not area clicked - check lines");
						var id = hitTestLines(mouseDownPosition);
						if (!!id) {
							console.log("Line found!=" + id);
							var l = lineInstances[id];
							currentContextObject = {
								id: id,
								type: 'line',
								inst: l
							}; //to match image instance object
							contextMenu.set("lineMenu",currentContextObject);
							if (l.hasOwnProperty('path')) {
								selectItem(id, l.path); //needs to happen after context select
								currentContextObject = {
									id: id,
									type: 'line',
									inst: l
								};
							}
						}
					}
				}
				console.log("Select check complete");
				rightButton = false;
				lineSelected = null;
				imageSelected = null;
				return false;
			}
			if (!!lineSelected) {
				// for undo it will be necessary to look for previous position if any
				// point needs to be cloned to dereference
				line_id = validatePath(lineSelected);
				if (!line_id)
					hitTestAreas(mouseDownPosition);
				lineSelected = null;
				// continue through to path addition or removal
			} else if (!!imageSelected) {
				hideCursor();
				imageMoved(imageSelected, imageSelectedPosition, (imageSelected
					.position.equals(
						imageSelectedPosition)), imageSelectedRotation);
				imageSelected = null;
			} // end of edit mode
		} else { // not edit mode
			var hit_id = hitTestAreas(mouseDownPosition);
			if (!!hit_id) {
				var area = areaInstances[hit_id];
				if (area.hasOwnProperty('hitCallback'))
					area.hitCallback(mouseDownPosition, event, hit_id, area);
				if (typeof window.globals.hitCallback === 'function')
					window.globals.hitCallback(hit_id);
			}
		}
		selectedMove = false;
		lineSelected = null;
		imageSelected = null;
		return false;
	}

	function imageMoved(img, prev_pos, spot_rotate, src_prev_rot) {
		// note that src_prev_rot is only no null for first symbol creation
		var img_id = findInstance(symbolInstances, 'raster', true, img);
		if (!!img_id) { // shouldn't be any trouble here
			console.log("instance found with id:" + img_id); // need to keep id as well - might be null for master objects in layout mode
			//console.log(Object.keys(img));
			//console.log(img.index);
			//console.log(Object.keys(img.parent));
			//console.log(Object.keys(img.parent.children[0]));
			var round_only = !snapDefault;
			var inst = symbolInstances[img_id];
			if (inst.hasOwnProperty('snap'))
				round_only = !inst.snap;
			var src = symbolInstances[img_id].src;
			if (!src_prev_rot && spot_rotate) { // no movement or no prior position it being null
				rotateImage(img_id, 'symbol', img, src, 90);
				correctPosition(img, src, round_only);
			} else {
				correctPosition(img, src, round_only);
				// keeping the obj as record is fine for undo but not so good for redo if the object gets deleted further back
				doRecordAdd({
					action: 'imageMove',
					id: img_id,
					type: 'symbol',
					oldValue: prev_pos,
					pos: img.position
				});
			}
			if (!!src_prev_rot) {
				if (!prev_pos) // raster is already rotated for initial drag
					img.rotate(-img.rotation);
				rotateImage(img_id, 'symbol', img, src, src_prev_rot);
				//correctPosition(img,src,round_only);
			}
		}
	}

	function correctPosition(raster, src, round_only) {
		// snaps and rounds image postion raster
		//console.log("Before:"+raster.position);
		if (src.hasOwnProperty('origin')) {
			var oo = src.origin.rotate(raster.rotation);
			raster.position = snapPoint(raster.position.subtract(oo),
				round_only).add(
				oo);
		} else {
			raster.position = snapPoint(raster.position, round_only);
		}
		//console.log("After snap:"+raster.position);
		raster.position = roundPoint(raster.position);
		//console.log("After round:"+raster.position);
	}

	function rotateImage(id, type, raster, src, angle) {
		var dorec = {
			action: 'imageRotate',
			id: id,
			type: type
		};
		// use mouseDownPosition or event.posihtion to find the closest point of rotation in object
		var prev_rotation = Math.round(raster.rotation);
		var prev_pos = raster.position;
		if (src.hasOwnProperty('center')) {
			var cp = src.center * src.scale;
			raster.rotate(angle, raster.position.subtract(src.center.rotate(
				raster.rotation))); //(new Point(30,30)));  // need to look up source to find centre of rotation - could also have 45 deg mode
		} else
			raster.rotate(angle); // need to look up source to find centre of rotation - could also have 45 deg mode
		raster.rotation = Math.round(raster.rotation); // prevent error creaping in
		dorec.pos = [raster.position, raster.rotation];
		dorec.oldValue = [prev_pos, prev_rotation];
		doRecordAdd(dorec);
	}

	function scaleCurrentImage(scale) {
		var obj = currentContextObject;
		var inst = obj.inst;
		inst.raster.scale(scale / inst.scale);
		inst.scale = scale;
		if (obj.type === 'image') { // need to restore as symbol master
			inst.symbol = new Symbol(inst.raster);
			var pos = inst.raster.position;
			var rot = inst.raster.rotation;
			//var md = obj.raster.onMouseDown;
			console.log("Remove image raster"); // of keys:"+(Object.keys(obj.raster)));
			inst.raster.remove();
			inst.raster = inst.symbol.place();
			console.log("Restore as new raster");
			inst.raster.position = pos;
			inst.raster.rotation = rot;
			inst.raster.onMouseDown = onImageMouseDown; //md;
		}
	}

	function moveCurrentImage(x, y, r) {
		//console.log("currentContextObject:"+Object.keys(currentContextObject));
		var im = currentContextObject.raster;
		console.log("Move from pos:" + im.position + " to " + x + "," + y +
			"," +
			r);
		var p = new Point(x, y);
		if (x !== im.position.x || y !== im.position.y) {
			//console.log(p);
			doRecordAdd({
				action: 'imageMove',
				id: currentContextObject.id,
				type: currentContextObject.type,
				oldValue: im.position,
				pos: p
			});
			//console.log(doRecord[doRecordIndex-1].pos);
			im.position = p;
		}
		if (r !== im.rotation) {
			rotateImage(currentContextObject.id, currentContextObject.type,
				im,
				currentContextObject.src, r - im.rotation);
			// var rot = Math.round(r);
			// doRecordAdd({action:'imageRotate',id:currentContextObject.id,type:'symbol',rot:[im.rotation,rot],});
			// im.rotation = rot;
		}
	}

	function getLineID(path) {
		for (var id in lineInstances) {
			if (lineInstances[id].path == path) {
				console.log('Found existing line with id:', id);
				return id;
			}
		}
		return null;
	}

	function validatePath(path, force_id) {
		// only use force id for redo where the old id must be reused
		var next_id = nextID;
		var line_id = null;
		if (typeof force_id === 'undefined') {
			line_id = getLineID(path);
		} else {
			console.log("Force new line to id:", force_id);
			next_id = force_id;
		}
		//console.log("Path length:" + path.length);
		var round_only = !snapDefault;
		if (line_id !== null) {
			var inst = lineInstances[line_id];
			if (inst.hasOwnProperty('snap'))
				round_only = !inst.snap;
		}
		if (snapLine(path, round_only)) {
			if (line_id === null) { //this path doesn't exist
				console.log('Creating new line with id:', next_id);
				lineInstances[next_id] = {
					path: path
				};
				if (lineColor != defaultLineColor)
					lineInstances[next_id].color = lineColor;
				//console.log(lineInstances[next_id]);
				//console.log(lineInstances[0]);
				if (next_id == nextID)
					nextID++;
				line_id = next_id;
			}
			if (typeof force_id == 'undefined') { // else don't record redos
				var np = [lineSelected.firstSegment.point.clone(), lineSelected
					.lastSegment
					.point.clone()
				];
				var do_rec = {
					action: 'lineMove',
					id: line_id,
					type: 'line',
					pos: np
				};
				if (!!lineSelectedPosition)
					do_rec.oldValue = lineSelectedPosition;
				doRecordAdd(do_rec);
				selectItem(line_id, path);
				currentContextObject = {
					id: line_id,
					type: 'line',
					inst: lineInstances[line_id]
				}; //to match image instance object
			}
		} else { // length of line is too short
			console.log("Zero length line");
			if (line_id === null) { //this path doesn't exist
				path.remove();
			} else {
				removeLine(line_id);
			}
			return null;
		}
		return line_id;
	}

	function removeLine(id, record) {
		if (lineInstances.hasOwnProperty(id)) { // this path does exist
			var line = lineInstances[id];
			if (record) {
				var lp = [line.path.firstSegment.point.clone(), line.path.lastSegment
					.point
					.clone()
				];
				//console.log("Np:"+np[0]+","+np[1]);
				var do_rec = {
					action: 'lineDelete',
					id: id,
					type: 'line',
					oldValue: lp
				};
				if (line.hasOwnProperty('color'))
					do_rec.color = line.color;
				doRecordAdd(do_rec); // zero length line
			}
			line.path.remove(); // should remove from screen
			delete lineInstances[id]; // removes from list
		}
		if (selectedItems.hasOwnProperty(id))
			delete selectedItems[id];
	}

	function doRecordAdd(action) {
		if (doRecordIndex >= doRecord.length)
			doRecord.push(action);
		else {
			console.log("Recording action at index:", doRecordIndex);
			doRecord.splice(doRecordIndex, 0, action);
		}
		doRecordIndex++;
		writeEditStatus();
	}

	var controlPressMs = 0;
	var shiftPressMs = 0;
	var altPressMs = 0;
	var modPressDelay = 800; //delay in ms since mod key pressed for modified action

	function onKeyDown(event) { //note: this is the paper.js handler - do not confuse with html
		var d = new Date();
		var nowMs = d.getTime();
		if (event.key == 'control' || event.key == 'shift' || event.key ==
			'alt') {
			//console.log("Modifier pressed:"+event.key+" at "+nowMs);
			switch (event.key) {
				case 'control':
					controlPressMs = nowMs;
					break;
				case 'shift':
					shiftPressMs = nowMs;
					break;
				case 'alt':
					altPress = nowMs;
					break;
			}
			stopEvent(event);
			return false;
		}
		event.controlPressed = ((nowMs - controlPressMs) < modPressDelay) ||
			event.modifiers
			.control;
		event.shiftPressed = ((nowMs - shiftPressMs) < modPressDelay) ||
			event.modifiers
			.shift;
		event.altPressed = ((nowMs - altPressMs) < modPressDelay) || event.modifiers
			.alt;
		//console.log("Now:"+nowMs+" "+modPressDelay);
		//console.log("Now:"+(nowMs - controlPressMs));
		//console.log("Paperglue received:" + event.key);
		//console.log("Window keys:" + Object.keys(window));
		console.log("Key pressed:" + event.key);
		// some module such as dialog have modal behaviour
		// if set, off key to these
		if (typeof globals.modalKey === 'function') {
			console.log("Modal key:" + event.key);
			console.log(globals.modalKey);
			return globals.modalKey(event);
		}
		// other modules may just want to accept a hot key
		if (typeof globals.chainKey === 'function') {
			console.log("Starting key chain");
			if (!globals.chainKey(event)) {
				console.log("Paper glue ignoring keys");
				return false; // module stole key so no further process.
			}
		}
		var propagate = true;
		var delta = null; // for arrow keys
		if (event.controlPressed) {
			console.log("Key:" + event.key);
			switch (event.key) {
				case '+':
				case '=':
					console.log("Zoom screen");
					console.log("Center:" + view.center);
					console.log("Zoom:" + view.zoom);
					view.zoom *= 1.2;
					stopEvent(event);
					return true;
				case '-':
				case '_':
					console.log("Unzoom screen");
					view.zoom /= 1.2;
					stopEvent(event);
					return true;
				case 'backspace':
					baseLayer.scale(-1, 1, view.center);
					areaLayer.scale(-1, 1, view.center);
					cursorLayer.scale(-1, 1, view.center);
					layerFlip = [-layerFlip[0], layerFlip[1]];
					break;
				case 'f':
					baseLayer.scale(1, -1, view.center);
					areaLayer.scale(1, -1, view.center);
					cursorLayer.scale(1, -1, view.center);
					layerFlip = [layerFlip[0], -layerFlip[1]];
					break;
				case '[':
					if (editMode)
						raiseSelected(1);
					break;
				case ']':
					if (editMode)
						raiseSelected(-1);
					break;
				case '\\':
					if (editMode)
						raiseSwap();
					break;
				case 'z':
					console.log("cntrlZ");
					if (event.shiftPressed) {
						redo();
					} else {
						undo();
					}
					propagate = false;
					break;
				case 'x':
					console.log("cntrlX");
					if (event.shiftPressed) { // prune unnecessary edits
						if (confirm("Remove events with no end effect?")) {
							var remove_undo = confirm("Remove undo info?");
							doRecord = pruneDo(remove_undo);
							doRecordIndex = doRecord.length;
							console.log("Do record index =" + doRecordIndex);
						}
					} else { // undo and remove that particular redo
						undo();
						doRecord.splice(doRecordIndex, 1);
					}
					propagate = false;
					break;
				case '.':
					stepState(1, 1);
					break;
				case '>':
					stepState(1, 0);
					break;
				case ',':
					stepState(-1, 1);
					break;
				case '<':
					stepState(-1, 0);
					break;
				case 'left':
					delta = [-1, 0];
					break;
				case 'right':
					delta = [1, 0];
					break;
				case 'up':
					delta = [0, -1];
					break;
				case 'down':
					delta = [0, 1];
					break;
			}
			if (!!delta) {
				console.log("Delta:"+delta+" Type:"+currentContextObject.type);
				if (currentContextObject.type === 'symbol' ||
				(currentContextObject.type === 'image' && !getDragMode(currentContextObject))) {
					incMoveSymbol(currentContextObject, delta, !event.shiftPressed);
				} else if (currentContextObject.type === 'area') {
					incMoveArea(currentContextObject, delta, !event.shiftPressed);
				}
				propagate = false;
				// this bit doesn't make sense to me
				// if (typeof currentContextTable !== 'undefined')
				// 	contextMenu.set(currentContextTable);
			}
		} else {
			switch (event.key) {
				case 'delete':
					deleteSelected();
					console.log("Selected items:" + Object.keys(selectedItems));
					currentContextObject = null;
					propagate = false;
					if(typeof contextMenu !== 'undefined')
					  contextMenu.hide();
					hideCursor();
					break;
				case 'escape':
					if (!editMode) {
						if (confirm("Exit to edit mode?"))
							setEditMode(true);
					} else {
						if (event.shiftPressed) {
							if (confirm("Exit edit mode?"))
								setEditMode(false);
						} else {
              if(typeof contextMenu !== 'undefined')
  							contextMenu.hide();
							hideCursor();
						}
					}
					break;
				case 'left':
					delta = [-1, 0];
					break;
				case 'right':
					delta = [1, 0];
					break;
				case 'up':
					delta = [0, -1];
					break;
				case 'down':
					delta = [0, 1];
					break;
			}
			var grad;
			if (event.shiftPressed)
				grad = view.size.multiply(0.1);
			else
				grad = view.size.multiply(0.025);
			if (!!delta) {
				console.log("Center:" + view.center);
				console.log("delta:" + delta);
				console.log("grad:" + grad);
				var moveby = [Math.round(delta[0] * grad.width), Math.round(
					delta[1] *
					grad
					.height)];
				console.log("moveby:" + moveby);
				view.center = view.center.add(moveby);
				console.log("Center:" + view.center);
			}
		}
		writeEditStatus();
		if (propagate && (typeof globals.keyhandler == 'function')) {
			console.log("Passing key upwards");
			propagate = globals.keyhandler(event);
		} else {
			stopEvent(event);
		}
		return propagate;
	}

	function raiseSelected(raise_by) {
		for (var id in selectedItems) {
			console.log("Raise " + id + " by " + raise_by);
			raiseItem(id, raise_by, true);
		}
	}

	function raiseSwap() {
		var ids = Object.keys(selectedItems);
		if (ids.length !== 2)
			return;
		swapItems(ids[0], ids[1], true);
	}

	function swapItems(id1, id2, record) {
		var obj1 = null;
		var obj2 = null;
		var type1, type2;
		var id, idt;
		console.log("Swapping items:" + id1 + "+" + id2);
		if (lineInstances.hasOwnProperty(id1)) {
			obj1 = lineInstances[id1].path;
			type1 = 'line';
		} else if (symbolInstances.hasOwnProperty(id1)) {
			obj1 = symbolInstances[id1].raster;
			type1 = 'symbol';
		}
		if (lineInstances.hasOwnProperty(id2)) {
			obj2 = lineInstances[id2].path;
			type2 = 'line';
		} else if (symbolInstances.hasOwnProperty(id2)) {
			obj2 = symbolInstances[id2].raster;
			type2 = 'symbol';
		}
		if (!obj1 || !obj2)
			return;
		console.log("obj1:" + obj1.index);
		console.log("obj2:" + obj2.index);
		if (obj1.index < obj2.index) {
			obj1.insertAbove(obj2);
			id = id1;
			idt = id2;
			type = type1;
		} else {
			obj2.insertAbove(obj1);
			id = id2;
			idt = id1;
			type = type2;
		}
		if (typeof record !== 'undefined' && record)
			doRecordAdd({
				action: 'swap',
				type: type,
				id: id,
				id2: idt
			});
	}

	function raiseItem(id, raise_by, record) {
		var obj;
		var type;
		if (lineInstances.hasOwnProperty(id)) {
			obj = lineInstances[id].path;
			type = 'line';
		} else if (symbolInstances.hasOwnProperty(id)) {
			obj = symbolInstances[id].raster;
			type = 'symbol';
		}
		// raise is not applicable to raise
		// else if(areaInstances.hasOwnProperty(id))
		//   removeAreaInstance(id,true);
		if (!obj)
			return;
		var p = obj.parent;
		console.log("Layer children:" + p.children.length);
		console.log("Index:" + obj.index);
		if (raise_by < 0) {
			if (obj.index > 0)
				obj.insertBelow(p.children[obj.index - 1]);
			else
				return; //failed to happen so do't record
		} else {
			if (obj.index < p.children.length - 1)
				obj.insertAbove(p.children[obj.index + 1]);
			else
				return; // failed
		}
		if (typeof record !== 'undefined' && record)
			doRecordAdd({
				action: 'raise',
				type: type,
				id: id,
				by: raise_by
			});
	}

	function deleteSelected() {
		var c = Object.keys(selectedItems).length;
		console.log("Selected items:" + c);
		if (c > 0 && confirm("Remove " + c + " items?")) {
			for (var id in selectedItems) {
				console.log("Delete " + id);
				if (lineInstances.hasOwnProperty(id))
					removeLine(id, true);
				else if (symbolInstances.hasOwnProperty(id))
					removeSymbol(id, true);
				else if (areaInstances.hasOwnProperty(id))
					removeAreaInstance(id, true);
			}
		}
	}

	function incMoveSymbol(obj, direction, snap) {
		console.log("incMoveSymbol:"+direction);
		objPosition = obj.raster.position;
		var img_id = findInstance(symbolInstances, 'raster', true, obj.raster);
		if (snap) {
			obj.raster.position = obj.raster.position.add([direction[0] *
				snapRect[2],
				direction[1] * snapRect[3]
			]);
			if (!!img_id) {
				//console.log("instance found with id:"+img_id);  // need to keep id as well - might be null for master objects in layout mode
				//var src = symbolInstances[img_id].src;  // could have used obj.src
				var round_only = !snapDefault;
				if (img_id !== null) {
					var inst = symbolInstances[img_id];
					if (inst.hasOwnProperty('snap'))
						round_only = !inst.snap;
				}
				correctPosition(obj.raster, obj.src, round_only);
			}
		} else {
			obj.raster.position = obj.raster.position.add(direction);
		}
		doRecordAdd({
			action: 'imageMove',
			id: img_id,
			type: currentContextObject.type,
			oldValue: objPosition,
			pos: obj.raster.position
		});
	}

	function incMoveArea(obj, direction, snap) {
		objRect = obj.inst.rect.clone();
		var inst = obj.inst;
		var area_id = findInstance(areaInstances, 'path', true, inst.path);
		var delta = direction;
		if (snap) {
			delta[0] *= snapRect[2];
			delta[1] *= snapRect[3];
		}
		inst.rect = new Rectangle(objRect.topLeft.add(delta), objRect.bottomRight.add(delta));
		showArea(area_id);
		doRecordAdd({
			action: 'areaMove',
			id: area_id,
			type: 'area',
			oldValue: objRect,
			pos: inst.rect
		});
	}

	function buildImgList() {
		var img_list = [];
		console.log("Type:" + (typeof img_list));
		var img_ids = Object.keys(imagesLoaded);
		for (var id in imagesLoaded) {
			var im = imagesLoaded[id];
			var img = {};
			for (var ik in im) {
				if (ik === 'loadedProp')
					continue;
				console.log(ik);
				console.log("Loaded:" + im.loadedProp.indexOf(ik));
				console.log("Initial:" + im.initialProp.indexOf(ik));
				if ((im.loadedProp.indexOf(ik) < 0) || (im.initialProp.indexOf(
						ik) >= 0))
					img[ik] = im[ik];
			}
			console.log("Img:" + Object.keys(img));
			img_list.push(img);
			console.log("ImgList#:" + img_list);
		}
		console.log("ImgList:" + img_list);
		return img_list;
	}

	function buildRedoTxt(beautify, include_loader) {
		// made sort of JSON beautifier but may not use
		var txt = "";
		if (include_loader)
			txt += "var jdata='";
		var json_txt = buildRedoData();
		var indent = 0;
		var llc = null;
		var lc = null;
		var lt = []; // whether brace level caused indent
		var bl = 0;
		var col = 0;
		for (var ji in json_txt) {
			var c = json_txt[ji];
			if (beautify) {
				var nl = false; // assumption
				switch (c) {
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
				}
				if (lc === ',') {
					nl = true;
				}
				if (nl) {
					txt += "\n";
					for (var ti = 0; ti < indent; ti++)
						txt += "  ";
					col = indent * 2;
				}
				if (nl && lc !== ',')
					indent++;
			}
			txt += c;
			col++;
			llc = c;
			lc = c;
		}
		if (include_loader)
			txt += doRecLoader;
		return txt;
	}

	function buildRedoData() {
		// build reduced image list
		var img_list = buildImgList();
		var project_data = {
			imglist: img_list,
			dolist: doRecord
		};
		//console.log("project data:"+Object.keys(project_data));
		var jdata = "";
		try {
			jdata = JSON.stringify(project_data);
		} catch (err) {
			console.error("JSON Stringify error:" + err);
		}
		return jdata;
	}

	function parseRecord(jdata) {
		//try {
		console.log("Data=" + jdata);
		var project_data = JSON.parse(jdata);
		if (doRecord.length > 0)
			removeAll();
		imglist = project_data.imglist;
		console.log("Images to load:" + imglist.length); //Array.isArray(imglist));
		// add any images not already loaded - does not check date
		var overload_images = true;
		if (editMode && imglist.length > 0 && Object.keys(imagesLoaded) > 0)
			overload_images = confirm(
				"Overload existing images with same name?");
		var imgs_to_load = [];
		for (var ik in imglist) {
			//var ik = img_keys[ii];
			console.log("ik:" + ik + "=" + imglist[ik].id);
			if (!overload_images && imagesLoaded.hasOwnProperty(imglist[ik].id)) {
				console.log("This image already loaded");
				continue;
			}
			var imgobj = parseImageObj(imglist[ik]);
			imgs_to_load.push(imgobj);
		}
		console.log("Images to load:" + imgs_to_load);
		loadImages(imgs_to_load); //will add to previously set defaults
		var do_record = project_data.dolist;
		//for(var di in do_record) {
		//  console.log("ID:"+do_record[di].id);
		//}
		parsePaperRecord(do_record); // fixes point & rect data + to_do.id s
		//for(di in doRecord) {
		//  console.log("ID:"+doRecord[di].id);
		//}
		doRecordIndex = 0;
		doAll();

		//} catch(e2) {
		//   console.log("Error parsing file data"+e2);
		//}
	}

	function parsePaperRecord(do_record) {
		var new_nextID = 0; // nextID will be set to this after finding highest ID
		for (var di in do_record) {
			var to_do = do_record[di];
			if (to_do.hasOwnProperty('type') && to_do.type != 'image') // only images use string ids
				to_do.id = parseInt(to_do.id) + nextID;
			if (to_do.id >= new_nextID)
				new_nextID = to_do.id + 1;
			if (to_do.hasOwnProperty('pos')) {
				console.log("Fix pos");
				to_do.pos = parseLine(to_do.pos); // check for paper.js object JSON conversion problems
				if (to_do.hasOwnProperty('oldValue'))
					to_do.oldValue = parseLine(to_do.oldValue);
			} else if (to_do.hasOwnProperty('rect')) {
				console.log("Fix rect");
				to_do.rect = parseRect(to_do.rect); // check for paper.js object JSON conversion problems
			} else if (to_do.hasOwnProperty('size')) {
				console.log("Fix size");
				to_do.size = parseRect(to_do.size); // check for paper.js object JSON conversion problems
			}
			doRecord.push(to_do);
		}
		nextID = new_nextID;
		console.log("NextID will be " + nextID);
	}


	function parsePoint(ord) {
		console.log(ord[0]); // will be undefined for a real point
		if (ord[0] === 'Point')
			return new Point(ord[1], ord[2]);
		else
			return ord; // no change
	}

	// JSON doesn't know how to create a paper.Point
	function parseLine(arr) {
		if (!arr)
			return null;
		console.log("Type;" + (typeof arr));
		console.log(arr.length);
		if (arr.length === 2) {
			return [parsePoint(arr[0]), parsePoint(arr[1])];
		} else if (arr[0] === 'Point') {
			return parsePoint(arr);
		}
		return arr; // no change needed
	}

	function parseRect(ord) {
		console.log(ord[0]); // will be undefined for a real point
		if (ord[0] === 'Rectangle')
			return new Rectangle(ord[1], ord[2], ord[3], ord[4]);
		else
			return ord; // no change
	}

	function parseSize(ord) {
		console.log(ord[0]); // will be undefined for a real point
		if (ord[0] === 'Size')
			return new Size(ord[1], ord[2]);
		else
			return ord; // no change
	}

	function parseImageObj(obj) {
		// correct all the JSON parsed points in the obj
		var nobj = {};
		for (var k in obj) {
			if (Array.isArray(obj[k]))
				nobj[k] = parsePoint(obj[k]);
			else
				nobj[k] = obj[k];
		}
		console.log(nobj);
		return nobj;
	}

	function removeLines() {
		console.log("Removing lines:" + Object.keys(lineInstances).length);
		for (var id in lineInstances) {
			removeLine(id);
		}
	}

	function removeSymbols() {
		console.log("Removing images:" + Object.keys(symbolInstances).length);
		for (var id in symbolInstances) {
			symbolRemove(id);
		}
	}

	function clearAll() {
		removeLines();
		removeSymbols();
		removeAreas();
	}

	function removeAll() {
		if (editMode && !confirm("Do you want to clear current workspace?"))
			return;
		clearAll();
		doRecord = [];
		doRecordIndex = 0;
		nextID = 0; // start again
	}

	function removeSymbol(id, record) {
		if (record) {
			var obj = symbolInstances[id];
			doRecordAdd({
				action: 'symbolDelete',
				id: id,
				src_id: obj.src.id,
				pos: obj.raster.position,
				rot: obj.raster.rotation
			});
		}
		symbolRemove(id);
	}

	function undo() {
		console.log("Undo");
		if (doRecord.length <= 0 || doRecordIndex === 0)
			return; // nothing to undo
		console.log("doRecordIndex: " + doRecordIndex);
		doRecordIndex--;
		var last_do = doRecord[doRecordIndex];
		console.log("Undoing " + last_do.action + " for " + last_do.id +
			" which as pos:" + last_do.pos);
		var raster;
		switch (last_do.action) {
			case 'lineMove':
				if (Object.keys(lineInstances).indexOf(String(last_do.id)) < 0) {
					console.log('No instance of line id:' + last_do.id);
					break;
				}
				var path = lineInstances[last_do.id].path;
				if (!last_do.hasOwnProperty('oldValue') || !last_do.oldValue) { // no previous existance
					removeLine(last_do.id);
				} else {
					path.firstSegment.point = last_do.oldValue[0];
					path.lastSegment.point = last_do.oldValue[1];
					console.log("Return path to " + last_do.oldValue);
				}
				break;
			case 'lineColor': // also applies to all new lines
				if (last_do.hasOwnProperty('oldValue'))
					lineColor = last_do.oldValue;
				else
					lineColor = defaultLineColor;
				setLineColor(last_do.id, lineColor);
				break;
			case 'imageMove':
				if (last_do.type === 'image')
					raster = imagesLoaded[last_do.id].raster;
				else
					raster = symbolInstances[last_do.id].raster;
				if (doRecordIndex > 0) {
					var prev_do = doRecord[doRecordIndex - 1];
					if (prev_do.action == 'symbolPlace') { // this was the first drag
						console.log("Remove symbol from instances");
						console.log("Attempting to remove instance of " + prev_do.src_id +
							" with " + prev_do.id);
						symbolRemove(prev_do.id);
						doRecordIndex--; // skip back over symbol places too
						break;
					}
				}
				if (typeof last_do.pos != 'undefined') { // check it has a pos
					raster.position = last_do.oldValue;
					console.log("Return img position to " + last_do.oldValue);
				}
				break;
			case 'imageRotate':
				if (last_do.type === 'image')
					raster = imagesLoaded[last_do.id].raster;
				else
					raster = symbolInstances[last_do.id].raster;
				console.log("oldValue:" + last_do.oldValue);
				if (typeof last_do.oldValue != 'undefined') { // check it has a pos
					raster.position = last_do.oldValue[0]; // required for non centered rotation
					raster.rotation = last_do.oldValue[1];
					console.log("Return img rotation to " + raster.rotation +
						"at pos " +
						raster.position);
				}
				break;
			case 'lineDelete':
				remakeLine(last_do, last_do.oldValue);
				if (last_do.hasOwnProperty('color')) {
					var c = lineColor;
					setLineColor(last_do.id, last_do.color);
					lineColor = c; // undelete should not change linecolor
				}
				break;
			case 'symbolDelete':
				console.log("replace image:" + last_do.id);
				symbolPlace(last_do.src_id, last_do.id);
				raster = symbolInstances[last_do.id].raster;
				raster.position = last_do.pos;
				raster.rotation = last_do.rot;
				break;
			case 'setArea':
				removeAreaInstance(last_do.id, false);
				break;
			case 'rename':
				if (last_do.type === 'area')
					nameArea(last_do.oldValue, last_do.id);
				else
					nameImage(last_do.oldValue, last_do.id);
				break;
			case 'move':
				if (last_do.type === 'area')
					moveArea(last_do.oldValue, last_do.id);
				break;
			case 'areaDelete':
				areaInstances[last_do.id] = {
					rect: last_do.rect
				};
				if (typeof last_do.name !== 'undefined')
					areaInstances[last_do.id] = last_do.name;
				if (areasVisible)
					showArea(last_do.id);
				break;
			case 'setState':
				if (last_do.hasOwnProperty('clearFlag') && last_do.clearFlag) {
					// somehow need to restore everything that was there?
					alert("State clear flag set. Go forward or skip to state.");
					doRecordIndex++;
				}
				break;
			case 'raise':
				raiseItem(last_do.id, -last_do.by);
				break;
			case 'swap':
				swapItems(last_do.id2, last_do.id);
				break;
			case 'flash':
				setImageOpacity({
					id: last_do.id
				});
				break;
			case 'opacity':
				setImageOpacity({
					id: last_do.id,
					opacity: last_do.oldValue
				});
				break;
		}
		writeEditStatus();
	}

	function remakeLine(to_do, pos) {
		newLine(); //set lineSelected
		//console.log(to_do.pos);
		lineSelected.add(pos[0]);
		lineSelected.add(pos[1]);
		//console.path("line:" + lineSelected);
		// need to reuse old id
		var id = validatePath(lineSelected, to_do.id); // adds to lineInstances
		lineSelected = null;
	}

	function redo() {
		console.log("Redo");
		if (doRecordIndex >= doRecord.length)
			return false; // nothing to undo
		console.log("doRecordIndex:" + doRecordIndex);
		console.log("doRecord.length:" + doRecord.length);
		var to_do = doRecord[doRecordIndex];
		if (to_do.id > nextID)
			nextID = to_do.id; // this used to happen with loading of old data
		// now loads should advance all to_do ids to start after nextID
		//console.log(Object.keys(to_do));
		console.log("Redoing " + to_do.action + " @ " + doRecordIndex);
		var raster;
		var imgobj;
		switch (to_do.action) {
			case 'lineMove':
				console.log(Object.keys(lineInstances).length);
				if (!lineInstances.hasOwnProperty(to_do.id)) {
					console.log("path id " + to_do.id +
						" nolonger exists - remaking");
					remakeLine(to_do, to_do.pos);
				} else {
					var path = lineInstances[to_do.id].path;
					path.firstSegment.point = to_do.pos[0];
					path.lastSegment.point = to_do.pos[1];
				}
				break;
			case 'lineColor':
				setLineColor(to_do.id, to_do.color);
				break;
			case 'imageMove':
				if (to_do.type === 'image')
					imgobj = imagesLoaded[to_do.id];
				else
					imgobj = symbolInstances[to_do.id];
				raster = imgobj.raster;
				raster.position = to_do.pos;
				console.log("Moving to " + to_do.pos);
				break;
			case 'imageRotate':
				if (to_do.type === 'image')
					imgobj = imagesLoaded[to_do.id];
				else
					imgobj = symbolInstances[to_do.id];
				raster = imgobj.raster;
				raster.position = to_do.pos[0]; // required if rotation not about center
				raster.rotation = to_do.pos[1];
				break;
			case 'symbolPlace':
				symbolPlace(to_do.src_id, to_do.id);
				imageSelected = null;
				// this is normally followed by a drag move, so do this too
				to_do = doRecord[doRecordIndex + 1];
				//console.log("Index:"+(doRecordIndex+1)+" out of"+doRecord.length);
				if (to_do.action == 'imageMove') {
					doRecordIndex++;
					console.log("ID:" + to_do.id);
					raster = symbolInstances[to_do.id].raster;
					raster.position = to_do.pos;
				}
				break;
			case 'lineDelete':
				removeLine(to_do.id, false);
				break;
			case 'symbolDelete':
				removeSymbol(to_do.id, false); // delete is already in records
				break;
			case 'setArea': // doesn't matter if area still exists
				if (!areaInstances.hasOwnProperty(to_do.id))
					areaInstances[to_do.id] = {};
				areaInstances[to_do.id].rect = to_do.rect;
				if (areasVisible)
					showArea(to_do.id);
				break;
			case 'rename':
				if (to_do.type === 'area')
					nameArea(to_do.name, to_do.id);
				else
					nameImage(to_do.name, to_do.id);
				break;
			case 'move':
				if (to_do.type === 'area')
					moveArea(to_do.rect, to_do.id);
				break;
			case 'areaDelete':
				removeAreaInstance(to_do.id, false);
				break;
			case 'setState':
				console.log("SETSTATE");
				console.log(Object.keys(to_do));
				if (to_do.hasOwnProperty('clearFlag')) {
					console.log("clearFlag" + to_do.clearFlag);
					if (to_do.clearFlag) {
						console.log("Remove line, area and images - ie start again");
						clearAll(false);
					}
				} //doRecordIndex++;
				//redo();  // then skip to next do
				//writeEditStatus();
				//return;
				break;
			case 'raise':
				raiseItem(to_do.id, to_do.by);
				break;
			case 'swap':
				swapItems(to_do.id, to_do.id2);
				break;
			case 'flash':
				if (!editMode)
					flashImage(to_do);
				break;
			case 'opacity':
				setImageOpacity(to_do);
				break;
		}
		doRecordIndex++;
		writeEditStatus();
		return true; // something done
	}

	function doAll() {
		while (doRecordIndex < doRecord.length) {
			redo();
		}
	}

	function pruneDo(remove_undo) {
		// returned current do record pruned down to minimum actions necessary to repeat result
		// also used for system save.
		// console.log("BEFORE");
		// for(var i in doRecord) {
		//     console.log("#"+i+"="+doRecord[i].action+" to "+doRecord[i].id);
		// }
		var keep_all = false;
		var prunedDo = []; // a list of relevant do's.
		var ids_found = {}; // action arrays of objects already loaded into pruned list
		var to_do;
		for (var di = doRecordIndex - 1; di >= 0; di--) { // work backwards through do list
			//console.log("Do#"+di);
			to_do = doRecord[di];
			if (keep_all) {
				prunedDo.splice(0, 0, to_do);
				continue;
			}
			switch (to_do.type) {
				case 'setState':
					prunedDo.splice(0, 0, to_do);
					if (di < doRecordIndex - 1)
						keep_all = true;
					break;
				case 'symbol':
					if (!symbolInstances.hasOwnProperty(to_do.id))
						continue; // image nolonger exists
					break;
				case 'line':
					if (!lineInstances.hasOwnProperty(to_do.id))
						continue;
					break;
				case 'area':
					if (!areaInstances.hasOwnProperty(to_do.id))
						continue;
					break;
			}
			if (ids_found.hasOwnProperty(to_do.id)) {
				if (ids_found[to_do.id].indexOf(to_do.action) >= 0)
					continue;
				ids_found[to_do.id].push(to_do.action);
			} else {
				ids_found[to_do.id] = [to_do.action]; // this object covered one way or other - NOTE: push will convert everything to string without the + prefix but indexof only works with Strings
			}
			if (remove_undo && to_do.hasOwnProperty('oldValue'))
				delete to_do.oldValue;
			prunedDo.splice(0, 0, to_do);
			//console.log("Pruned adding:"+to_do.action + " for:"+to_do.id);
		}
		keep_all = false;
		if (doRecordIndex > 0 && doRecord[doRecordIndex - 1].type ===
			'setState')
			keep_all = true;
		for (di = doRecordIndex; di < doRecord.length; di++) {
			// work forwards to look for future states
			//console.log("Do#"+di);
			to_do = doRecord[di];
			if (to_do.type === 'setState')
				keep_all = true;
			if (keep_all)
				prunedDo.push(to_do);
		}
		// console.log("AFTER");
		// for(i in prunedDo) {
		//   console.log("#"+i+"="+prunedDo[i].action+" to "+prunedDo[i].id);
		// }
		return prunedDo;
	}


	// global hooks for created objects

	function getNextID() {
		return nextID;
	}

	function getSymbolInstances() {
		return symbolInstances;
	}

	function getNumSymbols() {
		return symbolInstances.length;
	}

	function getImageInstances() {
		return imagesLoaded;  // imageInstances; ???
	}

	function getLineInstances() {
		console.log("Returning line instances:", Object.keys(lineInstances)
			.length);
		return lineInstances;
	}

	function getAreaInstances() {
		console.log("Returning area instances:", Object.keys(areaInstances)
			.length);
		return areaInstances;
	}

	function getStates() {
		console.log("Returning do record state instances");
		var states = [];
		for (var i in doRecord) {
			var do_rec = doRecord[i];
			if (do_rec.action === 'setState')
				states.push({
					index: i,
					state: do_rec
				});
		}
		return states;
	}

	function getDoRecord() {
		//console.log("Returning do record:", doRecord.length);
		return doRecord;
	}

	function getDoIndex() {
		//console.log("Returning do record index:", doRecordIndex);
		return doRecordIndex;
	}

	function getDoLength() {
		//console.log("Returning do record index:", doRecordIndex);
		return doRecord.Length;
	}

	function getCurrentContextObject() {
		return currentContextObject; // remeber this is not an instance - contains id into instance
	}

	function removeSymbolRecord(src) {
		// removes all instances of an image with src from doRecord
		var found = false;
		var symbols = [];
		do {
			for (var i in doRecord) {
				var dorec = doRecord[i];
				var del = false;
				if (dorec.action === 'symbolPlace' && dorec.src_id === src) {
					symbol_ids.push(dorec.img_id);
					del = true; // remove image creations
				} else if (dorec.type === 'symbol' && dorec.id in symbol_ids)
					del = true; // remove every symbol that used this img
				if (del) {
					delete doRecord[i];
					found = true;
					break;
				}
			}
		} while (found); // have to start again each time an instance is found
	}

	function delCurrentContextObject() {
		//{id:id,type:'image',inst:imgobj,src:imgobj,raster:imgobj.raster}
		switch (currentContextObject.type) {
			case 'image':
				currentContextObject.raster.remove();
				delete currentContextObject.inst.raster;
				var instances = 0;
				for (var symb in symbolInstances) {
					if (symb.src === currentContextObject.inst)
						instances++;
				}
				console.log("Found this image being used " + instances +
					"times");
				if (instances === 0) { // safe to delete for current state
					var pot_instances = 0;
					for (var i in doRecord) {
						var dorec = doRecord[i];
						if (dorec.action === 'symbolPlace' && dorec.src_id ===
							currentContextObject.id)
							pot_instances++;
					}
					console.log("found this image in record " + pot_instances);
					if (pot_instances === 0 ||
						confirm("Remove " + pot_instances +
							"instances from doRecord also?")) {
						if (pot_instances > 0) {
							removeSymbolRecord(currentContextObject.id);
						}
						delete imagesLoaded[currentContextObject.id];
					}
				}
				hideCursor();
				break;
			case 'symbol':
				removeSymbol(currentContextObject.id, true);
				hideCursor();
				break;
			case 'line':
				removeLine(currentContextObject.id, true);
				break;
			case 'area':
				removeArea(currentContextObject.id, true);
				break;
		}
	}

	function setCenterToCursor() {
		if (currentContextObject.hasOwnProperty('src')) {
			var src = currentContextObject.src;
			if (currentContextObject.hasOwnProperty('raster')) {
				var raster = currentContextObject.raster;
				var dp = raster.position.subtract(cursorPos[0]);
				src.center = (roundPoint(dp.rotate(-raster.rotation))) / src.scale;
				cursorPos[2] = cursorPos[0];
				console.log("Center:" + src.center);
				if (!src.hasOwnProperty('origin')) // probably the same if not set
					src.origin = src.center;
			}
		}
		hideCursor();
	}

	function setOriginToCursor() {
		if (currentContextObject.hasOwnProperty('src')) {
			var src = currentContextObject.src;
			if (currentContextObject.hasOwnProperty('raster')) {
				var raster = currentContextObject.raster;
				var dp = raster.position.subtract(cursorPos[0]);
				src.origin = (roundPoint(dp.rotate(-raster.rotation))) / src.scale;
				cursorPos[3] = cursorPos[0];
				console.log("Origin:" + src.origin);
				if (!src.hasOwnProperty('center')) // probably the same if not set
					src.center = src.origin;
			}
		}
		hideCursor();
	}

	function setEditMode(state) {
		editMode = state;
		var mode;
		if (editMode) {
			mode = 'edit';
			console.log("**EDIT MODE**");
			if (areasVisible)
				showAllAreas();
		} else {
			mode = 'run';
			console.log("**RUN MODE**");
			for (var id in imagesLoaded) {
				var img = imagesLoaded[id];
				if (img.hasOwnProperty('opacity'))
					img.raster.opacity = img.opacity;
				else
					img.raster.opacity = 1.0;
			}
			hideAreas();
		}

		if (typeof window.globals.setMode !== 'undefined')
			window.globals.setMode(mode);
	}

	function areaSelect() {
		var rect = new Rectangle(roundPoint(areaSelected.segments[0].point),
			roundPoint(areaSelected.segments[2].point));
		console.log("rect:" + rect);
		if (areasVisible) {
			for (var aid in areaInstances) {
				var a = areaInstances[aid];
				console.log("TopLeft:" + a.rect.topLeft);
				console.log("BottomRight:" + a.rect.bottomRight);
				if (rect.contains(a.rect.topLeft) && rect.contains(a.rect.bottomRight)) {
					if (a.hasOwnProperty('path'))
						selectedItems[aid] = a.path;
					selectedPos[aid] = a.path.position;
					a.path.selected = true;
				}
			}
		}
		for (var id in lineInstances) {
			var l = lineInstances[id];
			if (rect.contains(l.path.firstSegment.point) && rect.contains(l.path
					.lastSegment
					.point)) {
				selectedItems[id] = l.path;
				// for lines, the selectedPos is both the start and end to match normal line moves
				selectedPos[id] = [l.path.firstSegment.point.clone(), l.path.lastSegment
					.point
					.clone()
				];
				l.path.selected = true;
			}
		}
		for (var iid in symbolInstances) {
			var imgobj = symbolInstances[iid];
			var bounds = imgobj.raster.bounds;
			console.log("Bounds" + bounds);
			if (rect.contains(bounds.topLeft) && rect.contains(bounds.bottomRight)) {
				selectedItems[iid] = imgobj.raster;
				selectedPos[iid] = imgobj.raster.position;
				imgobj.raster.selected = true;
			}
		}
		hideArea();
	}

	// for loading a static js doRecord
	function loadDoRec(fname) {
		if (typeof fname === 'undefined')
			fname = "importRecord";
		console.log("Run global function " + fname);
		parseRecord(window.globals[fname]);
	}

	/* Add meta data to do record from external
	   If to_seleted is true then it is added to select instances
	   Otherwise a meta event is created with the data
	*/
	function addMeta(to_selected, meta_data) {
		if (to_selected) {
			var sok = Object.keys(selectedItems);
			if (sok.length > 0) {
				doRecordAdd({
					action: 'addMeta',
					ids: Object.keys(selectedItems)
				} + meta_data);
				for (var sid in selectedItems) {
					if (lineInstances.hasOwnProperty(sid)) {
						lineInstances[sid] += meta_data;
					} else if (areaInstances.hasOwnProperty(sid)) {
						areaInstances[sid] += meta_data;
					} else if (symbolInstances.hasOwnProperty(sid)) {
						symbolInstances[sid] += meta_data;
					}
				}
			} else
				console.log("No selected items to add meta data to.");
		} else {
			doRecordAdd({
				action: 'addMeta'
			} + meta_data);
		}
	}

	function getState() {
		// tricky - do we go to the next state or the previous
		// do we delete anything in between?
	}

	function deleteState() {
		if (doRecordIndex >= doRecord.length)
			return;
		var dorec = doRecord[doRecordIndex];
		if (dorec.type != 'state')
			return; // no state here
		if (confirm("Remove state @ " + doRecordIndex + "?")) {
			doRecord.splice(doRecordIndex, 1);
		}
		if (editMode)
			writeEditStatus();
	}

	function setState(state) {
		var id = null;
		var to_do;
		if (doRecordIndex > 0) {
			to_do = doRecord[doRecordIndex - 1];
			if (to_do.type === 'setState') { // this position already stated
				if (confirm("Previous action is state of name:" + to_do.name +
						"\nDo you wish to replace?")) {
					id = to_do.id;
					doRecord.splice(--doRecordIndex, 1);
				}
			}
		}
		console.log("doRecordIndex:" + doRecordIndex);
		console.log("doRecord.length:" + doRecord.length);
		if (doRecordIndex < doRecord.length) { //replacing current state
			to_do = doRecord[doRecordIndex];
			if (to_do.type === 'setState') { // this position already stated
				id = to_do.id;
				console.log("Length:" + doRecord.length);
				doRecord.splice(doRecordIndex, 1);
				console.log("Length:" + doRecord.length);
			}
		}
		var inst = state;
		var dorec = {
			action: 'setState',
			id: id,
			type: 'state'
		};
		for (var k in state) {
			dorec[k] = state[k];
			console.log("State key:" + k + " = " + state[k]);
		}
		console.log("Adding state:" + Object.keys(state));
		doRecordAdd(dorec); // where state is an object
		return doRecordIndex;
	}

	function getCurrentState() {
		if (doRecordIndex >= doRecord.length)
			return null;
		var dorec = doRecord[doRecordIndex];
		if (dorec.action !== 'setState')
			return null;
		return dorec;
	}

	function getNextState(start_index) {
		var dorec = scanStateForward(start_index);
		return dorec;
	}

	function skipToIndex(index) {
		if (index > doRecord.length)
			index = doRecord.length;
		doRecordIndex = index;
		console.log("Skipping to index:" + index);
		if (editMode)
			writeEditStatus();
	}

	function forwardToIndex(index) {
		if (index < doRecordIndex) {
			if (editMode) {
				if (confirm("Do you want to scan from start?")) {
					clearAll(false);
					doRecordIndex = 0;
				}
			} else {
				console.error("Trying to go to older state");
				return;
			}
		}
		while (doRecordIndex < index)
			redo();
	}

	function scanStateForward(state_point) {
		if (typeof start_index === 'undefined')
			start_index = doRecordIndex;
		for (var di = doRecordIndex; di < doRecord.length; di++) {
			var dorec = doRecord[di];
			if (dorec.type === 'setState') {
				console.log("Found state at:" + di);
				return dorec;
			}
		}
		return null;
	}

	function gotoState(nm, direction, rate) {
			var dorec;
			do {
				dorec = stepState(direction, rate);
			} while (!!dorec && dorec.name !== nm);
		}
		/* Go to a particular state

		   rate = 1.0 then use dt as per state
		   rate = 0.0 then go immediate
		   rate = -ve then skip others to start at previous (or next reverse) state
		*/
	function stepState(direction, rate) {
		// direction = -1 for back or +1 for forward
		console.log("Step state direction:" + direction + " rate:" + rate);
		var steps = 0;
		while ((direction < 0 && doRecordIndex > 1) ||
			(direction > 0 && doRecordIndex < doRecord.length)) {
			if (doRecordIndex > 0) {
				var dorec = doRecord[doRecordIndex - 1];
				if (dorec.action === 'setState') {
					console.log("Just past state:" + dorec.nm);
					if (direction > 0) // use this states rate
						currentStateRate = dorec.dt * rate;
					else { // scan backwards for previous state to get rate
						// var dr = scanStateForward();
						// if(!!dr) {
						//   currentStateRate = dr.dt*rate;
						// } else  // no previous state
						currentStateRate = 0.0;
					}
					if (steps > 0)
						return dorec.name;
				}
			}
			console.log("Step");
			if (direction < 0)
				undo();
			else
				redo();
			steps++;
			console.log("RecordIndex:" + doRecordIndex);
			console.log(direction + "," + doRecord.length);
		}
		return null; // to indicate that we failed to find state point
	}

	// the following is used for adding a loader to a doRec.js include
	var doRecLoader = "';\nwindow.globals.importRecord = jdata;\n";

	function recordFlash(id, para) {
		doRecordAdd({
			action: 'flash',
			id: id,
			type: getIdType(id),
			flashUpRate: para.flashUpRate,
			flashDownRate: para.flashDownRate,
			flashHigh: para.flashHigh,
			flashLow: para.flashLow
		});
	}

	function flashImage(dorec) {
		if (symbolInstances.hasOwnProperty(dorec.id))
			img = symbolInstances[dorec.id];
		else if (imagesLoaded.hasOwnProperty(dorec.id))
			img = imagesLoaded[dorec.id];
		else {
			console.error("Could not find image with id =" + dorec.id);
			return;
		}
		img.flashUpRate = dorec.flashUpRate;
		img.flashDownRate = dorec.flashDownRate;
		img.flashHigh = dorec.flashHigh;
		img.flashLow = dorec.flashLow;
		img.flashUp = true;
		flashingImages[dorec.id] = img;
	}

	function recordOpacity(id, op) {
		var img, typ;
		if (symbolInstances.hasOwnProperty(id)) {
			img = symbolInstances[id];
			typ = 'symbol';
		} else if (imagesLoaded.hasOwnProperty(id)) {
			img = imagesLoaded[id];
			typ = 'image';
		}
		if (img.hasOwnProperty("opacity")) {
			if (op === img.opacity)
				return false;
		} else if (op === 1.0)
			return false;
		var dorec = {
			action: 'opacity',
			id: id,
			type: typ,
			opacity: op
		};
		if (img.hasOwnProperty("opacity"))
			dorec.oldValue = img.opacity;
		doRecordAdd(dorec);
		return true;
	}

	function getIdType(id) {
		if (symbolInstances.hasOwnProperty(id))
			return 'symbol';
		else if (imagesLoaded.hasOwnProperty(id))
			return 'image';
		else if (lineInstances.hasOwnProperty(id))
			return 'line';
		else if (areaInstances.hasOwnProperty(id))
			return 'area';
		else
			return null;
	}

	function setImageOpacity(dorec) {
		if (symbolInstances.hasOwnProperty(dorec.id))
			img = symbolInstances[dorec.id];
		else if (imagesLoaded.hasOwnProperty(dorec.id))
			img = imagesLoaded[dorec.id];
		else {
			console.error("Could not find image with id =" + dorec.id);
			return;
		}
		if (dorec.hasOwnProperty('opacity'))
			img.raster.opacity = dorec.opacity;
		else
			img.raster.opacity = 1.0;
		if (flashingImages.hasOwnProperty(dorec.id)) {
			delete flashingImages[dorec.id];
			if (img.hasOwnProperty('flashUp'))
				delete img.flashUp; // so that flash is over
		}
	}

	var commonFlashUp = true;
	var lastFlashTime = 0;
	var onFrameBusy = false;

	function onFrame(event) {
		//console.log("Frame");
		view.draw();
		if (onFrameBusy)
			return;
		onFrameBusy = true; // prevent overrun
		//console.log("Count:"+event.count+" Time:"+event.time);
		var dt = event.time - lastFlashTime;
		if (dt < 0.04) {
			onFrameBusy = false;
			return;
		}
		lastFlashTime = event.time;
		var img, id;
		if (editMode) {
			for (id in imagesLoaded) {
				img = imagesLoaded[id];
				if (!img.hasOwnProperty('raster'))
					continue;
				if (!img.dragClone || img.raster === imageSelected) {
					if (img.hasOwnProperty('opacity'))
						img.raster.opacity = img.opacity;
					else
						img.raster.opacity = 1.0;
					continue;
				}
				//console.log("Flash "+Math.round(img.raster.opacity*100)+" id:"+id);
				var flash_prop = {
					flashUpRate: 0.05,
					flashDownRate: 0.3,
					flashHigh: 0.8,
					flashLow: 0.5
				};
				if (!img.hasOwnProperty('flashUp'))
					img.flashUp = true;
				img.flashUp = flashImg(img, img.flashUp, flash_prop);
			}
		} else {
			for (id in flashingImages) {
				img = flashingImages[id];
				var flash_up = true;
				if (img.hasOwnProperty('flashUp'))
					flash_up = img.flashUp;
				img.flashUp = flashImg(img, flash_up);
			}
			//console.log("Sprites:"+sprites);
			try {
			for (id in sprites) {
				// sprites are rasters with motion and or animation
        img = sprites[id];
				if(img.hasOwnProperty('sprite'))
					spriteAnimate(img,dt);
				if(img.hasOwnProperty('pos')) {
					img.raster.position = img.pos;
				  if(img.hasOwnProperty('vel')) {
						img.pos = img.pos.add(img.vel.multiply(dt));
						//console.log("Pos:"+img.pos+" dt:"+dt+" vel:"+img.vel+" = "+img.vel.multiply(dt));
  				  if(img.hasOwnProperty('acc')) {
	  				  img.vel = img.vel.add(img.acc.multiply(dt));
						}
					}
				}
				if(img.hasOwnProperty('update')) {
						img.update(img,dt);
				}
				if(img.hasOwnProperty('rot')) {
					img.raster.rotation += img.rot*dt;
				}
			}
		} catch(e) {
			console.log("Exception in sprite loop:"+e);
		}
		}
		onFrameBusy = false; // allow new event
	}

	function spriteAnimate(img, dt) {
		if(!img.sprite.hasOwnProperty('tm')) {
		  img.sprite.tm = 0;
			img.sprite.index = 0;
		}
		if(img.sprite.tm <= 0) {
			img.sprite.tm += img.sprite.period;
			//console.log("Period:"+img.sprite.period);
			// sprite = { tm:0,action:index_into_dclip ,nextAction:action: ,index:0,dclip:see_below }
			var dclip = img.sprite.dclip[img.sprite.action];
			//console.log("dclip[0]:"+dclip[4].x);
			//console.log("dclip[0]:"+dclip[5].x);
			//console.log("dindex:"+img.sprite.index);
			var dindex = dclip[img.sprite.index];
			//console.log("dindex:"+Object.keys(dindex));
			//console.log(dindex.y,dindex.y);
			var clip = new Rectangle(img.sprite.clipSize.width*dindex.x,img.sprite.clipSize.height*dindex.y,img.sprite.clipSize.width,img.sprite.clipSize.height);
			//console.log(img.sprite.clipSize);  // returns zero fro chrome
			//console.log(img.raster.size);
			//console.log(clip);
			//clip = new Rectangle(20,20,30,30);
			var sr = img.src.raster;
			//console.log("sr:"+sr);
			var nr = sr.getSubRaster(clip);
			if(typeof img.raster !== 'undefined' && !!img.raster)
			  img.raster.remove();  // remove previous animation
			img.raster = nr;
			if(img.hasOwnProperty('scale')) {
				img.raster.scale(img.scale);
			}
			//console.log("dclip:"+Object.keys(dclip));
			// dclip is an array of [{x:y:}]
		  img.sprite.index++; // move to next frame
			//console.log("img.sprite.index:"+img.sprite.index);
			if(img.sprite.index >= dclip.length) {
			  img.sprite.index = 0;
				img.sprite.action = img.sprite.nextAction;
				dclip = img.sprite.dclip[img.sprite.action];
  			//console.log("dclip:"+Object.keys(dclip));
	  		//console.log("index:"+img.sprite.index);
			}
		} else {
		  img.sprite.tm -= dt;
		  //console.log("Sprite time:"+img.sprite.tm);
		}
	}

	function getSprites() {
		return sprites;
	}

	function flashImg(img, flash_up, flash_prop) {
		if (typeof flash_prop === 'undefined')
			flash_prop = img;
		var op;
		if (flash_up) { // shouldn't be here if this property missing
			op = img.raster.opacity + flash_prop.flashUpRate;
			if (op > flash_prop.flashHigh) {
				op = flash_prop.flashHigh;
				flash_up = false;
			}
		} else {
			op = img.raster.opacity - flash_prop.flashDownRate;
			if (op < flash_prop.flashLow) {
				op = flash_prop.flashLow;
				flash_up = true;
			}
		}
		img.raster.opacity = op;
		//console.log("OP:"+op);
		return flash_up;
	}

	function writeStatus(msg) {
		if (typeof window.globals.writeStatus === 'function')
			window.globals.writeStatus(msg);
	}

	function writeEditStatus() {
		var msg = "";
		msg += "Zoom:" + view.zoom + " Center:" + view.center + " Flip:" +
			layerFlip +
			" ";
		msg += 'EditMode Next do#' + doRecordIndex + '(of ' + doRecord.length +
			')';

		if (doRecordIndex < doRecord.length) {
			var dorec = doRecord[doRecordIndex];
			// msg += " = "+dorec.action;
			// if(dorec.hasOwnProperty("id")) {
			//   msg += " for "+dorec.id;
			//   if(dorec.hasOwnProperty("type"))
			//     msg += " of "+dorec.type;
			// }
			var col = null;
			var dorecColors = {
				state: 'red',
				line: 'yellow',
				image: 'blue',
				area: 'violet'
			};
			if (dorecColors.hasOwnProperty(dorec.type)) {
				col = dorecColors[dorec.type];
				msg += ' = <FONT style="BACKGROUND-COLOR: ' + col + '">';
			}
			msg += JSON.stringify(dorec);
			if (!!col)
				msg += '</FONT>';
		}
		writeStatus(msg);
	}

  function setContextMenu() {
    contextMenu = globals.contextMenu;
  }

	// think this needs to be at the bottom so other scripts find things fully loaded
	console.log("PaperGlue functions to window globals");
	// window global are use for cross scope communications
	var exports = {
		init: init,
		rasterize: rasterize,
		loadImages: loadImages,
		loadSingleImage: loadSingleImage,
		getNextID: getNextID,
		getsymbols: getSymbolInstances,
		getNumSymbols: getNumSymbols,
		symbolPlace:symbolPlace,
		getImages: getImageInstances,
		getLines: getLineInstances,
		getAreas: getAreaInstances,
		getStates: getStates,
		getDoRecord: getDoRecord,
		getDoIndex: getDoIndex,
		getDoLength: getDoLength,
		setSnap: setSnap,
		setLineThickness: setLineThickness,
		getLineColor: getLineColor,
		setLineColor: setLineColor,
		setCurrentLineColor: setCurrentLineColor,
		removeAll:removeAll,
		getCurrentContextObject: getCurrentContextObject,
		delCurrentContextObject: delCurrentContextObject,
		nameCurrentImage: nameCurrentImage,
		moveCurrentImage: moveCurrentImage,
		scaleCurrentImage: scaleCurrentImage,
		setCenterToCursor: setCenterToCursor,
		setOriginToCursor: setOriginToCursor,
		showCursor: showCursor,
		hideCursor: hideCursor,
		showImageCursors: showImageCursors,
		getSnapDefault: getSnapDefault,
		toggleSnap: toggleSnap,
		getDragDefault: getDragDefault,
		getDragMode: getDragMode,
		toggleDrag: toggleDrag,
		getAreaCount: getAreaCount,
		setArea: setArea,
		showAreas: showAllAreas,
		hideAreas: hideAllAreas,
		toggleAreas: toggleAreas,
		changeAreaName: nameCurrentArea,
		moveCurrentArea: moveCurrentArea,
		setEditMode: setEditMode, // change this to false for application
		areaSelect: areaSelect,
		getAreaNameCall: getAreaNameCall,
		getAreaRectCall: getAreaRectCall,
		loadDoRec: loadDoRec,
		buildRedoData: buildRedoData,
		buildRedoTxt: buildRedoTxt,
		parseRecord: parseRecord,
		addMeta: addMeta,
		setState: setState,
		getCurrentState: getCurrentState,
		getNextState: getNextState,
		skipToIndex: skipToIndex,
		forwardToIndex: forwardToIndex,
		importDefaults: importDefaults,
		recordOpacity: recordOpacity,
		recordFlash: recordFlash,
		getSprites: getSprites,
    setContextMenu: setContextMenu   //optional module set
	};
	globals.paperGlue = exports;
	paperGlue = globals.paperGlue; // for dependant modules to add:
	// - fileSelector(objective,dir_obj) = a gui to display directories returned by list()

	if (typeof globals.moduleLoaded === 'function')
		globals.moduleLoaded('paperGlue', dependancies, init);
}());
