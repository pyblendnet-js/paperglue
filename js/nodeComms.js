
  function SendData(data) {
    console.log('Sending' + data.length + 'bytes to ' + window.location.href);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', window.location.href, true);
    xhr.onerror = function (e) {
      console.error(xhr.statusText);
    };
    xhr.onload = OnLoad;
    //console.log(xhr);
    xhr.send(data);
  }

  function OnLoad(e) {
    var xhr = this;
    console.log("E:" + e);
    console.log("Ready state:",xhr.readyState);
    if(xhr.readyState === 4) {
      if(xhr.status === 200) {
        console.log("Response:"+xhr.responseText);
        //console.log("Response Type:"+xhr.responseType);
        if(xhr.responseText.length === 0) {
          console.log("Server listening!");
        } else {
          if(typeof nodeComms.onReply === 'function')
            nodeComms.onReply(xhr.responseText);
        }
      } else {
        console.error("Error:"+xhr.statusText);
      }
    }
  }
  //
  // function fileSelected(fid) {
  //   var req = "ls " + encodeURI(fid) + " " + encodeURI(basePath);  // encode necessary to avoid space problem
  //   console.log(req);
  //   SendData(req);
  // }

  // give other modules access to SendData
  window.globals.nodeComms = { sendData: SendData};
  nodeComms = window.globals.nodeComms;  // for dependant function
  // to attach: onReply(res)
