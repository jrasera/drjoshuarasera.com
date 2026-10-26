mergeInto(LibraryManager.library, {
  BnePublishState: function(json) {
    window.dispatchEvent(new CustomEvent('bne-state', {detail: JSON.parse(UTF8ToString(json))}));
  },
  BneDownloadJson: function(name, json) {
    var blob = new Blob([UTF8ToString(json)], {type: 'application/json'});
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = UTF8ToString(name); a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }
});
