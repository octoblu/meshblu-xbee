'use strict';

module.exports = {

  isWaspFrame: function(frame) {
    return ( frame && frame.data &&
             frame.data[0] === 60 &&
             frame.data[1] === 61 &&
             frame.data[2] === 62 );
  },

  // Waspmote Frame parsing
  //   reversed from WaspFrame.cpp
  parseFrame: function(frame) {

    if (!this.isWaspFrame(frame)) {
      return { error: "not a waspframe" };
    }

    var result = {
      type: 'unknown',
      numFields: -1,
      serialId: -1,
      moteId: 'unknown',
      sequence: -1,
      data: null
    };

    result.numFields = frame.data[4];
    if (result.numFields === 63) {
      result.numFields = 0;
    }

    if (frame.data[3] === 128) {

      var str = '';
      for (var i in frame.data){
        str += String.fromCharCode(frame.data[i]);
      }
      result.type = 'ascii';
      result.data = str.substring(6).replace(/#$/,'').split('#');
      result.serialId = Number(result.data.shift());
      result.moteId = result.data.shift();
      result.sequence = Number(result.data.shift());

    } else if (frame.data[3] === 0) {

      result.type = 'binary';
      result.serialId = frame.data[5] + (frame.data[6]<<8) + (frame.data[7]<<16) + (frame.data[8]<<24);
      result.moteId = '';
      var pos = 9;
      while (frame.data[pos++] !== 35) {
        result.moteId += String.fromCharCode(frame.data[pos-1]);
      }
      result.sequence = frame.data[pos++];
      // TODO: Parse binary data into fields
      result.data = frame.data.slice(pos);

    }

    return result;
  }
};
