// Really basic cache for the results
//$.TokenList.Cache = ;
define(['dojo/_base/lang'],function(lang){
	return function (options) {
	    var settings = lang.extend({
	        max_size: 500
	    }, options);

	    var data = {};
	    var size = 0;

	    var flush = function () {
	        data = {};
	        size = 0;
	    };

	    this.add = function (query, results) {
	        if(size > settings.max_size) {
	            flush();
	        }

	        if(!data[query]) {
	            size += 1;
	        }

	        data[query] = results;
	    };

	    this.get = function (query) {
	        return data[query];
	    };
	};

});