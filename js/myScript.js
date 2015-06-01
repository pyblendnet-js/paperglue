(function() { // using the module pattern to provide name space
  var globals = window.globals;
  var paperGlue = globals.paperGlue; // see initApp below
  var pgMenus = globals.pgMenus;
  var dependancies = ['paperGlue','pgMenus'];

  var wireLinks = [];


  // other parameters:
  //   origin = point in image which represents position
  //   center = point in image for rotation  e.g , center:[30,0]

  var first_image = {
    src: "img/con_Block_5.08mm_12.png",
    scale: 0.6,
    id: "conBlock1",
    isSymbol: true,
    dragClone: true,
    pos: null //view.center
  };

  console.log("Starting myScript");
  // this section has been replaced my need method of dependancy checks
  //console.log(Object.keys(window));
  //console.log(Object.keys(window.globals));
  // if (typeof window.globals.paperGlue === 'undefined') { // means myScript got here first and paperGlue was not ready
  //   console.log("paperGlue not ready yet to init app.");
  //   window.globals.onPaperGlueLoad = initApp; // paperGlue will call this when it is ready
  // } else {
  //   console.log("PaperGlue already loaded so can init app.");
  //   initApp(); // paperglue is already ready so can loadImages now
  // }
  // old method that was a bit messy and may be avoided if I used requirejs or browserify - though I suspect that paper.js will not like it.
  // see http://eloquentjavascript.net/10_modules.html on the subject of slow module loads

  function initApp() {
    console.log("Initialising application");
    //paper.install(window);
    //paper.setup('myCanvas');

    //paperGlue = window.globals.paperGlue; //to access paperGlue commands
    paperGlue.init(); // sets up extra layers
    drawStripBoard(10, 100, 34);
    paperGlue.loadImages([first_image], pgMenus.default_image_menus,postImageLoadInit);
    // init is completed after images have been loaded
  }

  function postImageLoadInit() {
    console.log("posImageLoadInit");
    paperGlue.setSnap([5, 5, 10, 10]);
    paperGlue.showAreas();
    //paperGlue.closeDialog = dialog.closeDialog;
    //paperGlue.fileSelector = dialog.fileSelectorDialog;
    paperGlue.loadDoRec(postDoRec);  //wait for image loads etc.
  }

  function postDoRec() {
    paperGlue.setEditMode(false); // begin in run mode
    console.log("Press ESC to exit run mode");
    animationExample();
  }

  function drawGrid(spacing) {
    var l;
    var myCanvas = document.getElementById("myCanvas");
    for (var y = 0; y < myCanvas.height; y += spacing) {
      l = new paper.Path();
      l.strokeColor = '#e0e0e0';
      l.add([0, y], [myCanvas.width, y]);
    }
    for (var x = 0; x < myCanvas.width; x += spacing) {
      l = new paper.Path();
      l.strokeColor = '#e0e0e0';
      l.add([x, 0], [x, myCanvas.height]);
    }
  }

  function drawStripBoard(spacing, length, width) {
    var l;
    var vh = width * spacing;
    var vw = (length + 1) * spacing;
    var path = new paper.Path.Circle([0, 0], spacing * 0.2);
    path.fillColor = 'white';
    var hole = new paper.Symbol(path);
    for (var y = spacing / 2; y < vh; y += spacing) {
      l = new paper.Path();
      l.strokeColor = '#e0e0e0';
      l.strokeWidth = spacing * 0.8;
      l.add([0, y], [vw, y]);
      for (var x = spacing / 2; x < vw; x += spacing) {
        hole.place([x, y]);
      }
    }
    paperGlue.rasterize();
  }

  function keyDown(event) { // note: This is accessed from paperglue.js - not directly
    // added controlPressed,shiftPressed,altPressed as values in event
    // if(event.key == 'control' || event.key == 'shift' || event.key == 'alt')
    //   return;
    console.log(event);
    console.log("myScript received:", event.key);
    if (event.controlPressed) {
      if (event.key == 'q') {
        console.log("cntrlQ");
        event.stopPropagation();
        var ab = document.getElementById("actionTableBody");
        console.log("Actions:" + ab.length);
        ab.innerHTML = createActionTableBody();
        var ca = document.getElementById("clientArea");
        var canvasDiv = document.getElementById("canvasDiv");
        var canvas = document.getElementById('myCanvas');
        canvasDiv.style.height = ca.clientHeight / 2 + 'px';
        var ad = document.getElementById("actionTableDiv");
        ad.style.height = ca.clientHeight / 2 + 'px';
        ad.style.display = "inline";

        return false;
      }
    }
    return true;
  }

  var manTarget;

  function animationExample() {
    console.log("Start animation example");
    var src_id = "running_man";
    var src_img = paperGlue.loadSingleImage("img/running_man.png",src_id,{isSymbol:false,onLoad:animationLoaded});
  }

  // callback when animation image has been loaded
  function animationLoaded(src_id,src_img) {
    console.log("src_img.raster:"+src_img.raster);
    console.log("src_img.src:"+src_img.src);
    console.log("src_img.pos:"+src_img.raster.position);
    src_img.raster.position = new Point(-1000,0);

    //src_img.raster.position = new Point(100,100);
    //console.log(Object.keys(paper.Raster));
    //src_img.raster.scale(1.0);
    //console.log("Src_img:"+Object.keys(src_img.raster));
    var img = {src:src_img}; // = paperGlue.symbolPlace(src_id,src_id);  // force_id prevents record creation

    // test
    clip = new Rectangle(20,20,30,30);
    var nr = src_img.raster.getSubRaster(clip);
    nr.position = new Point(200,100);
    img.raster = nr;
    // return;
    // end test

    img.pos = new Point(600,100);
    img.speed = 64;
    img.vel = new Point(img.speed,0);
    img.scale = new Point(2.0,2.0);
    img.update = runningManUpdate;
    var dclip = [];
    for(var yi = 0; yi < 5; yi++) {
      for(var xi = 0; xi < 6; xi++) {
        dclip.push({x:xi,y:yi});
      }
    }
    //console.log("Src_img:"+Object.keys(src_img.raster));
    var img_size = src_img.raster.size;
    var clip_size = new Size(img_size.width/6,img_size.height/5);
    console.log("Clip:"+clip_size);
    img.sprite = {action:0,nextAction:0,dclip:[dclip],clipSize:clip_size,period:0.025};
    console.log("images:"+Object.keys(paperGlue.getImages()));
    manTarget = paperGlue.getImages().conBlock1;
    src_img.raster.insertBelow(manTarget.raster);
    var sprites = paperGlue.getSprites();
    console.log("Sprites:"+sprites.length);
    sprites[src_id] = img;
    //console.log("Sprites:"+sprites.length);
    //console.log("Sprites:"+paperGlue.getSprites().length);
  }

  var manTargetDirection = 0;
  var manDirection = 0;

  function runningManUpdate(img, dt) {
    //console.log("imgX:"+img.pos.x);
    //console.log("Stop:"+window.innerWidth*3/4);
    if(img.vel.x > 0) {
      if(img.pos.x > (window.innerWidth*3/4)) {
        manTargetDirection = 180;
        img.src.raster.insertAbove(manTarget.raster);
        //img.raster.insertBelow(manTarget);
      }
    } else {
      if(img.pos.x < (window.innerWidth/4)) {
        manTargetDirection = 0;
        img.src.raster.insertBelow(manTarget.raster);
        //img.raster.insertAbove(manTarget);
      }
    }
    //console.log("dir:"+manTargetDirection);
    //console.log("mandir:"+manDirection);
    if(manDirection != manTargetDirection) {
      // check if manDirection goes past manTargetDirection (xor)
      manDirection = rotateTo(manDirection,20*dt,manTargetDirection);
    }
    var cos = Math.cos(manDirection*Math.PI/180.0);
    //console.log("cos:"+cos);
    img.scale = new Point(2.0*cos,2.0);
    img.vel = new Point(img.speed*cos,0);
  }

  function rotateTo(a_old,delta,target) {
    // delta must be positive
    // returns true if angle has gone past target
    var a_new = a_old + delta;
    var t2;
    if(delta > 0) {
      if((target > a_old) && (target <= a_new))
        return target;
      t2 = target + 360;
      if((t2 > a_old) && (t2 <= a_new))
        return target;
    } else {
      if((target < a_old) && (target >= a_new))
        return target;
      t2 = target - 360;
      if((t2 < a_old) && (t2 >= a_new))
        return target;
    }
    return a_new % 360;
  }

    //window.globals.keyhandler = keyDown;  // requests paperglue to pass event here

  //console.log("Globals:");
  //console.log(Object.keys(window.globals) ); //.onload();  //no use since it may not be added to globals yet
  if (typeof globals.moduleLoaded === 'function')
    globals.moduleLoaded('myScript', dependancies, initApp);
}());
