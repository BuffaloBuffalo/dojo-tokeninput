define(['dojo/_base/array',
        'dojo/_base/lang',
        'dojo/dom-construct',
        'dojo/dom-geometry',
        'dojo/NodeList',
        'dojo/on',
        'dojo/request/xhr',
        'dojo/query',
        './defaultSettings',
        './TokenList',
        'dojo/NodeList-data',
        'dojo/NodeList-dom',
        'dojo/NodeList-html',
        'dojo/NodeList-manipulate',
        'dojo/NodeList-traverse'],function(array,lang,domConstruct,domGeom,NodeList,on,xhr,query,DEFAULT_SETTINGS,TokenList){
    var exports = {};


    //////////////Module Exports
    // Additional public (exposed) methods
    var methods = {
        init: function(url_or_data_or_function, options) {
            var settings = lang.mixin({}, DEFAULT_SETTINGS, options || {});
            return this.forEach(function (node) {
                query(node).data("settings", settings);
                query(node).data("tokenInputObject", new TokenList(node, url_or_data_or_function, settings));
            });
        },
        clear: function() {
            this.data("tokenInputObject").clear();
            return this;
        },
        add: function(item) {
            this.data("tokenInputObject").add(item);
            return this;
        },
        remove: function(item) {
            this.data("tokenInputObject").remove(item);
            return this;
        },
        get: function() {
            return this.data("tokenInputObject").getTokens();
        },
        toggleDisabled: function(disable) {
            this.data("tokenInputObject").toggleDisabled(disable);
            return this;
        },
        setOptions: function(options){
            query(this).data("settings", lang.extend({}, query(this).data("settings"), options || {}));
            return this;
        }
    };


    // Expose the .tokenInput function to jQuery as a plugin
    exports.tokenInput = function (node,method) {
        var nodeObject= new NodeList(node);
        // Method calling and initialization logic
        if(methods[method]) {
            return methods[method].apply(nodeObject, Array.prototype.slice.call(arguments, 1));
        } else {
            return methods.init.apply(nodeObject, Array.prototype.slice.call(arguments, 1));
        }
    };
    return exports;

});
