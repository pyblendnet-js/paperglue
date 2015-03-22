//note:objects in paperglue are in the paper scope

var wireLinks = [];

var objectMenu = [ {label:'name', propCall:imgGetNameCall},{label:'pos',propCall:imgGetPosCall} ];
var objectInstanceMenu = [ {label:'name', propCall:imgGetInstanceNameCall},{label:'pos',propCall:imgGetPosCall} ];
var first_image = {src:"img/verodes.png", id:"verodes", isSymbol:true, dragClone:true, contextMenu:objectMenu, instanceContextMenu:objectInstanceMenu, pos:view.center };
//
// var oldOnLoad = window.globals.onload;
// console.log("Settings window.globals");
// window.globals.onload = function() {
//   console.log("Loading images");
//   // if there is not any function hooked to it
//   if (typeof oldOnLoad != 'function')
//       oldOnLoad();
//   console.log("Loading images");
//   imagesToLoad.push(first_image);
//   loadImages();
// };

//view.on('frame', frameHandler);


window.globals.loadImages([first_image]);

function imgGetNameCall(obj){
  console.log('get name called');
  return obj.imageObject.id;
}

function imgGetInstanceNameCall(obj){
  console.log('get name called');
  return "" + obj.imageObject.id + "#" + obj.id;
}

function imgGetPosCall(obj){
  console.log('pos called');
  return obj.raster.position;
}
