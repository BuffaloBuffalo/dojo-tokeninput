define([],function(){
	var HTML_ESCAPES = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    var HTML_ESCAPE_CHARS = /[&<>"'\/]/g;

    function coerceToString(val) {
      return String((val === null || val === undefined) ? '' : val);
    }

    return function(text) {
      return coerceToString(text).replace(HTML_ESCAPE_CHARS, function(match) {
        return HTML_ESCAPES[match];
      });
    }
});