(function() { // using the module pattern to provide name space

function calcRule(rule, ease_fraction, symbol) {
  console.log("Symbol keys:" + Object.keys(symbol));
  var rule_bits = rule.split(" ");
  if(rule_bits[1] != "=") {
    console.error("Invalid rule:"+rule);
    return;
  }
  console.log("Rule bits:" + rule_bits);
  var nodeTarget = -1;
  var paraTarget = "";
  var es = ease_fraction.toString() + " *(";  // build eval statement
  for(var bi = 0; bi < rule_bits.length; bi++) {
    if(bi == 1)
      continue;
    var re = rule_bits[bi];
    var num_patt = /^[0-9]+$/;  //test is number
    var num_patt2 = /^-?\d+\.?\d*$/;
    var alpha_patt = /^[a-z]+$/i;  //test is number
    var alpha_num_patt = /^[a-z0-9]+$/i;  //test is number
    if(symbol.hasOwnProperty("node") && re.charAt(0) == "n" && (re.charAt(1) == "V" || re.charAt(1) == "I") && num_patt.test(re.sliced(2))) {
      var nt = parseInt(re.sliced(2));
      console.log("Node#"+nt);
      es += " " + symbol.node[nt].toString;
      if(bi === 0) {
        nodeTarget = nt;
        continue;
      }
    } else if(alpha_patt.test(re)) {
      console.log("Item#"+ bi + " is alpha");
      if(symbol.hasOwnProperty(re)) {
        if(bi === 0) {
          paraTarget = re;
          continue;
        }
        es += " " + symbol[re].toString() + " ";  // symbol has this value
      } else if (typeof Math[re] === 'function') {
        es += " Math["+re+"]";
      }
    } else if(num_patt2.test(re)) {  // float number
      es += " " + re + " ";
    } else // not alpha or numeric - so hope it is an operator
      es += " " + re + " ";
    if(bi === 0) {
      console.error("Target not recognised in rule:" + rule);
    }
  }
  es += ")";
  console.log("ES=" + es);
    //try {
    var val = eval(es);
    console.log("Value = "+ val);
    //} catch(e) {
  if(nodeTarget >= 0)
    symbol.node[nodeTarget] = val;
  else {
    symbol[paraTarget] = val;
  }
    //}
}

var globals = window.globals;
var exports = {
  calcRule:calcRule
};
globals.ruleCalc = exports;

if (typeof globals.moduleLoaded === 'function')
  globals.moduleLoaded('ruleCalc');
}());
