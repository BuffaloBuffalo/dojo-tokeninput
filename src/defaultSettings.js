define(['./htmlEscape'],function(htmlEscape){
    return {
        // Search settings
        method: "GET",
        queryParam: "q",
        searchDelay: 300,
        minChars: 1,
        propertyToSearch: "name",
        jsonContainer: null,
        contentType: "json",

        // Prepopulation settings
        prePopulate: null,
        processPrePopulate: false,

        // Display settings
        hintText: "Type in a search term",
        noResultsText: "No results",
        searchingText: "Searching...",
        deleteText: "&times;",
        animateDropdown: true,
        theme: null,
        zindex: 999,
        resultsLimit: null,

        enableHTML: false,

        resultsFormatter: function(item) {
          var string = item[this.propertyToSearch];
          return "<li>" + (this.enableHTML ? string : htmlEscape(string)) + "</li>";
        },

        tokenFormatter: function(item) {
          var string = item[this.propertyToSearch];
          return "<li><p>" + (this.enableHTML ? string : htmlEscape(string)) + "</p></li>";
        },

        // Tokenization settings
        tokenLimit: null,
        tokenDelimiter: ",",
        preventDuplicates: false,
        tokenValue: "id",

        // Behavioral settings
        allowFreeTagging: false,
        allowTabOut: false,

        // Callbacks
        onResult: null,
        onCachedResult: null,
        onAdd: null,
        onFreeTaggingAdd: null,
        onDelete: null,
        onReady: null,

        // Other settings
        idPrefix: "token-input-",

        // Keep track if the input is currently in disabled mode
        disabled: false
    };
});