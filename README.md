dojo-tokeninput: A dojo-based autocomplete widget
=======================================================

This is a dojo port of the [jQuery Tokeniput plugin](https://github.com/loopj/jquery-tokeninput).  See [the project site](http://buffalobuffalo.github.io/dojo-tokeninput/) for more information


Development
--------
This module is in active development.  The eventual goal is for the codebase to be less of a jquery-tokeninput port and to have a more dojo-like implementation.  

Future tasks are
1. Store support- support `dojo/store` API
2. Make the widget work within the `dijit/form` ecosystem for getting/setting values
3. Replace the query/NodeList usage with more dijit friendly paradigms.

Inspiration
---------------------------------
This project came about as a result of the lack of flexible multi-valued autocomplete widgets in the `dijit` and `dojox` projects.  `dijit/form/FilteringSelect` works for autocompleting a single value, and `dojox/form/CheckedMultiSelect` works for multi-valued options, but tends to flounder when working with large lists of values.


Full information on the original project can be found on the [loopj site](http://loopj.com/jquery-tokeninput).