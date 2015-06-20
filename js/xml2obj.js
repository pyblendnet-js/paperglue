function loadXML(txt, inner_hash, attrib_hash) {
  if(typeof inner_hash === 'undefined')
    inner_hash = "text";  // default hash for inner values where attributes also exist on tag
  if(typeof attrib_hash === 'undefined')
      attrib_hash = "attrib";  // default hash for attribute values
  var list = txt.split("<");  // list will contain tags and tag contents
  var ecount = [];
  var tag_stack = [];
  var tag_level = 0;
  var root = {list:[],ecount:{}};  //root.list[0].obj is the return
  var tag_obj = root;  //pointer into current tag
  for(var i = 1; i < list.length; i++) { // skips first assuming anythign before "<" in xml shouldn't be there
    //console.log(list[i]);
    var el = list[i].trim().split(">"); // seperate tag from content
    for(var j in el)  // should only be 2 items
      el[j] = el[j].trim();  // possibly should be leaving spaces on content
    var tag = el[0];  // tag including any attributes
    var singleton = (tag.slice(-1) === '/');  // tag is a singleton
    if(singleton) {
      tag = tag.slice(0,-1);
    }
    list[i] = el;  // list item now contains [tag,inner]
    //if(el.length > 1) {
    //  console.log(el[1].length);
    //  console.log(el[0]+" Inner:"+el[1]);
    //}
    var tag_nm = tag.trim().split(" "); // seperate tag name from attribute;
    var en = tag_nm[0];  // this should be the name of the tag
    if(en[0] === '!' || en[0] === '?')
      continue;  //ignor comments
    if(en[0] !== '/') {  // not a closing tag
      //padding = "";
      //for(var pi = 0; pi < tag_stack.length; pi++)
      //  padding += "  ";
      //console.log("Slice of " + el[0] + " = " + el[0].slice(-1));
      tag_stack.push(tag_obj);
      //console.log("Moving to layer " + tag_stack.length);
      tag_obj = {tag:tag_nm,list:[],ecount:{}};  //saves tag and attributes
      if(el[1].length > 0) {
        if(tag_obj.hasOwnProperty('val'))
          console.error("Xml Error: Tag already has inner text:"+tag_obj.val);
        tag_obj.val = el[1];  // current tag has value obj
      }
    }
    if(en[0] === '/' || singleton) {  //tag closing
      //console.log("Closing tag:" + en);
      if(el.length > 1 && el[1].length > 0)
        console.error("Xml Error: Tag "+el[0]+" should not have text:"+el[1]);
      var nm = tag_obj.tag[0];
      tag_obj.obj = {};
      var tn;
      if(en[0] !== '/')
        tn = en;
      else
        tn = en.slice(1);  // remove leading slash
      //var ptn = parent.tag
      if(nm !== tn) {
        console.error("Xml Error: Closing tag "+tn+" does not matching opening tag:"+nm);
        break;
      }
      if(tag_obj.tag.length === 1 &&   // no attributes
         ((tag_obj.list.length === 0 && tag_obj.hasOwnProperty('val')) ||
          (tag_obj.list.length === 1))) {
        if(tag_obj.list.length === 0) {  // tag only has value
          //console.log("Converting inner value to object value");
          tag_obj.obj[nm] = tag_obj.val; // so { tagname: value }
          delete tag_obj.val;
        } else {
          tag_obj.obj[nm] = tag_obj.list[0].obj;
          if(tag_obj.hasOwnProperty('val'))
            console.error("Xml Error: Odd for <" + tag_obj.tag + "> to have inner text:"+tag_obj.val);
        }
      } else {
        var values = {};
        tag_obj.obj[nm] = values;
        if(tag_obj.tag.length > 1) {
          //console.log("Attrib:"+tag_obj.tag);
          var attr = {};
          for(var ai = 1; ai < tag_obj.tag.length; ai++) {
            var atr = tag_obj.tag[ai];
            var atb = atr.split("=");
            if(atb.length < 2) {
              console.error("Xml Error: For <"+tag_obj.tag[0]+"> could not parse attribute:" + atr + " for tag ");
            } else {
              var v = atb[1];
              // remove leading quotes
              if(v[0] === "'" || v[0] === '"') v = v.slice(1);
              //console.log("V ="+v);
              //console.log("V ="+v[v.length-1]);
              // remove trailing quotes
              if(v.length > 0) {
                if(v[v.length-1] === "'" || v[v.length-1] === '"') v = v.slice(0,-1);
                //console.log("V ="+v);
              }
              attr[atb[0]] = v;
            }
          }
          values[attrib_hash] = attr;
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
        if(tag_obj.hasOwnProperty('val'))
          values[inner_hash] = tag_obj.val;
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
