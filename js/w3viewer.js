jQuery(function ( $ ) {
    'use strict';

    var CATEGORY_ON_INIT = 1, // 0: HTML, 1: CSS, 2: API, 3: Other
        VALIDATE_DATA = false, // should the validate function log JSON data validation errors into console?
        PERMANENT_INFO_BOX = false, // should the info-box stay visible even once the mouse cursor leaves the panel item
        undefined = void 0;

    $.getJSON( 'json/w3viewer.json', function ( data ) {

        // Markdown stuff; pushed to the top because I need Markdown to render the panel on page init
        var MD_to_HTML = (function () {
            var markdown = new Markdown.Converter(); //  TODO: switch to Showdown?
            return function ( text ) {
                return markdown.makeHtml( text ).slice( 3, -4 );
                // TODO: .slice(3,-4) is an ugly fix; markdown returns <p>...</p> for one-line string inputs, so I have to slice out the <p> tags somehow; how to deal with this properly?
            };
        }());
        Handlebars.registerHelper( 'markdown', MD_to_HTML );


        // generate the content
        $( 'body' ).append( Handlebars.compile( $( '#template' ).html() )( data ) );
        
        var $nav = $( '#nav'),
            $content = $( '#content' ),
            $links = $( '#links' ),
            $doc = $( '#doc' ),
            $hide = $( '#hide'),
            $info_box = $( '#info_box' ),
            $panel = $( '#panel' ),
            $scrollbar = $( '#scrollbar' ),
            $overlay = $( '#overlay' ),
            info_box_template,              // compiled template for generating the info box
            hash = data.hash,               // the hash object is used by Handlebars' helper functions
            data2,                          // rearranged data object
            hovered_item = null,            // the item in the panel that is currently hovered
            opened_item = null,             // the item in the panel that is currently ".opened"
            scrollbar_timer = null,         // the timeout used to hide the scrollbar after user stopped scrolling
            convert,                        // hold the conversion methods
            validate,                       // function; checks if spec object validates
            infobox;                        // holds the show/hide functions


        // UTILITY FUNCTIONS

        // each resource listed in the info box is opened via the keyboard, by pressing 1 to 9, or A to Z
        // this set of methods converts the pressed key to the corresponding index of the resource, and vice versa
        // KEY (String):    '1' '2' '3' ... 'a' 'b' 'c' ...
        // INDEX (Number):   0   1   2  ...  9  10  11  ...
        convert = {
            toIndex: function ( c ) {
                return parseInt( c ) ? +c - 1 : c.charCodeAt( 0 ) - 88;
            },
            toChar: function ( i ) {
                return i < 9 ? String( i + 1 ) : String.fromCharCode( i + 88 );
            }
        };

        validate = (function () {
            var o;
            function log ( key, text ) { console.log( 'Entry "' + o.title + '" has an invalid ' + key + ' value! ' + ( text || '' ) ); }
            function check ( key, val ) { if ( hash[ key  ][ val || o[ key ] ] === undefined ) log( key ); }

            return function ( s ) {
                if ( !VALIDATE_DATA || s.title === 'IGNORE' ) return s; // early return if validation is disabled

                o = s; // copy spec reference to outer scope, so that utility functions have access to it

                // check if "type", "status", and "implemented" field values are valid, i.e. correspond to properties of hash object
                [ 'type', 'status', 'implemented' ].forEach(function ( key ) { check( key ); });

                // check if "span" field value is array containing one, or two integers in the range 1970-2050
                (function ( arr ) {
                    if ( !Array.isArray( arr ) || arr.length === 0 || arr.length > 2 ) { log( 'span' ); }
                    arr.forEach(function ( n ) {
                        if ( typeof n !== 'number' || n % 1 !== 0 || n < 1970 || n > 2050 ) { log( 'span' ); }
                    });
                }( s.span ));

                // check if "wg" field value is an array of valid values
                (function ( arr ) {
                    if ( !Array.isArray( arr ) || arr.length === 0 ) { log( 'wg' ); }
                    arr.forEach(function ( name ) { check( 'wg', name ); });
                }( s.wg ));

                // check if "resources" filed value is an array of valid object values
                (function ( arr ) {
                    arr.forEach(function ( o ) {
                        if ( o.url.indexOf( 'http' ) > -1 ) { log( 'resources', 'URL contains "http"' ); }
                        check( 'resource', Array.isArray( o.text ) ? o.text[0] : o.text );
                    });
                }( s.resources ));

                return s;
            };
        }());

        infobox = {
            show: function () {
                var group_name = $( this ).closest( '.group' ).data( 'group-name' ),
                    cat_name = $( this ).closest( '.category' ).data( 'category-name'),
                    title = $( this ).data( 'title' );

                $info_box
                    .html( info_box_template( data2[ cat_name ][ group_name ][ title ] ) )
                    .css({ top: Math.min(  $( this ).position().top + 32, $( window ).height() - $info_box.outerHeight() - 10 ) }) // 32 is the top value of #content
                    .show();
            },
            hide: function () {
                if ( PERMANENT_INFO_BOX === false ) {
                    $info_box.hide(); // hide info-box only if PERMANENT flag is not set
                }
            }
        };


        // EVENT HANDLERS

        $panel
            // hovering the panel displays the overlay
            .on( 'mouseenter mouseleave', function ( e ) {
                $overlay.toggle( e.type === 'mouseenter' );
            });

        $content
            // I manually implement panel scrolling (default browser scroll bars look like crap)
            .on( 'mousewheel', function ( e, delta ) {
                e.preventDefault(); // to prevent the page scroll bar to be activated also

                // first 'mousewheel' event?
                if ( !$panel.hasClass( 'scrolling' ) ) {
                    $panel.addClass( 'scrolling' ); // mark that user is scrolling

                    infobox.hide(); // make sure that the info box is not visible during scrolling

                    // if ratio < 1, scrollbar is needed
                    var ratio = $content.height() / $links.height();
                    if ( ratio < 1 ) {
                        $scrollbar.children().first().height(function () {
                            return ratio * $scrollbar.height();
                        });
                        $scrollbar.show();
                    }
                }

                // scroll the list
                var newScrollTop = $( this ).scrollTop() - 25 * delta;
                var maxScrollTop = $links.height() - $content.height();
                newScrollTop = newScrollTop < 0 ? 0 : ( newScrollTop > maxScrollTop ? maxScrollTop : newScrollTop ); // restrict newScrollTop to [ 0, maxScrollTop ]
                $( this ).scrollTop( newScrollTop );

                // set scroll bar thumb position
                if ( $scrollbar.is( ':visible' ) ) {
                    var newMarginTop = parseInt( ( $scrollbar.height() / $links.height() ) * newScrollTop );
                    $scrollbar.children().first().css({ marginTop: newMarginTop });
                }

                // the scroll bar hides some time after the last 'mousewheel' event
                clearTimeout( scrollbar_timer );
                scrollbar_timer = setTimeout(function () {
                    $panel.removeClass( 'scrolling' );
                    $scrollbar.hide();
                    if ( hovered_item ) infobox.show.call( hovered_item );
                }, 500 );
            });

        $nav
            // clicking on the panel tabs displays corresponding lists
            .on( 'click', 'li', function () {
                var index = $( this ).index();
                $( this ).addClass( 'selected' ).siblings().removeClass( 'selected' );
                $links.children().eq( index ).show().siblings().hide();
            })
            // specifies which category should be opened on page init
            .children().eq( CATEGORY_ON_INIT ).trigger( 'click' );

        $links
            // clicking on an item opens/closes the document in the IFRAME
            .on( 'click', '.group > li', function ( e, i, a ) {
                var altKey = a || e.altKey; // if "a" is provided (from keypress handler), use it; otherwise (click occurred and) read e.altKey directly

                // if a document is displayed, close it
                if ( $( this ).hasClass( 'opened' ) ) {
                    // but only if a native click (for which i is undefined) occurred
                    if ( typeof i === 'undefined' ) {
                        $hide.hide();
                        $doc.empty().hide();
                        $( document.body ).removeClass( 'viewing' );
                        $( this ).removeClass( 'opened' );
                        opened_item = null;
                    }
                }
                // else open corresponding document
                else {
                    var url = $info_box.find( '.ib_resources' ).children().eq( i || 0 ).find( 'a' ).text();
                    if ( url.length === 0 ) return; // no URL exists for given index i

                    if ( altKey ) {
                        // open in new tab instead (user is holding down ALT)
                        window.open( url );
                    } else {
                        // open in <iframe>
                        $hide.show();
                        $( document.body ).addClass( 'viewing' );
                        $doc.html( '<iframe src="' + url + '" onload="$(this).addClass(\'loaded\')">' ).show();
                        $( 'li.opened', $links ).removeClass( 'opened' );
                        $( this ).addClass( 'opened' );
                        opened_item = this;
                    }
                }
            })
            // hovering an item displays the info box
            .on( 'mouseenter', '.group > li', function () {
                hovered_item = this;
                if ( $panel.hasClass( 'scrolling') ) return;
                infobox.show.call( this );
            })
            .on( 'mouseleave', '.group > li', function () {
                hovered_item = null;
                if ( $panel.hasClass( 'scrolling') ) return;
                infobox.hide();
            });

        $( document )
            // alternative documents are opened by key commands (e.g. pressing 1, 2, 3, etc.)
            .on( 'keypress', function ( e ) {
                if ( opened_item ) return; // if an item is currently ".opened", ignore command

                var c = String.fromCharCode( e.which );
                $( hovered_item ).trigger( 'click', convert.toIndex( c ), e.altKey );
            });

        $hide
            // toggles full-width mode (panel visibility)
            .on( 'click', function () {
                $doc.toggleClass( 'fullWidth' );
                $( this ).toggleClass( 'hidden' );
            });


        // OTHER INIT TASKS

        info_box_template = Handlebars.compile( $( '#info_box_template' ).html() );

        // rearrange the JSON parsed object so that it's easier to access spec data by group/category name
        data2 = (function () {
            var o = {};
            data.categories.forEach(function ( c ) {
                var co = o[ c.name ] = {};
                c.groups.forEach(function ( g ) {
                    var go = co[ g.name ] = {};
                    g.specs.forEach(function ( s ) {
                        go[ s.title ] = validate( s ); // validate returns the "s" object unchanged, but logs validation errors to the console
                        s.resources.forEach(function ( resource, i ) {
                            // Handlebars doesn't provide index within {{#each}} so I have to manually set an "i" property
                            resource.i = convert.toChar( i );
                        });
                    });
                });
            });
            return o;
        }());

        // Handlebars helpers
        (function () {

            $.each({

                hash: function ( label, type ) {
                    var text0, text1;

                    // label is usually a keyword or custom text, but in special cases it's an array of [ keyword, special text ]
                    if ( typeof label !== 'string' ) {
                        text0 = label[0];
                        text1 = label[1];
                    } else {
                        text0 = label;
                        text1 = null;
                    }

                    text0 = hash[ type ][ text0 ] || text0; // if entry with that name exists in hash, use text of that entry; otherwise use name literally

                    return text1 ? ( text0 + '<span class="arrow">▸</span>' + MD_to_HTML( text1 ) ) : text0;
                },

                // converts e.g. [ 2010, 2012 ] into "2010-2012"
                span_helper: function ( span ) {
                    return span.length === 2 ? span[0] + '–' + span[1] : span[0];
                },

                // processes the WG array, e.g. [ "what", "html" ]
                wg_helper: function ( arr ) {
                    return  arr.map(function ( name ) {
                        var wg =  hash.wg[ name ];
                        return '<span class="ib_wg_label" data-href="' + wg.homepage + '">' + wg.name + '</span>';
                    }).join( ' & ' );
                }

            }, function ( name, handler ) {
                Handlebars.registerHelper( name, handler );
            });

        }());

    });

});