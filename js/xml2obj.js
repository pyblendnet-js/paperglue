function loadXML(txt) {
  var list = txt.split("<");
  var ecount = [];
  var tag_stack = [];
  var tag_level = 0;
  var root = {list:[],ecount:{}};
  var tag_obj = root;
  for(var i = 1; i < list.length; i++) {
    //console.log(list[i]);
    var el = list[i].split(">"); // seperate tag from content
    for(var j in el)  // should only be 2 items
      el[j] = el[j].trim();
    list[i] = el;
    var tag = el[0].split(" "); // seperate tag name from attribute;
    var en = tag[0];  // this should be the name of the tag
    if(en[0] === '!' || en[0] === '?')
      continue;  //ignor comments
    if(en[0] !== '/') {  // not a closing tag
      padding = "";
      for(var pi = 0; pi < tag_stack.length; pi++)
        padding += "  ";
      tag_stack.push(tag_obj);
      tag_obj = {tag:tag,list:[],ecount:{}};  //saves tag and attributes
      if(el[1].length > 0)
        tag_obj.val = el[1];
    } else {  //tag closing
      var nm = tag_obj.tag[0];
      tag_obj.obj = {};
      var tn = en.slice(1);  // remove leading slash
      //var ptn = parent.tag
      if(nm !== tn) {
        console.error("Closing tag "+tn+" does not matching opening tag:"+nm);
        break;
      }
      if(tag_obj.tag.length === 1 &&   // no attributes
         ((tag_obj.list.length === 0 && tag_obj.hasOwnProperty('val')) ||
          (tag_obj.list.length === 1))) {
        if(tag_obj.list.length === 0) {
          tag_obj.obj[nm] = tag_obj.val;
          delete tag_obj.val;
        } else {
          tag_obj.obj[nm] = tag_obj.list[0].obj;
        }
      } else {
        var values = {};
        tag_obj.obj[nm] = values;
        if(tag_obj.tag.length > 1) {
          values.attrib = tag_obj.tag.slice(1);
        }
        var mcount = 0;
        if(tag_obj.list.length > 1) { // look to see if all list items are unique
          var ec = tag_obj.ecount;
          for(var tnm in ec) {
            mcount = ec[tnm];
            if(mcount > 1) {  // more than one of the same tag so stays as array
              values.list = [];
              for(var li in tag_obj.list) {
                var lo = tag_obj.list[li].obj;
                values.list.push(lo);
              }
              break;
            }
          }
        }
        if(mcount === 1) {
          for(var onm in tag_obj.list) {
            var om = tag_obj.list[onm].obj;
            var k = Object.keys(om)[0];
            values[k] = om[k];
          }
        }
      }
      delete tag_obj.tag;
      delete tag_obj.list;
      delete tag_obj.ecount; // not required anymore
      var parent = tag_stack.pop();
      if(parent.ecount.hasOwnProperty(nm))
        parent.ecount[nm]++;
      else
        parent.ecount[nm] = 1;
      parent.list.push(tag_obj);
      tag_obj = parent;
    }
  }
  return root.list[0].obj;  // return object
}
