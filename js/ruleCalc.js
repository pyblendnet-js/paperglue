(function() { // using the module pattern to provide name space

function calcRule(rule, ease_fraction, symbol, input) {
  //console.log("Symbol keys:" + Object.keys(symbol));
  var rul = rule;
  var mth = "()-+*/";
  for(var c in mth) {
    rul = rul.replace(mth[c]," "+mth[c]+" ");
  }
  var rule_bits = rul.split(" ");
  //console.log("Rule bits:" + rule_bits);
  if(rule_bits[1] != "=") {
    console.error("Invalid rule:"+rule);
    return -1;
  }
  if(symbol.hasOwnProperty("nodes"))
    console.log("Nodes:" + JSON.stringify(symbol.nodes));
  var node_target = -1;
  var node_vi = -1;
  var para_target = "";
  var is_dependant = false;  // assume that target is not dependant on input
  var es = "";  // build eval statement
  for(var bi = 0; bi < rule_bits.length; bi++) {
    if(bi == 1)
      continue;
    var re = rule_bits[bi];
    if(re.length === 0)
      continue;
    var num_patt = /^[0-9]+$/;  //test is number
    var num_patt2 = /^-?\d+\.?\d*$/;
    var alpha_patt = /^[a-z]+$/i;  //test is number
    var alpha_num_patt = /^[a-z0-9]+$/i;  //test is number
    if(symbol.hasOwnProperty("nodes") && re.charAt(0) == "n" && (re.charAt(1) == "V" || re.charAt(1) == "I" || re.charAt(1) == "R") && num_patt.test(re.slice(2))) {
      var vi = 0;   // node voltage
      if(re.charAt(1) == "I")
        vi = 1;     // node current
      else if(re.charAt(1) == "R")
          vi = 2;     // node impedance
      var nt = parseInt(re.slice(2));
      //console.log("Node#"+nt);
      if(nt >= symbol.nodes.length) {
        console.error("Rule points to node #" + nt + " out of " + symbol.nodes.length + " nodes");
        return -1;
      }
      if(bi === 0) {
        node_target = nt;
        node_vi = vi;
        //console.log("Node target = "+ node_target);
        continue;
      } else {
        if(typeof input !== 'undefined' && nt === input)
          is_dependant = true;
        //console.log("nt:"+nt+" vi:"+vi);
        //console.log("Nodes:"+symbol.nodes.length);
        //console.log(" value:"+JSON.stringify(symbol.nodes));
        es += " " + symbol.nodes[nt][vi].toFixed(4);
      }
    } else if(alpha_patt.test(re)) {
      //console.log("Item#"+ bi + " is alpha");
      if(symbol.hasOwnProperty(re)) {
        if(bi === 0) {
          para_target = re;
          continue;
        }
        es += " " + symbol[re] + " ";  // symbol has this value
      } else if (typeof Math[re] === 'function') {
        es += " Math["+re+"]";
      }
    } else if(num_patt2.test(re)) {  // float number
      es += " " + re + " ";
    } else // not alpha or numeric - so hope it is an operator
      es += " " + re + " ";
    if(bi === 0 && node_target === -1 && para_target === "") {
      console.error("Target not recognised in rule:" + rule);
    }
  }
  //console.log("ES=" + es);
    //try {
    var val = eval(es);
    //console.log("Value = "+ val);
    //} catch(e) {
  if(node_target >= 0) {
    console.log("node["+node_target+"]["+node_vi+"] was =" + symbol.nodes[node_target][node_vi].toFixed(4));
    symbol.nodes[node_target][node_vi] = val * ease_fraction + (1.0 - ease_fraction) * symbol.nodes[node_target][node_vi];
    console.log("node["+node_target+"]["+node_vi+"] =" + es + " = " + val.toFixed(4) + " => " + symbol.nodes[node_target][node_vi].toFixed(4));
  } else {
    console.log(para_target + " = " + es + " = " + val.toFixed(2));
    symbol[para_target] = (val * ease_fraction + (1.0 - ease-fraction) * symbol[para_target]).toFixed(4);
  }
    //}
  if(typeof input === 'undefined' || is_dependant)
    return node_target;
  else
    return -1;
}

var globals = window.globals;
var exports = {
  calcRule:calcRule
};
globals.ruleCalc = exports;

if (typeof globals.moduleLoaded === 'function')
  globals.moduleLoaded('ruleCalc');
}());
