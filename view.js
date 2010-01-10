// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Copyright 2007 Google Inc. All Rights Reserved.

// Copyright 2009 David Ellis.

/**
 * @fileoverview cmvc.ui.View implements a subset of behaviors from goog.ui.Container and goog.ui.Control.
 */

goog.provide("cmvc.ui.View");
goog.provide("cmvc.ui.View.EventDispatch");

goog.require("goog.array");
goog.require("goog.events");
goog.require('goog.dom');
goog.require('goog.dom.a11y');
goog.require('goog.dom.a11y.State');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyHandler');
goog.require('goog.events.KeyHandler.EventType');
goog.require("goog.object");
goog.require("goog.string");
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('goog.ui.Component.Error');
goog.require('goog.ui.Component.EventType');
goog.require('goog.ui.Component.State');
goog.require('goog.ui.ContainerRenderer');
goog.require('goog.userAgent');

goog.require("cmvc");
goog.require("cmvc.string");
goog.require("cmvc.Template");
goog.require("cmvc.kvo");


cmvc.ui.View = cmvc.extend(goog.ui.Component, {
  constructor: function(opt_domHelper) {
    cmvc.ui.View.superClass_.constructor.call(this, opt_domHelper);

    // enumerate the child views declared in this.children and add each as a child view of this view (the parent/root)
    if(this.children) {
      var view = null;
      goog.array.forEach(cmvc.string.words(this.children), function(e, i, a) {
        // add child views (view objects) but do not render them yet because if we render the child view now, we
        //   are forced to create the DOM node for this view (the parent of the children) before we're ready.
        //   We only want to create the DOM node for this view when we call render().
        view = new (this[e])(opt_domHelper);
        view.setId(e);
        this.addChild(view, false);
      }, this);
    }
    
    this.attachDeclaredPropertyBindings();
  },
  
  /**
   * This is a convenience method for applying properties to a newly created View immediately after instantiation.
   * 
   * Example:
   *   var v = (new cmvc.ui.View(...)).apply({id: "view12", parent: thatContainer});
   */
  apply: function(properties) {
    goog.object.extend(this, properties);
    return this;
  },
  
  
  /*********************************************************************************************/
  /******View Properties (combination of goog.ui.Container and goog.ui.Control properties)******/


  /**
   * Default view and DOM event handler declarations.
   */
  viewEvents: {},
  domEvents: {},
  
  
  // The following flags are taken from goog.ui.Container
  

  /**
   * Allows an alternative element to be set to recieve key events, otherwise defers to the renderer's element choice.
   * @type {Element|undefined}
   * @private
   */
  keyEventTarget_: null,

  /**
   * Keyboard event handler.
   * @type {goog.events.KeyHandler?}
   * @private
   */
  keyHandler_: null,

  /**
   * Whether the container is set to be visible.  Defaults to true.
   * @type {boolean}
   * @private
   */
  visible_: true,

  /**
   * Whether the container is enabled and reacting to keyboard and mouse events.
   * Defaults to true.
   * @type {boolean}
   * @private
   */
  enabled_: true,

  /**
   * Whether the container supports keyboard focus.  Defaults to true.  Focusable
   * containers have a {@code tabIndex} and can be navigated to via the keyboard.
   * @type {boolean}
   * @private
   */
  focusable_: true,

  /**
   * The 0-based index of the currently highlighted control in the container (-1 if none).
   * @type {number}
   * @private
   */
  highlightedIndex_: -1,
  
  /**
   * Whether the mouse button is held down.  Defaults to false.  This flag is set
   * when the user mouses down over the container, and remains set until they
   * release the mouse button.
   * @type {boolean}
   * @private
   */
  mouseButtonPressed_: false,

  /**
   * Whether focus of child componenets should be allowed.  Only effective if focusable_ is set to false.
   * @type {boolean}
   * @private
   */
  allowFocusableChildren_: false,

  /**
   * Map of DOM IDs to child controls.  Each key is the DOM ID of a child control's root element; 
   * each value is a reference to the child control itself.  
   * Used for looking up the child control corresponding to a DOM node in O(1) time.
   * @type {Object?}
   * @private
   */
  childElementIdMap_: null,
  
  
  // This flag is my own (DKE).
  
  
  /**
   * Whether the view should listen for and handle child events; defaults to false.
   * When this is set to false, the event simply bubbles up to the parent View.
   * @type {boolean}
   * @private
   */
  handleChildEvents_: false,
  
  
  // The following flags are taken from goog.ui.Control
  

  /**
   * Whether the view should listen for and handle its own mouse events; defaults to true.
   * When this is set to false, the event simply bubbles up to the parent View.
   * @type {boolean}
   * @private
   */
  handleOwnMouseEvents_: false,

  /**
   * Whether the view allows text selection within its DOM.  Defaults to false.
   * @type {boolean}
   * @private
   */
  allowTextSelection_: false,

  /**
   * Current component state; a bit mask of {@link goog.ui.Component.State}s.
   * @type {number}
   * @private
   */
  state_: 0x00,

  /**
   * A bit mask of {@link goog.ui.Component.State}s this component supports.
   * @type {number}
   * @private
   */
  supportedStates_: goog.ui.Component.State.DISABLED |
                    goog.ui.Component.State.HOVER |
                    goog.ui.Component.State.ACTIVE |
                    goog.ui.Component.State.FOCUSED,

  /**
   * A bit mask of {@link goog.ui.Component.State}s for which this component
   * provides default event handling.  For example, a component that handles
   * the HOVER state automatically will highlight itself on mouseover, whereas
   * a component that doesn't handle HOVER automatically will only dispatch
   * ENTER and LEAVE events but not call {@link setHighlighted} on itself.
   * By default, components provide default event handling for all states.
   * Controls hosted in containers (e.g. menu items in a menu, or buttons in a
   * toolbar) will typically want to have their container manage their highlight
   * state.  Selectable controls managed by a selection model will also typically
   * want their selection state to be managed by the model.
   * @type {number}
   * @private
   */
  autoStates_: goog.ui.Component.State.ALL,


  /*********************************************************************************************/
  /******************************* Event handler management. ***********************************/


  /**
   * Returns the DOM element on which the container is listening for keyboard events (null if none).
   * @return {Element?} Element on which the container is listening for key
   *     events.
   */
  getKeyEventTarget: function() {
    return this.keyEventTarget_ || this.getElement();
  },
  
  
  /**
   * Attaches an element on which to listen for key events.
   * @param {Element|undefined} element The element to attach, or null/undefined
   *     to attach to the default element.
   */
  setKeyEventTarget: function(element) {
    if (this.focusable_) {
      var oldTarget = this.getKeyEventTarget();
      var inDocument = this.isInDocument();

      this.keyEventTarget_ = element;
      var newTarget = this.getKeyEventTarget();

      if (inDocument) {
        // Unlisten for events on the old key target.  Requires us to reset key target state temporarily.
        this.keyEventTarget_ = oldTarget;
        this.enableFocusHandling_(false);
        this.keyEventTarget_ = element;

        // Listen for events on the new key target.
        this.getKeyHandler().attach(newTarget);
        this.enableFocusHandling_(true);
      }
    } else {
      throw Error("Can't set key event target for container that doesn't support keyboard focus!");
    }
  },


  /**
   * Returns the keyboard event handler for this container, lazily created the
   * first time this method is called.  The keyboard event handler listens for
   * keyboard events on the container's key event target, as determined by its
   * renderer.
   * @return {goog.events.KeyHandler} Keyboard event handler for this container.
   */
  getKeyHandler: function() {
    return this.keyHandler_ || (this.keyHandler_ = new goog.events.KeyHandler(this.getKeyEventTarget()));
  },


  // The following methods are taken from goog.ui.Control


  /**
   * Returns true if the control is configured to handle its own mouse events,
   * false otherwise.  Controls not hosted in {@link goog.ui.Container}s have
   * to handle their own mouse events, but controls hosted in containers may
   * allow their parent to handle mouse events on their behalf.  Considered
   * protected; should only be used within this package and by subclasses.
   * @return {boolean} Whether the control handles its own mouse events.
   */
  isHandleOwnMouseEvents: function() {
    return this.handleOwnMouseEvents_;
  },


  /**
   * Enables or disables mouse event handling for the control.  Containers may
   * use this method to disable mouse event handling in their child controls.
   * Considered protected; should only be used within this package and by
   * subclasses.
   * @param {boolean} enable Whether to enable or disable mouse event handling.
   */
  setHandleMouseEvents: function(enable) {
    if (this.isInDocument() && enable != this.handleOwnMouseEvents_) {
      // Already in the document; need to update event handler.
      this.enableMouseEventHandling_(enable);
    }
    this.handleOwnMouseEvents_ = enable;
  },
  
  
  // The following methods are my own (DKE)
  
  
  isHandleChildEvents: function() {
    return this.handleChildEvents_;
  },
  
  /**
   * Enables or disables event handling for events bubbled up through child View objects.
   */
  setHandleChildEvents: function(enable) {
    if (this.isInDocument() && enable != this.handleChildEvents_) {
      // Already in the document; need to update event handler.
      this.enableChildEventHandling_(enable);
    }
    this.handleChildEvents_ = enable;
  },

  /*********************************************************************************************/
  /************************* Standard cmvc.ui.View implementation. *****************************/


  /**
   * Renders the component.  If a parent element is supplied, it should already be
   * in the document and then the component's element will be appended to it.  If
   * there is no optional parent element and the element doesn't have a parentNode
   * then it will be appended to the document body.
   *
   * Throws an Error if the component is already rendered.
   *
   * @param {Element} opt_parentElement Optional parent element to render the
   *    component into.
   *
   * Overrides the default implementation of render_, defined at goog.ui.Component.prototype.render_
   *
   * Order of events:
   *   render_()
   *     preRender()
   *     createDom()
   *     insert element into document
   *     enterDocument()
   *       initializeDom()
   *       renderChildren()
   *     postRender()
   */
  render_: function(opt_parentElement, opt_beforeElement) {
    this.preRender();
    
    // render the root element
    // calls createDom(); inserts element into document; calls enterDocument()
    
    cmvc.ui.View.superClass_.render_.apply(this, arguments);
    
    this.postRender();
  },
  
  
  // placeholder preRender function
  preRender: function() {},
  
  
  // placeholder postRender function
  postRender: function() {},
  
  
  renderChildren: function() {
    if(this.isInDocument()) {
      var element = this.getElement();
      // render any child views that haven't been rendered yet
      this.forEachChild(function(child, i) {
        if (!child.isInDocument() && !child.getElement()) {
          child.render(element);
        }
      }, this);
    }
  },
  
  
  /**
   * Creates the container's DOM.  Overrides {@link goog.ui.Component#createDom}.
   */
  createDom: function() {
    var element;
    
    // using the default goog.dom.createDom function
    //element = this.getDomHelper().createDom(this.elementTag, this.elementAttributes);
    
    // using the cmvc.Template
    element = cmvc.Template.createTemplate(this.root).createElement(this);
    
    // set the element
    this.setElementInternal(element);
  },
  
  
  /**
   * Initializes the view's DOM when the view enters the document.
   * Called from {@link cmvc.ui.View#enterDocument}.
   */
  initializeDom: function() {
    var elem = this.getElement();

    // IE doesn't support outline:none, so we have to use the hideFocus property.
    if (goog.userAgent.IE) {
      elem.hideFocus = true;
    }
    
    // Initialize text selection.
    if (!this.isAllowTextSelection()) {
      // Since making elements unselectable is expensive, only do it if needed (closure bug 1037090).
      this.setAllowTextSelection(false);
    }
    
    // Initialize visibility.
    if (!this.isVisible()) {
      // Since hiding elements can be expensive, only do it if needed (closure bug 1037105).
      this.setVisible(false);
    }
  },

  /**
   * Configures the container after its DOM has been rendered, and sets up event
   * handling.  Overrides {@link goog.ui.Component#enterDocument}.
   */
  enterDocument: function() {
    this.inDocument_ = true;

    // Call the renderer's initializeDom method to initialize the container's DOM.
    this.initializeDom(this);

    // Render any unrendered child views before continuing enterDocument(), because we want them
    // to be in the document before calling the child's enterDocument().
    this.renderChildren();

    // Propagate enterDocument to child components that have a DOM node, if any.
    this.forEachChild(function(child) {
      if (!child.isInDocument() && child.getElement()) {
        child.enterDocument();
      }
    });
    
    // register the child components that have a DOM node and are in the document.
    this.forEachChild(function(child) {
      if (child.isInDocument()) {
        this.registerChildId_(child);
      }
    }, this);
    
    // Initialize keyboard focusability (tab index).  We assume that components
    // aren't focusable by default (i.e have no tab index), and only touch the
    // DOM if the component is focusable, enabled, and visible, and therfore
    // needs a tab index.
    // Note: This seems like reassignment (i.e. focusable_ = focusable_), but we do this for the
    //       side effects of calling enableFocusHandling_() and enableTabIndex().
    this.setFocusable(this.isVisible() && this.isEnabled() && this.isFocusable());
    
    // Initialize mouse event handling if the view is configured to handle its own mouse events.
    this.enableMouseEventHandling_(this.isHandleOwnMouseEvents());
    
    // Initialize event handling of events bubbled up through child View objects.
    this.enableChildEventHandling_(this.isHandleChildEvents());
    
    // even though we could attach the view's event handlers to the view in the constructor, we don't want to
    //   handle events unless the element_ is rendered.
    this.attachDeclaredViewEventHandlers();

    // we only want to attach the DOM event handlers after the element_ is rendered
    this.attachDeclaredDomEventHandlers();
  },
  
  
  getViewEvents: function() {
    this.viewEvents_ = this.viewEvents_ || cmvc.inheritProperty(this, "viewEvents");
    return this.viewEvents_;
  },
  
  
  getDomEvents: function() {
    this.domEvents_ = this.domEvents_ || cmvc.inheritProperty(this, "domEvents");
    return this.domEvents_;
  },
  
  
  /**
   * Iterate over all pairs of event/function_reference pairs in the event_handlers object, attaching
   * each function_reference as an event listener for the corresponding event.
   * 
   * Example:
   * viewEvents: {
   *   'click': function(e) { alert(); },
   *   'mouseover': "myapp.application.mouseOverHandler",
   *   'mouseout': 'mouseOutHandler',
   *   'someOtherEvent': cmvc.ui.View.EventDispatch.Self
   *   'anotherEvent': cmvc.ui.View.EventDispatch.Parent
   * }
   */
  attachDeclaredViewEventHandlers: function(viewEvents) {
    var fn = null,
        context = null;
    
    // enable = goog.isDef(enable) ? enable : true;
    viewEvents = viewEvents || this.getViewEvents() || {};
    
    goog.object.forEach(viewEvents, function(handler, evt, o) {     // element, index, object
      switch(goog.typeOf(handler)) {
        case "function":    // the event handler is a function object that accepts a single event object argument
          fn = handler;
          context = this;
          break;
        case "string":      // the event handler is a "dotted" reference to a user defined function
          var i = handler.lastIndexOf('.');
          if(i >= 0) {
            // we found a "." in the string, so the text to the left of the "." is a reference to the context object
            context = eval(handler.substring(0, i));
            fn = eval(handler);
          } else {
            // we didn't find any "." in the string, so "this" is the context object
            context = this;
            fn = this[handler];
          }
          break;
        case "number":      // the event handler is a reference to a specific built-in behavior
          switch(handler) {
            case cmvc.ui.View.EventDispatch.Self:
              context = this;
            case cmvc.ui.View.EventDispatch.Parent:
              context = this.getParent();
              break;
            default:
              throw Error("Unable to attach event handler to the view. Unknown event handler reference.");
          }
          fn = context.dispatchEvent;     // the context object (a goog.ui.Component) ought to have a dispatchEvent() method
          break;
        default:
          throw Error("Unable to attach event handler to the view. Unknown event handler type.");
      }
      
      this.getHandler().listen(this, evt, fn, false, context);
    }, this);
  },
  
  
  /**
   * Iterate over the events referenced in the domEvents array and for each event attach an event handler to the
   * root element that will simply fire the same event on the View object.
   */
  attachDeclaredDomEventHandlers: function(domEvents) {
    var elem = this.getElement();
    
    domEvents = domEvents || this.getDomEvents() || [];
    
    if(elem) {
      // create the initial event handlers
      goog.array.forEach(domEvents, function(e, i, a) {
        // e is the event name/constant (e.g. 'click', goog.events.EventType.MOUSEDOWN)
        this.getHandler().listen(elem, e, goog.partial(goog.events.dispatchEvent, this), false, this);
      }, this);
    }
  },
  
  
  /**
   * Iterate over all pairs of local-property/remote-property pairs in the propertyBindings object, 
   * binding each local property to a remote object's property.
   */
  attachDeclaredPropertyBindings: function(propertyBindings) {
    var that = null,
        thatProperty = null,
        i = null;
    
    propertyBindings = propertyBindings || this.propertyBindings || {};
    
    goog.object.forEach(propertyBindings, function(thatPropertyPath, thisProperty, o) {
      i = thatPropertyPath.lastIndexOf('.');
      if(i > 0) {
        // we found a "." in the string, so the text to the left of the "." is a reference to the context object, "that"
        that = eval(thatPropertyPath.substring(0, i));
        thatProperty = thatPropertyPath.substring(i + 1, thatPropertyPath.length);
        // console.log(this, thisProperty, that, thatProperty);
        // cmvc.kvo.bind(this, thisProperty, that, thatProperty);   // change in this -> change in that
        cmvc.kvo.bind(that, thatProperty, this, thisProperty);      // change in that -> change in this
      }
    }, this);
  },
  
  
  /**
   * Sets up listening for events applicable to focusable containers.
   * @param {boolean} enable Whether to enable or disable focus handling.
   * @private
   */
  enableFocusHandling_: function(enable) {
    var handler = this.getHandler();
    var keyTarget = this.getKeyEventTarget();
    if (enable) {
      handler.listen(keyTarget, goog.events.EventType.FOCUS, this.handleFocus).
              listen(keyTarget, goog.events.EventType.BLUR, this.handleBlur).
              listen(this.getKeyHandler(), goog.events.KeyHandler.EventType.KEY, this.handleKeyEvent);
    } else {
      handler.unlisten(keyTarget, goog.events.EventType.FOCUS, this.handleFocus).
              unlisten(keyTarget, goog.events.EventType.BLUR, this.handleBlur).
              unlisten(this.getKeyHandler(), goog.events.KeyHandler.EventType.KEY, this.handleKeyEvent);
    }
  },
  
  
  /**
   * Enables or disables mouse event handling on the view.
   * @param {boolean} enable Whether to enable mouse event handling.
   * @private
   */
  enableMouseEventHandling_: function(enable) {
    var handler = this.getHandler();
    var element = this.getElement();
    if (enable) {
      handler.listen(element, goog.events.EventType.MOUSEOVER, this.handleMouseOver).
              listen(element, goog.events.EventType.MOUSEDOWN, this.handleMouseDown).
              listen(element, goog.events.EventType.MOUSEUP, this.handleMouseUp).
              listen(element, goog.events.EventType.MOUSEOUT, this.handleMouseOut).
              listen(goog.dom.getOwnerDocument(element), goog.events.EventType.MOUSEUP, this.handleDocumentMouseUp);
      if (goog.userAgent.IE) {
        handler.listen(element, goog.events.EventType.DBLCLICK, this.handleDblClick);
      }
    } else {
      handler.unlisten(element, goog.events.EventType.MOUSEOVER, this.handleMouseOver).
              unlisten(element, goog.events.EventType.MOUSEDOWN, this.handleMouseDown).
              unlisten(element, goog.events.EventType.MOUSEUP, this.handleMouseUp).
              unlisten(element, goog.events.EventType.MOUSEOUT, this.handleMouseOut).
              unlisten(goog.dom.getOwnerDocument(element), goog.events.EventType.MOUSEUP, this.handleDocumentMouseUp);
      if (goog.userAgent.IE) {
        handler.unlisten(element, goog.events.EventType.DBLCLICK, this.handleDblClick);
      }
    }
  },
  
  
  enableChildEventHandling_: function(enable) {
    var elem = this.getElement();
    
    // Handle events dispatched by child controls.
    this.getHandler().
      listen(this, goog.ui.Component.EventType.ENTER, this.handleEnterItem).
      listen(this, goog.ui.Component.EventType.HIGHLIGHT, this.handleHighlightItem).
      listen(this, goog.ui.Component.EventType.UNHIGHLIGHT, this.handleUnHighlightItem).
      listen(this, goog.ui.Component.EventType.OPEN, this.handleOpenItem).
      listen(this, goog.ui.Component.EventType.CLOSE, this.handleCloseItem).

      // Handle mouse events.
      listen(elem, goog.events.EventType.MOUSEDOWN, this.handleChildMouseDown).
      listen(goog.dom.getOwnerDocument(elem), goog.events.EventType.MOUSEUP, this.handleDocumentMouseUp).

      // Handle mouse events on behalf of cpresently2ontrols in the container.
      listen(elem, [
        goog.events.EventType.MOUSEDOWN,
        goog.events.EventType.MOUSEUP,
        goog.events.EventType.MOUSEOVER,
        goog.events.EventType.MOUSEOUT
      ], this.handleChildMouseEvents);
  },
  
  
  /**
   * Cleans up the container before its DOM is removed from the document, and
   * removes event handlers.  Overrides {@link goog.ui.Component#exitDocument}.
   */
  exitDocument: function() {
    // Following two method calls taken from goog.ui.Container
    
    // {@link #setHighlightedIndex} has to be called before
    // {@link goog.ui.Component#exitDocument}, otherwise it has no effect.
    this.setHighlightedIndex(-1);

    this.setMouseButtonPressed(false);

    // Following two checks taken from goog.ui.Control
    
    // Remove all key event listeners
    if (this.keyHandler_) {
      this.keyHandler_.detach();
    }
    
    // Make view not visible and take it out of the tab order
    if (this.isVisible() && this.isEnabled()) {
      this.setFocusable(false);
    }

    /**
     * goog.ui.Component#exitDocument does the following, in order:
     * 1. Propagate exitDocument to child components that have been rendered, if any.
     * 2. Removes all event handlers from the goog.events.EventHandler object returned by this.getHandler().
     * 3. Sets this.inDocument_ to false.
     */
    cmvc.ui.View.superClass_.exitDocument.call(this);
  },


  /** @inheritDoc */
  disposeInternal: function() {
    cmvc.ui.View.superClass_.disposeInternal.call(this);

    // completely dispose of the key handler ; Taken from goog.ui.Control/goog.ui.Container
    if (this.keyHandler_) {
      this.keyHandler_.dispose();
      delete this.keyHandler_;
    }
    
    // remove all property observers
    cmvc.kvo.removeObservers(this);

    // taken from goog.ui.Container
    this.childElementIdMap_ = null;
  },


  /*********************************************************************************************/
  /*********************************** Default event handlers. *********************************/


  /**
   * Handles ENTER events raised by child views when they are navigated to.
   * @param {goog.events.Event} e ENTER event to handle.
   * @return {boolean} Whether to prevent handleMouseOver from handling the event.
   */
  handleEnterItem: function(e) {
    // Allow the child view to highlight itself.
    return true;
  },


  /**
   * Handles HIGHLIGHT events dispatched by child views in the container when they are highlighted.
   * @param {goog.events.Event} e Highlight event to handle.
   */
  handleHighlightItem: function(e) {
    var index = this.indexOfChild(/** @type {goog.ui.Component} */ (e.target));
    if (index > -1 && index != this.highlightedIndex_) {
      var item = this.getHighlighted();
      if (item) {
        // Un-highlight previously highlighted item.
        item.setHighlighted(false);
      }

      this.highlightedIndex_ = index;
      item = this.getHighlighted();

      if (this.isMouseButtonPressed()) {
        // Activate item when mouse button is pressed, to allow MacOS-style
        // dragging to choose menu items.  Although this should only truly
        // happen if the highlight is due to mouse movements, there is little
        // harm in doing it for keyboard or programmatic highlights.
        item.setActive(true);
      }
    }
  },


  /**
   * Handles UNHIGHLIGHT events dispatched by child views in the container when they are unhighlighted.
   * @param {goog.events.Event} e Unhighlight event to handle.
   */
  handleUnHighlightItem: function(e) {
    if (e.target == this.getHighlighted()) {
      this.highlightedIndex_ = -1;
    }
  },


  /**
   * Handles OPEN events dispatched by items in the container when they are opened.
   * @param {goog.events.Event} e Open event to handle.
   */
  handleOpenItem: function(e) {
    // Do nothing. I don't want to deal with open items in View.
    // This should be a control-specific thing, and does not belong in View.
    // I only keep these event handlers here so View can house goog.ui.Control objects.
  },


  /**
   * Handles CLOSE events dispatched by items in the container when they are closed.
   * @param {goog.events.Event} e Close event to handle.
   */
  handleCloseItem: function(e) {
    // Do nothing. I don't want to deal with open items in View.
    // This should be a control-specific thing, and does not belong in View.
    // I only keep these event handlers here so View can house goog.ui.Control objects.
  },

  
  /**
   * Handles mousedown events over the container.  The default implementation
   * sets the "mouse button pressed" flag and, if the container is focusable,
   * grabs keyboard focus.
   * @param {goog.events.BrowserEvent} e Mousedown event to handle.
   */
  handleMouseDown: function(e) {
    if (this.isEnabled()) {
      this.setMouseButtonPressed(true);
      
      // Highlight enabled control on mousedown, regardless of the mouse button.
      if (this.isAutoState(goog.ui.Component.State.HOVER)) {
        this.setHighlighted(true);
      }
      
      // For the left button only, activate the control, and focus its key event target (if supported).
      if (e.isButton(goog.events.BrowserEvent.MouseButton.LEFT)) {
        if (this.isAutoState(goog.ui.Component.State.ACTIVE)) {
          this.setActive(true);
        }
        if (this.isFocusable()) {
          this.getKeyEventTarget().focus();
        }
      }
    }

    // Cancel the default action unless the control allows text selection.
    if (!this.isAllowTextSelection() && e.isButton(goog.events.BrowserEvent.MouseButton.LEFT)) {
      e.preventDefault();
    }
  },

  /**
   * This is nearly identical to goog.ui.Container#handleMouseDown.
   * Handles mouse down events dispatched by child views.
   */
  handleChildMouseDown: function(e) {
    if (this.isEnabled()) {
      this.setMouseButtonPressed(true);
    }

    var keyTarget = this.getKeyEventTarget();
    if (this.hasTabIndex(keyTarget)) {
      // The container is configured to receive keyboard focus.
      keyTarget.focus();
    } else {
      // The control isn't configured to receive keyboard focus; prevent it
      // from stealing focus or destroying the selection.
      e.preventDefault();
    }
  },


  /**
   * Handles mouseup events over the document.  The default implementation
   * clears the "mouse button pressed" flag.
   * @param {goog.events.BrowserEvent} e Mouseup event to handle.
   */
  handleDocumentMouseUp: function(e) {
    this.setMouseButtonPressed(false);
  },
  
  
  /**
   * Handles mouseup events.  If the component is enabled, highlights it.  If
   * the component has previously been activated, performs its associated action
   * by calling {@link performActionInternal}, then deactivates it.  Considered
   * protected; should only be used within this package and by subclasses.
   * @param {goog.events.Event} e Mouse event to handle.
   */
  handleMouseUp: function(e) {
    if (this.isEnabled()) {
      if (this.isAutoState(goog.ui.Component.State.HOVER)) {
        this.setHighlighted(true);
      }
      if (this.isActive() && this.performActionInternal(e) && this.isAutoState(goog.ui.Component.State.ACTIVE)) {
        this.setActive(false);
      }
    }
  },
  
  /**
   * Handles mouseover events.  Dispatches an ENTER event; if the event isn't
   * canceled, the component is enabled, and it supports auto-highlighting,
   * highlights the component.  Considered protected; should only be used
   * within this package and by subclasses.
   * @param {goog.events.BrowserEvent} e Mouse event to handle.
   *
   * Note: taken from goog.ui.Control
   */
  handleMouseOver: function(e) {
    // Ignore mouse moves between descendants.
    if (e.relatedTarget &&
        !goog.dom.contains(this.getElement(), e.relatedTarget) &&
        this.dispatchEvent(goog.ui.Component.EventType.ENTER) &&
        this.isEnabled() &&
        this.isAutoState(goog.ui.Component.State.HOVER)) {
      this.setHighlighted(true);
    }
  },
  
  /**
   * Handles mouseout events.  Dispatches a LEAVE event; if the event isn't
   * canceled, and the component supports auto-highlighting, deactivates and
   * un-highlights the component.  Considered protected; should only be used
   * within this package and by subclasses.
   * @param {goog.events.BrowserEvent} e Mouse event to handle.
   *
   * Note: taken from goog.ui.Control
   */
  handleMouseOut: function(e) {
    // Ignore mouse moves between descendants.
    if (e.relatedTarget &&
        !goog.dom.contains(this.getElement(), e.relatedTarget) &&
        this.dispatchEvent(goog.ui.Component.EventType.LEAVE)) {
      if (this.isAutoState(goog.ui.Component.State.ACTIVE)) {
        // Deactivate on mouseout; otherwise we lose track of the mouse button.
        this.setActive(false);
      }
      if (this.isAutoState(goog.ui.Component.State.HOVER)) {
        this.setHighlighted(false);
      }
    }
  },


  /**
   * Handles dblclick events.  Should only be registered if the user agent is
   * IE.  If the component is enabled, performs its associated action by calling
   * {@link performActionInternal}.  This is used to allow more performant
   * buttons in IE.  In IE, no mousedown event is fired when that mousedown will
   * trigger a dblclick event.  Because of this, a user clicking quickly will
   * only cause ACTION events to fire on every other click.  This is a workaround
   * to generate ACTION events for every click.  Unfortunately, this workaround
   * won't ever trigger the ACTIVE state.  This is roughly the same behaviour as
   * if this were a 'button' element with a listener on mouseup.  Considered
   * protected; should only be used within this package and by subclasses.
   * @param {goog.events.Event} e Mouse event to handle.
   * 
   * Taken from goog.ui.Control
   */
  handleDblClick: function(e) {
    if (this.isEnabled()) {
      this.performActionInternal(e);
    }
  },
  
  
  /**
   * Performs the appropriate action when the control is activated by the user.
   * The default implementation dispatches an ACTION event.  Considered
   * protected; should only be used within this package and by subclasses.
   * @param {goog.events.Event} e Event that triggered the action.
   * @return {boolean} Whether the action is allowed to proceed.
   * @protected
   * 
   * Taken from goog.ui.Control
   */
  performActionInternal: function(e) {
    var actionEvent = new goog.events.Event(goog.ui.Component.EventType.ACTION, this);
    if (e) {
      var properties = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'];
      for (var property, i = 0; property = properties[i]; i++) {
        actionEvent[property] = e[property];
      }
    }
    return this.dispatchEvent(actionEvent);
  },
  
  
  /**
   * Handles mouse events originating from nodes belonging to the controls hosted
   * in the container.  Locates the child control based on the DOM node that
   * dispatched the event, and forwards the event to the control for handling.
   * @param {goog.events.BrowserEvent} e Mouse event to handle.
   * 
   * Taken from goog.ui.Container
   */
  handleChildMouseEvents: function(e) {
    var control = this.getOwnerControl(/** @type {Node} */ (e.target));
    if (control) {
      // Child control identified; forward the event.
      switch (e.type) {
        case goog.events.EventType.MOUSEDOWN:
          control.handleMouseDown(e);
          break;
        case goog.events.EventType.MOUSEUP:
          control.handleMouseUp(e);
          break;
        case goog.events.EventType.MOUSEOVER:
          control.handleMouseOver(e);
          break;
        case goog.events.EventType.MOUSEOUT:
          control.handleMouseOut(e);
          break;
      }
    }
  },


  /**
   * Returns the child control that owns the given DOM node, or null if no such control is found.
   * @param {Node} node DOM node whose owner is to be returned.
   * @return {goog.ui.Component?} View hosted in the container to which the node belongs (if found).
   * @protected
   * 
   * Taken from goog.ui.Container
   */
  getOwnerControl: function(node) {
    // Ensure that this container actually has child controls before looking up the owner.
    if (this.childElementIdMap_) {
      var elem = this.getElement();
      while (node && node.parentNode && node != elem) {
        var id = node.id;
        if (id in this.childElementIdMap_) {
          return this.childElementIdMap_[id];
        }
        node = node.parentNode;
      }
    }
    return null;
  },


  /**
   * Handles focus events raised when the component's key event target element receives keyboard focus.
   * If the component is focusable, updates its state and styling to indicate that it
   * now has keyboard focus.  Considered protected; should only be used within
   * this package and by subclasses.  <b>Warning:</b> IE dispatches focus and
   * blur events asynchronously!
   * @param {goog.events.BrowserEvent | goog.events.Event} e Focus event to handle.
   */
  handleFocus: function(e) {
    if (this.isAutoState(goog.ui.Component.State.FOCUSED)) {
      this.setFocused(true);
    }
  },


  /**
   * Handles blur events raised when the container's key event target loses keyboard focus. 
   * Always deactivates the component.  In addition, if the component is focusable,
   * updates its state and styling to indicate that it no longer has keyboard
   * focus.  Considered protected; should only be used within this package and
   * by subclasses.
   * <b>Warning:</b> IE dispatches focus and blur events asynchronously!
   * The default implementation clears the highlight index.
   * @param {goog.events.BrowserEvent} e Blur event to handle.
   */
  handleBlur: function(e) {
    this.setHighlightedIndex(-1);
    this.setMouseButtonPressed(false);
    if (this.isAutoState(goog.ui.Component.State.ACTIVE)) {
      this.setActive(false);
    }
    if (this.isAutoState(goog.ui.Component.State.FOCUSED)) {
      this.setFocused(false);
    }
  },


  /**
   * Attempts to handle a keyboard event, if the control is enabled, by calling
   * {@link handleKeyEventInternal}.  Considered protected; should only be used
   * within this package and by subclasses.
   * @param {goog.events.KeyEvent} e Key event to handle.
   * @return {boolean} Whether the key event was handled.
   */
  handleKeyEvent: function(e) {
    if (this.isVisible() && this.isEnabled() && this.handleKeyEventInternal(e)) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  },


  /**
   * Attempts to handle a keyboard event; returns true if the event was handled,
   * false otherwise.  If the container is enabled, and a child is highlighted,
   * calls the child control's {@code handleKeyEvent} method to give the control
   * a chance to handle the event first.
   * @param {goog.events.KeyEvent} e Key event to handle.
   * @return {boolean} Whether the event was handled by the container (or one of
   *     its children).
   */
  handleKeyEventInternal: function(e) {
    if (this.getChildCount() != 0) {
      // Give the highlighted control the chance to handle the key event.
      var highlighted = this.getHighlighted();
      if (highlighted && typeof highlighted.handleKeyEvent == 'function' && highlighted.handleKeyEvent(e)) {
        return true;
      }
    }

    // Either nothing is highlighted, or the highlighted control didn't handle
    // the key event, so attempt to handle it here.
    switch (e.keyCode) {
      case goog.events.KeyCodes.ENTER:
        this.performActionInternal(e);
        break;
        
      case goog.events.KeyCodes.ESC:
        if (this.isFocusable()) {
          this.getKeyEventTarget().blur();
        } else {
          return false;
        }
        break;

      case goog.events.KeyCodes.HOME:
        this.highlightFirst();
        break;

      case goog.events.KeyCodes.END:
        this.highlightLast();
        break;

      case goog.events.KeyCodes.UP:
      case goog.events.KeyCodes.LEFT:
        if (this.isRightToLeft()) {
          this.highlightNext();
        } else {
          this.highlightPrevious();
        }
        break;

      case goog.events.KeyCodes.DOWN:
      case goog.events.KeyCodes.RIGHT:
        if (this.isRightToLeft()) {
          this.highlightPrevious();
        } else {
          this.highlightNext();
        }
        break;

      default:
        return false;
    }

    return true;
  },


  /*********************************************************************************************/
  /********************************* Child component management. *******************************/


  /**
   * Creates a DOM ID for the child control and registers it to an internal
   * hash table to be able to find it fast by id.
   * @param {goog.ui.Control} child The child control. Its root element has
   *     to be created yet.
   * @private
   */
  registerChildId_: function(child) {
    // Map the DOM ID of the control's root element to the control itself.
    var childElem = child.getElement();

    // If the control's root element doesn't have a DOM ID assign one.
    var id = childElem.id || (childElem.id = child.getId());

    // Lazily create the child element ID map on first use.
    if (!this.childElementIdMap_) {
      this.childElementIdMap_ = {};
    }
    this.childElementIdMap_[id] = child;
  },


  /**
   * Adds the specified control as the last child of this container.  See
   * {@link goog.ui.Container#addChildAt} for detailed semantics.
   * @param {goog.ui.Component} child The new child component.
   * @param {boolean} opt_render Whether the new child should be rendered
   *     immediately after being added (defaults to false).
   */
  addChild: function(child, opt_render) {
    cmvc.ui.View.superClass_.addChild.call(this, child, opt_render);
  },


  /**
   * Adds the control as a child of this container at the given 0-based index.
   * Overrides {@link goog.ui.Component#addChildAt} by also updating the
   * container's highlight index.  Since {@link goog.ui.Component#addChild} uses
   * {@link #addChildAt} internally, we only need to override this method.
   * @param {goog.ui.Component} control New child.
   * @param {number} index Index at which the new child is to be added.
   * @param {boolean} opt_render Whether the new child should be rendered
   *     immediately after being added (defaults to false).
   */
  addChildAt: function(control, index, opt_render) {
    // Make sure the child control dispatches HIGHLIGHT and UNHIGHLIGHT events, and that it doesn't steal keyboard focus.
    control.setDispatchTransitionEvents(goog.ui.Component.State.HOVER, true);
    control.setDispatchTransitionEvents(goog.ui.Component.State.OPENED, true);
    
    if (this.isFocusable() || !this.isFocusableChildrenAllowed()) {
      control.setSupportedState(goog.ui.Component.State.FOCUSED, false);
    }

    // Disable mouse event handling by child controls.
    if (this.isHandleOwnMouseEvents() || this.isHandleChildEvents()) {
      control.setHandleMouseEvents(false);
    }

    // Let the superclass implementation do the work.
    cmvc.ui.View.superClass_.addChildAt.call(this, control, index, opt_render);

    if (opt_render && this.isInDocument()) {
      this.registerChildId_(control);
    }

    // Update the highlight index, if needed.
    if (index <= this.highlightedIndex_) {
      this.highlightedIndex_++;
    }
  },


  /**
   * Removes a child control.  Overrides {@link goog.ui.Component#removeChild} by
   * updating the highlight index.  Since {@link goog.ui.Component#removeChildAt}
   * uses {@link #removeChild} internally, we only need to override this method.
   * @param {string|goog.ui.Component} control The ID of the child to remove, or
   *     the control itself.
   * @param {boolean} opt_unrender Whether to call {@code exitDocument} on the
   *     removed control, and detach its DOM from the document (defaults to
   *     false).
   * @return {goog.ui.Component} The removed control, if any.
   */
  removeChild: function(control, opt_unrender) {
    // TODO: Fix implementation so that it works if control is a string.

    var index = this.indexOfChild(/** @type {goog.ui.Component} */ (control));
    if (index != -1) {
      if (index == this.highlightedIndex_) {
        control.setHighlighted(false);
      } else if (index < this.highlightedIndex_) {
        this.highlightedIndex_--;
      }
    }

    // Remove the mapping from the child element ID map.
    var childElem = control.getElement();
    if (childElem && childElem.id) {
      goog.object.remove(this.childElementIdMap_, childElem.id);
    }

    control = /** @type {goog.ui.Component} */ (cmvc.ui.View.superClass_.removeChild.call(this, control, opt_unrender));

    // Re-enable mouse event handling (in case the control is reused elsewhere).
    control.setHandleMouseEvents(true);

    return control;
  },
  
  
  // This function retrieves a goog.ui.Component object from the view hierarchy, starting with 'this' as the root.
  // idea taken from SproutCore's View#getPath
  getView: function(viewPath) {
    var retval = this;      // return this if the viewPath is the empty string
    var root = null,
        child = null;
    viewPath = goog.string.trim(viewPath);
    if(viewPath.length > 0) {
      root = viewPath.split('.', 1)[0];      // get the string before the first period: "a.b.c" -> "a"
      child = this.getChild(root);
      
      // find the child view in the hierarchy of views
      if(child) {
        // recursively dig down and find the correct child view
        retval = child.getView(viewPath.substr(root.length + 1));
      } else {
        // if the specified child view doesn't exist or there are no child_views, return null
        retval = null;
      }
    }
    return retval;
  },


  /*********************************************************************************************/
  /************************************** View state management. *******************************/


  /**
   * Returns true if the control allows text selection within its DOM, false
   * otherwise.  Controls that disallow text selection have the appropriate
   * unselectable styling applied to their elements.  Note that controls hosted
   * in containers will report that they allow text selection even if their
   * container disallows text selection.
   * @return {boolean} Whether the control allows text selection.
   */
  isAllowTextSelection: function() {
    return this.allowTextSelection_;
  },


  /**
   * Allows or disallows text selection within the control's DOM.
   * @param {boolean} allow Whether the control should allow text selection.
   */
  setAllowTextSelection: function(allow) {
    this.allowTextSelection_ = allow;

    var element = this.getElement();
    if (element) {
      // On all browsers other than IE and Opera, it isn't necessary to recursively
      // apply unselectable styling to the element's children.
      // So, only recursively mark each child element unselectable if the browser is IE or Opera, otherwise, don't.
      // Recursively marking each child element unselectable is expensive and unnecessary, 
      // so in browsers other than IE/Opera only mark the root element unselectable.
      goog.style.setUnselectable(element, !allow, !goog.userAgent.IE && !goog.userAgent.OPERA);
    }
  },
  
  
  /**
   * Returns true if the container's visibility is set to visible, false if
   * it is set to hidden.  A container that is set to hidden is guaranteed
   * to be hidden from the user, but the reverse isn't necessarily true.
   * A container may be set to visible but can otherwise be obscured by another
   * element, rendered off-screen, or hidden using direct CSS manipulation.
   * @return {boolean} Whether the container is set to be visible.
   */
  isVisible: function() {
    return this.visible_;
  },


  /**
   * Shows or hides the container.  Does nothing if the container already has
   * the requested visibility.  Otherwise, dispatches a SHOW or HIDE event as
   * appropriate, giving listeners a chance to prevent the visibility change.
   * @param {boolean} visible Whether to show or hide the container.
   * @param {boolean} opt_force If true, doesn't check whether the container
   *     already has the requested visibility, and doesn't dispatch any events.
   * @return {boolean} Whether the visibility was changed.
   */
  setVisible: function(visible, opt_force) {
    if (opt_force || 
        (this.visible_ != visible && 
         this.dispatchEvent(visible ? goog.ui.Component.EventType.BEFORE_SHOW : goog.ui.Component.EventType.HIDE))) {
      this.visible_ = visible;

      var elem = this.getElement();
      if (elem) {
        goog.style.showElement(elem, visible);
        if (this.isEnabled()) {
          this.setFocusable(visible);
        }
        if (visible && !opt_force) {
          this.dispatchEvent(goog.ui.Component.EventType.SHOW);
          this.dispatchEvent(goog.ui.Container.EventType.AFTER_SHOW);
        }
      }

      return true;
    }

    return false;
  },


  /**
   * Returns true if the control has a parent that is itself disabled, false
   * otherwise.
   * @return {boolean} Whether the component is hosted in a disabled container.
   * @private
   */
  isParentDisabled_: function() {
    var parent = this.getParent();
    return !!parent && typeof parent.isEnabled == 'function' && parent.isEnabled();
  },
  
  
  /**
   * Returns true if the container is enabled, false otherwise.
   * @return {boolean} Whether the container is enabled.
   */
  isEnabled: function() {
    return this.enabled_;
  },


  /**
   * Enables/disables the container based on the {@code enable} argument.
   * Dispatches an {@code ENABLED} or {@code DISABLED} event prior to changing
   * the container's state, which may be caught and canceled to prevent the
   * container from changing state.  Also enables/disables child controls.
   * @param {boolean} enable Whether to enable or disable the container.
   */
  setEnabled: function(enable) {
    if (!this.isParentDisabled_() &&
        this.isTransitionAllowed(goog.ui.Component.State.DISABLED, !enable)) {
    
      if (this.enabled_ != enable && 
          this.dispatchEvent(enable ? goog.ui.Component.EventType.ENABLE : goog.ui.Component.EventType.DISABLE)) {
        if (enable) {
          // Flag the container as enabled first, then update children.  This is
          // because controls can't be enabled if their parent is disabled.
          this.enabled_ = true;
          this.forEachChild(function(child) {
            // Enable child control unless it is flagged.
            if (child.wasDisabled) {
              delete child.wasDisabled;
            } else {
              child.setEnabled(true);
            }
          });
        } else {
          // Disable children first, then flag the container as disabled.  This is
          // because controls can't be disabled if their parent is already disabled.
          this.forEachChild(function(child) {
            // Disable child control, or flag it if it's already disabled.
            if (child.isEnabled()) {
              child.setEnabled(false);
            } else {
              child.wasDisabled = true;
            }
          });
          this.enabled_ = false;
          this.setActive(false);
          this.setHighlighted(false);
          this.setMouseButtonPressed(false);
        }

        if (this.isVisible()) {
          this.setFocusable(enable);
        } else if (this.isFocusable()) {
          // Enable keyboard access only for enabled & visible components.
          this.enableTabIndex(this.getKeyEventTarget(), enable && this.visible_);
        }
        this.setState(goog.ui.Component.State.DISABLED, !enable);
      }
    
    }
  },


  /**
   * Returns true if the container is focusable, false otherwise.  The default
   * is true.  Focusable containers always have a tab index and allocate a key
   * handler to handle keyboard events while focused.
   * @return {boolean} Whether the component is focusable.
   */
  isFocusable: function() {
    return this.focusable_;
  },


  /**
   * Sets whether the container is focusable.  The default is true.  Focusable
   * containers always have a tab index and allocate a key handler to handle
   * keyboard events while focused.
   * @param {boolean} focusable Whether the component is to be focusable.
   */
  setFocusable: function(focusable) {
    if (focusable != this.focusable_ && this.isInDocument()) {
      this.enableFocusHandling_(focusable);
    }
    this.focusable_ = focusable;
    if (this.enabled_ && this.visible_) {
      this.enableTabIndex(this.getKeyEventTarget(), focusable);
    }
  },
  
  
  /**
   * Enables or disables the tab index of the element.  Only elements with a
   * valid tab index can receive focus.
   * @param {Element} element Element whose tab index is to be changed.
   * @param {boolean} enable Whether to add or remove the element's tab index.
   */
  enableTabIndex: function(element, enable) {
    if (element) {
      element.tabIndex = enable ? 0 : -1;
    }
  },


  /**
   * Returns true if the element has a valid tab index (defined as >= 0), false
   * otherwise.  Only elements with a valid tab index can receive focus.
   * @param {Element?} element Element to check.
   * @return {boolean} Whether the element has a tab index.
   */
  hasTabIndex: function(element) {
    if (element) {
      // IE returns a value of 0 for an unset tabIndex.  Therefore, we must use
      // getAttributeNode('tabIndex'), which returns an object with a 'specified'
      // property if tabIndex is specified.  For more info, see
      // http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
      var attrNode = element.getAttributeNode('tabindex');
      if (attrNode && attrNode.specified) {
        // TabIndex is specified.
        var index = element.tabIndex;
        return goog.isNumber(index) && index >= 0;
      }
    }
    // Either the element is null, or tabIndex is not specified.
    return false;
  },
  
  
  /**
   * Returns true if the container allows children to be focusable, false
   * otherwise.  Only effective if the container is not focusable.
   * @return {boolean} Whether children should be focusable.
   */
  isFocusableChildrenAllowed: function() {
    return this.allowFocusableChildren_;
  },


  /**
   * Sets whether the container allows children to be focusable, false
   * otherwise.  Only effective if the container is not focusable.
   * @param {boolean} focusable Whether the children should be focusable.
   */
  setFocusableChildrenAllowed: function(focusable) {
    this.allowFocusableChildren_ = focusable;
  },
  
  
  /**
   * Returns true if the mouse button is pressed, false otherwise.
   * @return {boolean} Whether the mouse button is pressed.
   */
  isMouseButtonPressed: function() {
    return this.mouseButtonPressed_;
  },


  /**
   * Sets or clears the "mouse button pressed" flag.
   * @param {boolean} pressed Whether the mouse button is presed.
   */
  setMouseButtonPressed: function(pressed) {
    this.mouseButtonPressed_ = pressed;
  },


  /**
   * Returns true if the component is active (pressed), false otherwise.
   * @return {boolean} Whether the component is active.
   */
  isActive: function() {
    return this.hasState(goog.ui.Component.State.ACTIVE);
  },


  /**
   * Activates or deactivates the component.  Does nothing if this state
   * transition is disallowed.
   * @param {boolean} active Whether to activate or deactivate the component.
   * @see #isTransitionAllowed
   */
  setActive: function(active) {
    if (this.isTransitionAllowed(goog.ui.Component.State.ACTIVE, active)) {
      this.setState(goog.ui.Component.State.ACTIVE, active);
    }
  },


  /**
   * Returns true if the component is styled to indicate that it has keyboard
   * focus, false otherwise.  Note that {@code isFocused()} returning true
   * doesn't guarantee that the component's key event target has keyborad focus,
   * only that it is styled as such.
   * @return {boolean} Whether the component is styled to indicate as having
   *     keyboard focus.
   */
  isFocused: function() {
    return this.hasState(goog.ui.Component.State.FOCUSED);
  },


  /**
   * Applies or removes styling indicating that the component has keyboard focus.
   * Note that unlike the other "set" methods, this method is called as a result
   * of the component's element having received or lost keyboard focus, not the
   * other way around, so calling {@code setFocused(true)} doesn't guarantee that
   * the component's key event target has keyboard focus, only that it is styled
   * as such.
   * @param {boolean} focused Whether to apply or remove styling to indicate that
   *     the component's element has keyboard focus.
   */
  setFocused: function(focused) {
    if (this.isTransitionAllowed(goog.ui.Component.State.FOCUSED, focused)) {
      this.setState(goog.ui.Component.State.FOCUSED, focused);
    }
  },


  /**
   * Returns the component's state as a bit mask of {@link
   * goog.ui.Component.State}s.
   * @return {number} Bit mask representing component state.
   */
  getState: function() {
    return this.state_;
  },


  /**
   * Returns true if the component is in the specified state, false otherwise.
   * @param {goog.ui.Component.State} state State to check.
   * @return {boolean} Whether the component is in the given state.
   */
  hasState: function(state) {
    return !!(this.state_ & state);
  },


  /**
   * Sets or clears the given state on the component, and updates its styling
   * accordingly.  Does nothing if the component is already in the correct state
   * or if it doesn't support the specified state.  Doesn't dispatch any state
   * transition events; use advisedly.
   * @param {goog.ui.Component.State} state State to set or clear.
   * @param {boolean} enable Whether to set or clear the state (if supported).
   */
  setState: function(state, enable) {
    if (this.isSupportedState(state) && enable != this.hasState(state)) {
      this.state_ = enable ? this.state_ | state : this.state_ & ~state;
    }
  },


  /**
   * Sets the component's state to the state represented by a bit mask of
   * {@link goog.ui.Component.State}s.  Unlike {@link #setState}, doesn't
   * update the component's styling, and doesn't reject unsupported states.
   * Called by renderers during element decoration.  Considered protected;
   * should only be used within this package and by subclasses.
   * @param {number} state Bit mask representing component state.
   * @protected
   */
  setStateInternal: function(state) {
    this.state_ = state;
  },


  /**
   * Returns true if the component supports the specified state, false otherwise.
   * @param {goog.ui.Component.State} state State to check.
   * @return {boolean} Whether the component supports the given state.
   */
  isSupportedState: function(state) {
    return !!(this.supportedStates_ & state);
  },


  /**
   * Enables or disables support for the given state. Disabling support
   * for a state while the component is in that state is an error.
   * @param {goog.ui.Component.State} state State to support or de-support.
   * @param {boolean} support Whether the component should support the state.
   * @throws {Error} If disabling support for a state the control is currently in.
   */
  setSupportedState: function(state, support) {
    if (this.isInDocument() && this.hasState(state) && !support) {
      // Since we hook up event handlers in enterDocument(), this is an error.
      throw Error(goog.ui.Component.Error.ALREADY_RENDERED);
    }

    if (!support && this.hasState(state)) {
      // We are removing support for a state that the component is currently in.
      this.setState(state, false);
    }

    this.supportedStates_ = support ? this.supportedStates_ | state : this.supportedStates_ & ~state;
  },


  /**
   * Returns true if the component provides default event handling for the state,
   * false otherwise.
   * @param {goog.ui.Component.State} state State to check.
   * @return {boolean} Whether the component provides default event handling for
   *     the state.
   */
  isAutoState: function(state) {
    return !!(this.autoStates_ & state) && this.isSupportedState(state);
  },


  /**
   * Enables or disables automatic event handling for the given state(s).
   * @param {number} states Bit mask of {@link goog.ui.Component.State}s for which
   *     default event handling is to be enabled or disabled.
   * @param {boolean} enable Whether the component should provide default event
   *     handling for the state(s).
   */
  setAutoStates: function(states, enable) {
    this.autoStates_ = enable ? this.autoStates_ | states : this.autoStates_ & ~states;
  },


  /**
   * Returns true if the component is set to dispatch transition events for the
   * given state, false otherwise.
   * @param {goog.ui.Component.State} state State to check.
   * @return {boolean} Whether the component dispatches transition events for
   *     the state.
   */
  isDispatchTransitionEvents: function(state) {
    return !!(this.statesWithTransitionEvents_ & state) && this.isSupportedState(state);
  },


  /**
   * Enables or disables transition events for the given state(s).  Controls
   * handle state transitions internally by default, and only dispatch state
   * transition events if explicitly requested to do so by calling this mentod.
   * @param {number} states Bit mask of {@link goog.ui.Component.State}s for
   *     which transition events should be enabled or disabled.
   * @param {boolean} enable Whether transition events should be enabled.
   */
  setDispatchTransitionEvents: function(states, enable) {
    this.statesWithTransitionEvents_ = enable ?
                                       this.statesWithTransitionEvents_ | states :
                                       this.statesWithTransitionEvents_ & ~states;
  },


  /**
   * Returns true if the transition into or out of the given state is allowed to
   * proceed, false otherwise.  A state transition is allowed under the following
   * conditions:
   * <ul>
   *   <li>the component supports the state,
   *   <li>the component isn't already in the target state,
   *   <li>either the component is configured not to dispatch events for this
   *       state transition, or a transition event was dispatched and wasn't
   *       canceled by any event listener, and
   *   <li>the component hasn't been disposed of
   * </ul>
   * Considered protected; should only be used within this package and by
   * subclasses.
   * @param {goog.ui.Component.State} state State to/from which the control is
   *     transitioning.
   * @param {boolean} enable Whether the control is entering or leaving the state.
   * @return {boolean} Whether the state transition is allowed to proceed.
   * @protected
   */
  isTransitionAllowed: function(state, enable) {
    return this.isSupportedState(state) &&
           this.hasState(state) != enable &&
           (!(this.statesWithTransitionEvents_ & state) || 
            this.dispatchEvent(goog.ui.Component.getStateTransitionEvent(state, enable))) &&
           !this.isDisposed();
  },


  /*********************************************************************************************/
  /*********************************** Highlight management. ***********************************/


  /**
   * Returns true if the component is currently highlighted, false otherwise.
   * @return {boolean} Whether the component is highlighted.
   */
  isHighlighted: function() {
    return this.hasState(goog.ui.Component.State.HOVER);
  },
  
  
  /**
   * Highlights or unhighlights the component.  Does nothing if this state
   * transition is disallowed.
   * @param {boolean} highlight Whether to highlight or unhighlight the component.
   * @see #isTransitionAllowed
   */
  setHighlighted: function(highlight) {
    if (this.isTransitionAllowed(goog.ui.Component.State.HOVER, highlight)) {
      this.setState(goog.ui.Component.State.HOVER, highlight);
    }
  },
  
  
  /**
   * Returns the index of the currently highlighted item (-1 if none).
   * @return {number} Index of the currently highlighted item.
   */
  getHighlightedIndex: function() {
    return this.highlightedIndex_;
  },


  /**
   * Highlights the item at the given 0-based index (if any).  If another item
   * was previously highlighted, it is un-highlighted.
   * @param {number} index Index of item to highlight (-1 removes the current
   *     highlight).
   */
  setHighlightedIndex: function(index) {
    var child = this.getChildAt(index);
    if (child) {
      child.setHighlighted(true);
    } else if (this.highlightedIndex_ > -1) {
      this.getHighlighted().setHighlighted(false);
    }
  },


  /**
   * Highlights the given item if it exists and is a child of the container;
   * otherwise un-highlights the currently highlighted item.
   * @param {goog.ui.Control} item Item to highlight.
   */
  setHighlighted: function(item) {
    this.setHighlightedIndex(this.indexOfChild(item));
  },


  /**
   * Returns the currently highlighted item (if any).
   * @return {goog.ui.Control?} Highlighted item (null if none).
   */
  getHighlighted: function() {
    return /** @type {goog.ui.Control} */ (
        this.getChildAt(this.highlightedIndex_));
  },


  /**
   * Highlights the first highlightable item in the container
   */
  highlightFirst: function() {
    this.highlightHelper(function(index, max) {
      return (index + 1) % max;
    }, this.getChildCount() - 1);
  },


  /**
   * Highlights the last highlightable item in the container.
   */
  highlightLast: function() {
    this.highlightHelper(function(index, max) {
      index--;
      return index < 0 ? max - 1 : index;
    }, 0);
  },


  /**
   * Highlights the next highlightable item (or the first if nothing is currently
   * highlighted).
   */
  highlightNext: function() {
    this.highlightHelper(function(index, max) {
      return (index + 1) % max;
    }, this.highlightedIndex_);
  },


  /**
   * Highlights the previous highlightable item (or the last if nothing is
   * currently highlighted).
   */
  highlightPrevious: function() {
    this.highlightHelper(function(index, max) {
      index--;
      return index < 0 ? max - 1 : index;
    }, this.highlightedIndex_);
  },


  /**
   * Helper function that manages the details of moving the highlight among
   * child controls in response to keyboard events.
   * @param {function(number, number) : number} fn Function that accepts the
   *     current and maximum indices, and returns the next index to check.
   * @param {number} startIndex Start index.
   * @return {boolean} Whether the highlight has changed.
   * @protected
   */
  highlightHelper: function(fn, startIndex) {
    // If the start index is -1 (meaning there's nothing currently highlighted),
    // try starting from the currently open item, if any.
    var curIndex = startIndex < 0 ?
        this.indexOfChild(this.openItem_) : startIndex;
    var numItems = this.getChildCount();

    curIndex = fn(curIndex, numItems);
    var visited = 0;
    while (visited <= numItems) {
      var control = /** @type {goog.ui.Component} */ (this.getChildAt(curIndex));
      if (control && this.canHighlightItem(control)) {
        this.setHighlightedIndexFromKeyEvent(curIndex);
        return true;
      }
      visited++;
      curIndex = fn(curIndex, numItems);
    }
    return false;
  },


  /**
   * Returns whether the given item can be highlighted.
   * @param {goog.ui.Control} item The item to check.
   * @return {boolean} Whether the item can be highlighted.
   * @protected
   */
  canHighlightItem: function(item) {
    return item.isVisible() && item.isEnabled() && item.isSupportedState(goog.ui.Component.State.HOVER);
  },


  /**
   * Helper method that sets the highlighted index to the given index in response
   * to a keyboard event.  The base class implementation simply calls the
   * {@link #setHighlightedIndex} method, but subclasses can override this
   * behavior as needed.
   * @param {number} index Index of item to highlight.
   * @protected
   */
  setHighlightedIndexFromKeyEvent: function(index) {
    this.setHighlightedIndex(index);
  }
});

// Define two constants on the View "class"
cmvc.ui.View.EventDispatch = {
  Self: 1,
  Parent: 2
};

cmvc.ui.Container = cmvc.ui.View.extend({
  
});

cmvc.ui.Control = cmvc.ui.View.extend({
  
});