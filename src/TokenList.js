define(['dojo/_base/array',
        'dojo/_base/lang',
        'dojo/dom-construct',
        'dojo/dom-geometry',
        'dojo/dom-style',
        'dojo/NodeList',
        'dojo/on',
        'dojo/request/xhr',
        'dojo/query',
        './defaultSettings',
        './htmlEscape',
        './TokenListCache',
        'dojo/NodeList-data',
        'dojo/NodeList-dom',
        'dojo/NodeList-fx',
        'dojo/NodeList-html',
        'dojo/NodeList-manipulate',
        'dojo/NodeList-traverse'],function(array,lang,domConstruct,domGeom,domStyle,NodeList,on,xhr,query,DEFAULT_SETTINGS,htmlEscape,TokenListCache){
    // Default classes to use when theming
    lang.extend(NodeList,{
    	singleData:function(){
    		if(arguments.length == 1 && this.length==1){
    			return this.data(arguments[0])[0];
    		}else{
    			return this.data(arguments);
    		}	
    	},
    	destroy: function(){
			// summary:
			//		destroys every item in the list.
			this.forEach(domConstruct.destroy);
		},

    });
    
    var DEFAULT_CLASSES = {
        tokenList: "token-input-list",
        token: "token-input-token",
        tokenReadOnly: "token-input-token-readonly",
        tokenDelete: "token-input-delete-token",
        selectedToken: "token-input-selected-token",
        highlightedToken: "token-input-highlighted-token",
        dropdown: "token-input-dropdown",
        dropdownItem: "token-input-dropdown-item",
        dropdownItem2: "token-input-dropdown-item2",
        selectedDropdownItem: "token-input-selected-dropdown-item",
        inputToken: "token-input-input-token",
        focused: "token-input-focused",
        disabled: "token-input-disabled"
    };

    // Input box position "enum"
    var POSITION = {
        BEFORE: 0,
        AFTER: 1,
        END: 2
    };

    // Keys "enum"
    var KEY = {
        BACKSPACE: 8,
        TAB: 9,
        ENTER: 13,
        ESCAPE: 27,
        SPACE: 32,
        PAGE_UP: 33,
        PAGE_DOWN: 34,
        END: 35,
        HOME: 36,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        NUMPAD_ENTER: 108,
        COMMA: 188
    };

	var TokenList = function (input, url_or_data, settings) {
	    //
	    // Initialization
	    //

	    // Configure the data source
	    if(typeof url_or_data === "string" || typeof url_or_data === "function") {
	        // Set the url to query against
	        query(input).singleData("settings").url = url_or_data;

	        // If the URL is a function, evaluate it here to do our initalization work
	        var url = computeURL();

	        // Make a smart guess about cross-domain if it wasn't explicitly specified
	        if(query(input).singleData("settings").crossDomain === undefined && typeof url === "string") {
	            if(url.indexOf("://") === -1) {
	                query(input).singleData("settings").crossDomain = false;
	            } else {
	                query(input).singleData("settings").crossDomain = (location.href.split(/\/+/g)[1] !== url.split(/\/+/g)[1]);
	            }
	        }
	    } else if(typeof(url_or_data) === "object") {
	        // Set the local data to search through
	        query(input).singleData("settings").local_data = url_or_data;
	    }

	    // Build class names
	    if(query(input).singleData("settings").classes) {
	        // Use custom class names
	        query(input).singleData("settings").classes = lang.extend({}, DEFAULT_CLASSES, query(input).singleData("settings").classes);
	    } else if(query(input).singleData("settings").theme) {
	        // Use theme-suffixed default class names
	        query(input).singleData("settings").classes = {};
	        for(var prop in DEFAULT_CLASSES){
	            query(input).singleData("settings").classes[prop] = DEFAULT_CLASSES[prop] + "-" + query(input).singleData("settings").theme;
	        };
	    } else {
	        query(input).singleData("settings").classes = DEFAULT_CLASSES;
	    }


	    // Save the tokens
	    var saved_tokens = [];

	    // Keep track of the number of tokens in the list
	    var token_count = 0;

	    // Basic cache to save on db hits
	    var cache = new TokenListCache();

	    // Keep track of the timeout, old vals
	    var timeout;
	    var input_val;

	    // Create a new text input an attach keyup events
    	var input_box = domConstruct.create('input',{
	        type:'text',
	        autocomplete:'off',
	        style:'outline:none;',
	        id:query(input).singleData("settings").idPrefix + input.id,
	    });
	    on(input_box,'focus',function () {
	        if (query(input).singleData("settings").disabled) {
	            return false;
	        } else
	        if (query(input).singleData("settings").tokenLimit === null || query(input).singleData("settings").tokenLimit !== token_count) {
	            show_dropdown_hint();
	        }
	        token_list.addClass(query(input).singleData("settings").classes.focused);
	    });
	    on(input_box,'blur',function () {
	        hide_dropdown();
	        query(this).val("");
	        token_list.removeClass(query(input).singleData("settings").classes.focused);

	        if (query(input).singleData("settings").allowFreeTagging) {
	          add_freetagging_tokens();
	        } else {
	          query(this).val("");
	        }
	        token_list.removeClass(query(input).singleData("settings").classes.focused);
	    });
	    on(input_box,'keyup,keydown,blur,update',resize_input);
	    on(input_box,'keydown',function (event) {
	        var previous_token;
	        var next_token;

	        switch(event.keyCode) {
	            case KEY.LEFT:
	            case KEY.RIGHT:
	            case KEY.UP:
	            case KEY.DOWN:
	                if(!query(this).val()) {
	                    previous_token = inputTokenObj.prev();
	                    next_token = inputTokenObj.next();

	                    if((previous_token.length && previous_token[0] === selected_token) || (next_token.length && next_token[0] === selected_token)) {
	                        // Check if there is a previous/next token and it is selected
	                        if(event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) {
	                            deselect_token(query(selected_token), POSITION.BEFORE);
	                        } else {
	                            deselect_token(query(selected_token), POSITION.AFTER);
	                        }
	                    } else if((event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) && previous_token.length) {
	                        // We are moving left, select the previous token if it exists
	                        select_token(query(previous_token[0]));
	                    } else if((event.keyCode === KEY.RIGHT || event.keyCode === KEY.DOWN) && next_token.length) {
	                        // We are moving right, select the next token if it exists
	                        select_token(query(next_token[0]));
	                    }
	                } else {
	                    var dropdown_item = null;

	                    if(event.keyCode === KEY.DOWN || event.keyCode === KEY.RIGHT) {
	                        dropdown_item = query(selected_dropdown_item).next();
	                    } else {
	                        dropdown_item = query(selected_dropdown_item).prev();
	                    }

	                    if(dropdown_item.length) {
	                        select_dropdown_item(dropdown_item);
	                    }
	                }
	                return false;
	                break;

	            case KEY.BACKSPACE:
	                previous_token = inputTokenObj.prev();

	                if(!query(this).val().length) {
	                    if(selected_token) {
	                        delete_token(query(selected_token));
	                        on.emit(hidden_input[0], "change", {
				            	bubbles: true,
				            	cancelable: true
				        	});
	                    } else if(previous_token.length) {
	                        select_token(query(previous_token[0]));
	                    }

	                    return false;
	                } else if(query(this).val().length === 1) {
	                    hide_dropdown();
	                } else {
	                    // set a timeout just long enough to let this function finish.
	                    setTimeout(function(){do_search();}, 5);
	                }
	                break;

	            case KEY.TAB:
	            case KEY.ENTER:
	            case KEY.NUMPAD_ENTER:
	            case KEY.COMMA:
	              if(selected_dropdown_item) {
	                add_token(query(selected_dropdown_item).singleData("tokeninput"));
	                on.emit(hidden_input[0], "change", {
		            	bubbles: true,
		            	cancelable: true
		        	});
	              } else {
	                if (query(input).singleData("settings").allowFreeTagging) {
	                  if(query(input).singleData("settings").allowTabOut && query(this).val() === "") {
	                    return true;
	                  } else {
	                    add_freetagging_tokens();
	                  }
	                } else {
	                  query(this).val("");
	                  if(query(input).singleData("settings").allowTabOut) {
	                    return true;
	                  }
	                }

	              }
	              event.stopPropagation();
	              event.preventDefault();
	              return false;
	            case KEY.ESCAPE:
	              hide_dropdown();
	              return true;

	            default:
	                if(String.fromCharCode(event.which)) {
	                    // set a timeout just long enough to let this function finish.
	                    setTimeout(function(){do_search();}, 5);
	                }
	                break;
	        }
	    });
	    input_box = new NodeList(input_box);
	    // Keep a reference to the original input box
	    var hidden_input = query(input);
	    var originalInputNode = input;
	    hidden_input.style('display','none').val('');
	    on(originalInputNode,'focus',function () {
	       focus_with_timeout(input_box);
	    });
	    on(originalInputNode,'blur',function () {
	        on.emit(input_box[0], "blur", {
	            bubbles: true,
	            cancelable: true
	        });
	    });
	                           // .hide()
	                           // .val("")
	                           // .focus(function () {
	                           //     focus_with_timeout(input_box);
	                           // })
	                           // .blur(function () {
	                           //     input_box.blur();
	                           // });

	    // Keep a reference to the selected token and dropdown item
	    var selected_token = null;
	    var selected_token_index = 0;
	    var selected_dropdown_item = null;
		
	    // The list to store the token items in

	    var tokenListNode = domConstruct.create('ul',{
	  		'class':query(input).singleData("settings").classes.tokenList
	    },originalInputNode,'before');
	    token_list = query(tokenListNode);
	    on(tokenListNode,'click',function (event) {
	        var li = query(event.target).closest("li");

	        if(li && li[0] && li.singleData("tokeninput")) {
	            toggle_select_token(li);
	        } else {
	            // Deselect selected token
	            if(selected_token) {
	                deselect_token(query(selected_token), POSITION.END);
	            }

	            // Focus input box
	            focus_with_timeout(input_box);
	        }
	    });
	    on(tokenListNode,'mouseover',function (event) {
	        var li = query(event.target).closest("li");
	        if(li && selected_token !== this) {
	            li.addClass(query(input).singleData("settings").classes.highlightedToken);
	        }
	    });
	    on(tokenListNode,'mouseout',function(event) {
	        var li = query(event.target).closest("li");
	        if(li && selected_token !== this) {
	            li.removeClass(query(input).singleData("settings").classes.highlightedToken);
	        }
	    });
	    // var token_list = $("<ul />")
	    //     .addClass(query(input).data("settings").classes.tokenList)
	    //     .click(function (event) {
	    //         var li = query(event.target).closest("li");

	    //         if(li && li.get(0) && $.data(li.get(0), "tokeninput")) {
	    //             toggle_select_token(li);
	    //         } else {
	    //             // Deselect selected token
	    //             if(selected_token) {
	    //                 deselect_token(query(selected_token), POSITION.END);
	    //             }

	    //             // Focus input box
	    //             focus_with_timeout(input_box);
	    //         }
	    //     })
	    //     .mouseover(function (event) {
	    //         var li = query(event.target).closest("li");
	    //         if(li && selected_token !== this) {
	    //             li.addClass(query(input).data("settings").classes.highlightedToken);
	    //         }
	    //     })
	    //     .mouseout(function (event) {
	    //         var li = query(event.target).closest("li");
	    //         if(li && selected_token !== this) {
	    //             li.removeClass(query(input).data("settings").classes.highlightedToken);
	    //         }
	    //     })
	    //     .insertBefore(hidden_input);

	    // The token holding the input box
	    var input_token = domConstruct.create('li',{
	        'class':query(input).singleData("settings").classes.inputToken
	    },tokenListNode);
	    var inputTokenObj = query(input_token);
	    inputTokenObj.addContent(input_box);
	    //TODO doublechck order and what appendTo vs append do and return
	    // domConstruct.place(input_box[0],input_token);

	    // var input_token = $("<li />")
	    //     .addClass(query(input).data("settings").classes.inputToken)
	    //     .appendTo(token_list)
	    //     .append(input_box);

	    // The list to store the dropdown items in
	    var dropdown = domConstruct.create('div',{
	        'class':query(input).singleData("settings").classes.dropdown,
	        style:'display:none;'
	    });
	    query('body').addContent(dropdown);
	    dropdown = query(dropdown);
	    // var dropdown = $("<div>")
	    //     .addClass(query(input).data("settings").classes.dropdown)
	    //     .appendTo("body")
	    //     .hide();

	    // Magic element to help us resize the text input
	    var input_resizer = domConstruct.create('tester',{
	        style:
	        {
	            position: "absolute",
	            top: '-9999px',
	            left: '-9999px',
	            width: "auto",
	            fontSize: domStyle.get(input_box[0],'fontSize'),
	            fontFamily: domStyle.get(input_box[0],'fontFamily'),
	            fontWeight: domStyle.get(input_box[0],'fontWeight'),
	            letterSpacing: domStyle.get(input_box[0],'letterSpacing'),
	            whiteSpace: "nowrap"
	        }
	    },input_box[0],'after');
	    input_resizer = query(input_resizer);
	    // var input_resizer = $("<tester/>")
	    //     .insertAfter(input_box)
	    //     .css({
	    //         position: "absolute",
	    //         top: -9999,
	    //         left: -9999,
	    //         width: "auto",
	    //         fontSize: input_box.css("fontSize"),
	    //         fontFamily: input_box.css("fontFamily"),
	    //         fontWeight: input_box.css("fontWeight"),
	    //         letterSpacing: input_box.css("letterSpacing"),
	    //         whiteSpace: "nowrap"
	    //     });

	    // Pre-populate list if items exist
	    hidden_input.val("");
	    var li_data = query(input).singleData("settings").prePopulate || hidden_input.singleData("pre");
	    if(query(input).singleData("settings").processPrePopulate && typeof query(input).singleData("settings").onResult ==='function') {
	        li_data = query(input).singleData("settings").onResult.call(hidden_input, li_data);
	    }
	    if(li_data && li_data.length) {
	        array.forEach(li_data, function (value) {
	            insert_token(value);
	            checkTokenLimit();
	        });
	    }

	    // Check if widget should initialize as disabled
	    if (query(input).singleData("settings").disabled) {
	        toggleDisabled(true);
	    }

	    // Initialization is done
	    if(typeof query(input).singleData("settings").onReady ==='function') {
	        query(input).singleData("settings").onReady.call();
	    }

	    //
	    // Public functions
	    //

	    this.clear = function() {
	        token_list.children("li").forEach(function(node) {
	            if (query(node).children("input").length === 0) {
	                delete_token(query(node));
	            }
	        });
	    };

	    this.add = function(item) {
	        add_token(item);
	    };

	    this.remove = function(item) {
	        token_list.children("li").forEach(function(node) {
	            if (query(node).children("input").length === 0) {
	                var currToken = query(node).singleData("tokeninput");
	                var match = true;
	                for (var prop in item) {
	                    if (item[prop] !== currToken[prop]) {
	                        match = false;
	                        break;
	                    }
	                }
	                if (match) {
	                    delete_token(query(node));
	                }
	            }
	        });
	    };

	    this.getTokens = function() {
	        return saved_tokens;
	    };

	    this.toggleDisabled = function(disable) {
	        toggleDisabled(disable);
	    };

	    //
	    // Private functions
	    //

	    function escapeHTML(text) {
	      return query(input).singleData("settings").enableHTML ? text : htmlEscape(text);
	    }

	    // Toggles the widget between enabled and disabled state, or according
	    // to the [disable] parameter.
	    function toggleDisabled(disable) {
	        if (typeof disable === 'boolean') {
	            query(input).singleData("settings").disabled = disable
	        } else {
	            query(input).singleData("settings").disabled = !query(input).singleData("settings").disabled;
	        }
	        input_box.attr('disabled', query(input).singleData("settings").disabled);
	        token_list.toggleClass(query(input).singleData("settings").classes.disabled, query(input).singleData("settings").disabled);
	        // if there is any token selected we deselect it
	        if(selected_token) {
	            deselect_token(query(selected_token), POSITION.END);
	        }
	        hidden_input.attr('disabled', query(input).singleData("settings").disabled);
	    }

	    function checkTokenLimit() {
	        if(query(input).singleData("settings").tokenLimit !== null && token_count >= query(input).singleData("settings").tokenLimit) {
	            // input_box.hide();
	            domStyle.set(input_box[0],'display','none');
	            hide_dropdown();
	            return;
	        }
	    }

	    function resize_input() {
	        if(input_val === (input_val = input_box.val())) {return;}

	        // Enter new content into resizer and resize input accordingly
	        input_resizer.html(htmlEscape(input_val));
	        domStyle.set(input_box[0],'width',domGeom.getMarginBox(input_resizer[0]).w+30)+'px';
	        // input_box.width(input_resizer.width() + 30);
	    }

	    function is_printable_character(keycode) {
	        return ((keycode >= 48 && keycode <= 90) ||     // 0-1a-z
	                (keycode >= 96 && keycode <= 111) ||    // numpad 0-9 + - / * .
	                (keycode >= 186 && keycode <= 192) ||   // ; = , - . / ^
	                (keycode >= 219 && keycode <= 222));    // ( \ ) '
	    }

	    function add_freetagging_tokens() {
	        var value = $.trim(input_box.val());
	        var tokens = value.split(query(input).singleData("settings").tokenDelimiter);
	        array.forEach(tokens, function(token,i) {
	          if (!token) {
	            return;
	          }

	          if (typeof query(input).singleData("settings").onFreeTaggingAdd ==='function') {
	            token = query(input).singleData("settings").onFreeTaggingAdd.call(hidden_input, token);
	          }
	          var object = {};
	          object[query(input).singleData("settings").tokenValue] = object[query(input).singleData("settings").propertyToSearch] = token;
	          add_token(object);
	        });
	    }

	    // Inner function to a token to the list
	    function insert_token(item) {
	    	var formattedTokenFragment = query(input).singleData("settings").tokenFormatter(item);
	        var $this_token = query(domConstruct.toDom(formattedTokenFragment));
	        var readonly = item.readonly === true ? true : false;

	        if(readonly) $this_token.addClass(query(input).singleData("settings").classes.tokenReadOnly);

	        $this_token.addClass(query(input).singleData("settings").classes.token).insertBefore(input_token);

	        // The 'delete token' button
	        if(!readonly) {
	          var deleteTokenButton = domConstruct.create('span',{
	            innerHTML:query(input).singleData("settings").deleteText,
	            'class':query(input).singleData("settings").classes.tokenDelete
	          });
	          $this_token.addContent(deleteTokenButton);
	          on(deleteTokenButton,'click',function () {
	              if (!query(input).singleData("settings").disabled) {
	                  	delete_token(query(this).parent());
	                  	on.emit(hidden_input[0], "change", {
			            	bubbles: true,
			            	cancelable: true
			        	});
	                  	return false;
	              }
	          });
	          // $("<span>" + query(input).data("settings").deleteText + "</span>")
	          //     .addClass(query(input).data("settings").classes.tokenDelete)
	          //     .appendTo($this_token)
	          //     .click(function () {
	          //         if (!query(input).data("settings").disabled) {
	          //             delete_token(query(this).parent());
	          //             hidden_input.change();
	          //             return false;
	          //         }
	          //     });
	        }

	        // Store data on the token
	        var token_data = item;
	        // $.data($this_token[0], "tokeninput", item);
	        $this_token.data("tokeninput", item);
	        // Save this token for duplicate checking
	        saved_tokens = saved_tokens.slice(0,selected_token_index).concat([token_data]).concat(saved_tokens.slice(selected_token_index));
	        selected_token_index++;

	        // Update the hidden input
	        update_hidden_input(saved_tokens, hidden_input);

	        token_count += 1;

	        // Check the token limit
	        if(query(input).singleData("settings").tokenLimit !== null && token_count >= query(input).singleData("settings").tokenLimit) {
	            // input_box.hide();
	            domStyle.set(input_box[0],'display','none');
	            hide_dropdown();
	        }

	        return $this_token;
	    }

	    // Add a token to the token list based on user input
	    function add_token (item) {
	        var callback = query(input).singleData("settings").onAdd;

	        // See if the token already exists and select it if we don't want duplicates
	        if(token_count > 0 && query(input).singleData("settings").preventDuplicates) {
	            var found_existing_token = null;
	            token_list.children().forEach(function (node) {
	                var existing_token = query(node);
	                var existing_data = existing_token.singleData("tokeninput");//$.data(existing_token[0], "tokeninput");
	                if(existing_data && existing_data[settings.tokenValue] === item[settings.tokenValue]) {
	                    found_existing_token = existing_token;
	                    return false;
	                }
	            });

	            if(found_existing_token) {
	                select_token(found_existing_token);
	                inputTokenObj.insertAfter(found_existing_token);
	                focus_with_timeout(input_box);
	                return;
	            }
	        }

	        // Insert the new tokens
	        if(query(input).singleData("settings").tokenLimit == null || token_count < query(input).singleData("settings").tokenLimit) {
	            insert_token(item);
	            checkTokenLimit();
	        }

	        // Clear input box
	        input_box.val("");

	        // Don't show the help dropdown, they've got the idea
	        hide_dropdown();

	        // Execute the onAdd callback if defined
	        if(typeof callback ==='function') {
	            callback.call(hidden_input,item);
	        }
	    }

	    // Select a token in the token list
	    function select_token (token) {
	        if (!query(input).singleData("settings").disabled) {
	            token.addClass(query(input).singleData("settings").classes.selectedToken);
	            selected_token = token[0];

	            // Hide input box
	            // input_box.val("");
	            input_box[0].value='';
	            // Hide dropdown if it is visible (eg if we clicked to select token)
	            hide_dropdown();
	        }
	    }

	    // Deselect a token in the token list
	    function deselect_token (token, position) {
	        token.removeClass(query(input).singleData("settings").classes.selectedToken);
	        selected_token = null;

	        if(position === POSITION.BEFORE) {
	            inputTokenObj.insertBefore(token);
	            selected_token_index--;
	        } else if(position === POSITION.AFTER) {
	            inputTokenObj.insertAfter(token);
	            selected_token_index++;
	        } else {
	        	token_list.append(inputTokenObj);
	            selected_token_index = token_count;
	        }

	        // Show the input box and give it focus again
	        focus_with_timeout(input_box);
	    }

	    // Toggle selection of a token in the token list
	    function toggle_select_token(token) {
	        var previous_selected_token = selected_token;

	        if(selected_token) {
	            deselect_token(query(selected_token), POSITION.END);
	        }

	        if(previous_selected_token === token[0]) {
	            deselect_token(token, POSITION.END);
	        } else {
	            select_token(token);
	        }
	    }

	    // Delete a token from the token list
	    function delete_token (token) {
	        // Remove the id from the saved list
	        var token_data = token.singleData("tokeninput");
	        var callback = query(input).singleData("settings").onDelete;

	        var index = token.prevAll().length;
	        if(index > selected_token_index) index--;

	        // Delete the token
	        // token.remove();
	        token.destroy();
	        selected_token = null;

	        // Show the input box and give it focus again
	        focus_with_timeout(input_box);

	        // Remove this token from the saved list
	        saved_tokens = saved_tokens.slice(0,index).concat(saved_tokens.slice(index+1));
	        if(index < selected_token_index) selected_token_index--;

	        // Update the hidden input
	        update_hidden_input(saved_tokens, hidden_input);

	        token_count -= 1;

	        if(query(input).singleData("settings").tokenLimit !== null) {
	            input_box.val("");
	            domStyle.set(input_box[0],'display','');
	            focus_with_timeout(input_box);
	        }

	        // Execute the onDelete callback if defined
	        if(typeof callback ==='function') {
	            callback.call(hidden_input,token_data);
	        }
	    }

	    // Update the hidden input box value
	    function update_hidden_input(saved_tokens, hidden_input) {
	        var token_values = array.map(saved_tokens, function (el) {
	            if(typeof query(input).singleData("settings").tokenValue == 'function')
	              return query(input).singleData("settings").tokenValue.call(this, el);

	            return el[query(input).singleData("settings").tokenValue];
	        });
	        hidden_input.val(token_values.join(query(input).singleData("settings").tokenDelimiter));

	    }

	    // Hide and clear the results dropdown
	    function hide_dropdown () {
	        dropdown.style('display','none');
	        dropdown.empty();
	        // dropdown.hide().empty();
	        selected_dropdown_item = null;
	    }

	    function show_dropdown() {
	        var position = domGeom.position(tokenListNode);
	        var zIndex = query(input).singleData("settings").zindex;
	        //dojo.position doesn't seem to do the same thing as jquery's offset
	        var top = tokenListNode.offsetTop + (tokenListNode.offsetParent && tokenListNode.offsetParent.offsetTop ||0)
	        dropdown.style({
	            position: "absolute",
	            top: (top + position.h)+'px',
	            left: position.x+'px',
	            width: position.w+'px',
	            zIndex: zIndex,
	            display:''
	        });

	        // dropdown
	        //     .css({
	        //         position: "absolute",
	        //         top: $(token_list).offset().top + $(token_list).height(),
	        //         left: $(token_list).offset().left,
	        //         width: $(token_list).width(),
	        //         'z-index': query(input).data("settings").zindex
	        //     })
	        //     .show();
	    }

	    function show_dropdown_searching () {
	        if(query(input).singleData("settings").searchingText) {
	            dropdown.html("<p>" + escapeHTML(query(input).singleData("settings").searchingText) + "</p>");
	            show_dropdown();
	        }
	    }

	    function show_dropdown_hint () {
	        if(query(input).singleData("settings").hintText) {
	            dropdown.html("<p>" + escapeHTML(query(input).singleData("settings").hintText) + "</p>");
	            show_dropdown();
	        }
	    }

	    var regexp_special_chars = new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g');
	    function regexp_escape(term) {
	        return term.replace(regexp_special_chars, '\\$&');
	    }

	    // Highlight the query part of the search term
	    function highlight_term(value, term) {
	        return value.replace(
	          new RegExp(
	            "(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(term) + ")(?![^<>]*>)(?![^&;]+;)",
	            "gi"
	          ), function(match, p1) {
	            return "<b>" + escapeHTML(p1) + "</b>";
	          }
	        );
	    }

	    function find_value_and_highlight_term(template, value, term) {
	        return template.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(value) + ")(?![^<>]*>)(?![^&;]+;)", "g"), highlight_term(value, term));
	    }

	    // Populate the results dropdown with some results
	    function populate_dropdown (searchText, results) {
	        if(results && results.length) {
	            dropdown.empty();
	            // dropdown.empty();
	            var dropdown_ul = domConstruct.create('ul',{
	                style:'display:none;'
	            });
	            dropdown.addContent(dropdown_ul);
	            on(dropdown_ul,'mouseover',function (event) {
	               select_dropdown_item(query(event.target).closest("li"));
	            });
	            on(dropdown_ul,'mousedown',function (event) {
	                add_token(query(event.target).closest("li").singleData("tokeninput"));
	                //emit input change event
	                on.emit(hidden_input[0], "change", {
			            bubbles: true,
			            cancelable: true
			        });
	                return false;
	            });

	            // var dropdown_ul = $("<ul>")
	            //     .appendTo(dropdown)
	            //     .mouseover(function (event) {
	            //         select_dropdown_item(query(event.target).closest("li"));
	            //     })
	            //     .mousedown(function (event) {
	            //         add_token(query(event.target).closest("li").data("tokeninput"));
	            //         hidden_input.change();
	            //         return false;
	            //     })
	            //     .hide();

	            if (query(input).singleData("settings").resultsLimit && results.length > query(input).singleData("settings").resultsLimit) {
	                results = results.slice(0, query(input).singleData("settings").resultsLimit);
	            }

	            array.forEach(results, function(value,index) {
	                var this_li = query(input).singleData("settings").resultsFormatter(value);

	                this_li = find_value_and_highlight_term(this_li ,value[query(input).singleData("settings").propertyToSearch], searchText);
	                this_li = domConstruct.toDom(this_li);
	                // this_li = query(this_li).appendTo(dropdown_ul);
	                domConstruct.place(this_li,dropdown_ul);
	                this_li = query(this_li);
	                if(index % 2) {
	                    this_li.addClass(query(input).singleData("settings").classes.dropdownItem);
	                } else {
	                    this_li.addClass(query(input).singleData("settings").classes.dropdownItem2);
	                }

	                if(index === 0) {
	                    select_dropdown_item(this_li);
	                }

	                // $.data(this_li[0], "tokeninput", value);
	                this_li.data("tokeninput", value);
	            });

	            show_dropdown();

	            if(query(input).singleData("settings").animateDropdown) {
	            	//TODO FX slide down???
	                // dropdown_ul.slideDown("fast");
	                query(dropdown_ul).wipeIn().play();
	            } else {
	                // dropdown_ul.show();
	                domStyle.set(dropdown_ul,'display','');
	            }
	        } else {
	            if(query(input).singleData("settings").noResultsText) {
	                dropdown.html("<p>" + escapeHTML(query(input).singleData("settings").noResultsText) + "</p>");
	                show_dropdown();
	            }
	        }
	    }

	    // Highlight an item in the results dropdown
	    function select_dropdown_item (item) {
	        if(item) {
	            if(selected_dropdown_item) {
	                deselect_dropdown_item(query(selected_dropdown_item));
	            }

	            item.addClass(query(input).singleData("settings").classes.selectedDropdownItem);
	            selected_dropdown_item = item[0];
	        }
	    }

	    // Remove highlighting from an item in the results dropdown
	    function deselect_dropdown_item (item) {
	        item.removeClass(query(input).singleData("settings").classes.selectedDropdownItem);
	        selected_dropdown_item = null;
	    }

	    // Do a search and show the "searching" dropdown if the input is longer
	    // than query(input).data("settings").minChars
	    function do_search() {
	        var enteredText = input_box.val();

	        if(enteredText && enteredText.length) {
	            if(selected_token) {
	                deselect_token(query(selected_token), POSITION.AFTER);
	            }

	            if(enteredText.length >= query(input).singleData("settings").minChars) {
	                show_dropdown_searching();
	                clearTimeout(timeout);

	                timeout = setTimeout(function(){
	                    run_search(enteredText);
	                }, query(input).singleData("settings").searchDelay);
	            } else {
	                hide_dropdown();
	            }
	        }
	    }

	    // Do the actual search
	    function run_search(text) {
	        var cache_key = text + computeURL();
	        var cached_results = cache.get(cache_key);
	        if(cached_results) {
	            if (typeof query(input).singleData("settings").onCachedResult ==='function') {
	              cached_results = query(input).singleData("settings").onCachedResult.call(hidden_input, cached_results);
	            }
	            populate_dropdown(text, cached_results);
	        } else {
	            // Are we doing an ajax search or local data search?
	            if(query(input).singleData("settings").url) {
	                var url = computeURL();
	                // Extract exisiting get params
	                var ajax_params = {};
	                ajax_params.data = {};
	                if(url.indexOf("?") > -1) {
	                    var parts = url.split("?");
	                    ajax_params.url = parts[0];

	                    var param_array = parts[1].split("&");
	                    array.forEach(param_array, function (value,index) {
	                        var kv = value.split("=");
	                        ajax_params.data[kv[0]] = kv[1];
	                    });
	                } else {
	                    ajax_params.url = url;
	                }

	                // Prepare the request
	                ajax_params.data[query(input).singleData("settings").queryParam] = text;
	                ajax_params.type = query(input).singleData("settings").method;
	                ajax_params.dataType = query(input).singleData("settings").contentType;
	                if(query(input).singleData("settings").crossDomain) {
	                    ajax_params.dataType = "jsonp";
	                }

	                // Attach the success callback
	                ajax_params.success = function(results) {
	                  cache.add(cache_key, query(input).singleData("settings").jsonContainer ? results[query(input).singleData("settings").jsonContainer] : results);
	                  if(typeof query(input).singleData("settings").onResult ==='function') {
	                      results = query(input).singleData("settings").onResult.call(hidden_input, results);
	                  }

	                  // only populate the dropdown if the results are associated with the active search query
	                  if(input_box.val() === text) {
	                      populate_dropdown(text, query(input).singleData("settings").jsonContainer ? results[query(input).singleData("settings").jsonContainer] : results);
	                  }
	                };

	                // Make the request
	                $.ajax(ajax_params);
	            } else if(query(input).singleData("settings").local_data) {
	                // Do the search through local data
	                var results =array.filter(query(input).singleData("settings").local_data, function (row) {
	                    return row[query(input).singleData("settings").propertyToSearch].toLowerCase().indexOf(text.toLowerCase()) > -1;
	                });

	                cache.add(cache_key, results);
	                if(typeof query(input).singleData("settings").onResult ==='function') {
	                    results = query(input).singleData("settings").onResult.call(hidden_input, results);
	                }
	                populate_dropdown(text, results);
	            }
	        }
	    }

	    // compute the dynamic URL
	    function computeURL() {
	        var url = query(input).singleData("settings").url;
	        if(typeof query(input).singleData("settings").url == 'function') {
	            url = query(input).singleData("settings").url.call(query(input).singleData("settings"));
	        }
	        return url;
	    }

	    // Bring browser focus to the specified object.
	    // Use of setTimeout is to get around an IE bug.
	    // (See, e.g., http://stackoverflow.com/questions/2600186/focus-doesnt-work-in-ie)
	    //
	    // obj: a jQuery object to focus()
	    function focus_with_timeout(obj) {
	        setTimeout(function() { 
	        	obj.forEach(function(v){v.focus();});
	        }, 50);
	    }

	};
return TokenList;
})