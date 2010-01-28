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
 * @fileoverview cmvc.ui.View implements a subset of behaviors from goog.ui.Container.
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
goog.require('goog.ui.Container');
goog.require('goog.ui.ContainerRenderer');
goog.require('goog.userAgent');

goog.require("cmvc");
goog.require("cmvc.events");
goog.require("cmvc.string");
goog.require("cmvc.kvo");
goog.require("cmvc.Template");


/**
 * Base class for views.  Extends {@link goog.ui.Component} by adding
 * the following:
 *  <ul>
 *    <li>a {@link goog.events.KeyHandler}, to simplify keyboard handling,
 *    <li>a pluggable <em>renderer</em> framework, to simplify the creation of
 *        containers without the need to subclass this class,
 *    <li>methods to manage child controls hosted in the container,
 *    <li>default mouse and keyboard event handling methods.
 *  </ul>
 * @param {?goog.ui.Container.Orientation=} opt_orientation Container
 *     orientation; defaults to {@code VERTICAL}.
 * @param {?goog.ui.ContainerRenderer=} opt_renderer Renderer used to render or
 *     decorate the container; defaults to {@link goog.ui.ContainerRenderer}.
 * @param {?goog.dom.DomHelper=} opt_domHelper DOM helper, used for document
 *     interaction.
 * @extends {goog.ui.Component}
 * @constructor
 */
cmvc.ui.View = cmvc.extend(goog.ui.Component, {
  constructor: function(config, opt_domHelper) {
    cmvc.ui.View.superClass_.constructor.call(this, opt_domHelper);

    if(goog.isDefAndNotNull(config)) {
      goog.object.extend(this, config);
    }
    
    // enumerate the child views declared in this.children and add each as a child view of this view (the parent/root)
    if(this.children) {
      var view = null;
      goog.array.forEach(cmvc.string.words(this.children), function(childViewName, i, a) {
        // add child views (view objects) but do not render them yet because if we render the child view now, we
        //   are forced to create the DOM node for this view (the parent of the children) before we're ready.
        //   We only want to create the DOM node for this view when we call render().
        
        // If the object mapped to by the child view name is a Function, we assume it is a constructor function 
        //   that we should invoke to create a new object of that type.
        // Otherwise, if the child view name maps to a non-Function object, then we assume that the object is a
        //   cmvc.ui.View instance already, and just add it as a child.
        if (goog.isFunction(this[childViewName])) {
          view = new (this[childViewName])(this[childViewName + "Config"], opt_domHelper);
        } else {
          view = this[childViewName];
        }
        
        if(!view.id_) {             // if an ID hasn't already been set, then set one.
          view.setId(childViewName);
        }
        
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
  
  
  domEvents: {
    'mouseover': 'this.handleMouseOver',    // this is so we fire enter events
    'mouseout': 'this.handleMouseOut'       // this is so we fire leave events
  },
  
  
  keyEvents: {},
  
  
  // The following fields are taken from goog.ui.Container
  

  /**
   * Allows an alternative element to be set to recieve key events, otherwise defers to the rendered content root element.
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
   * Whether the container is enabled and reacting to keyboard and mouse events.  Defaults to true.
   * @type {boolean}
   * @private
   */
  enabled_: true,


  /**
   * Whether the view supports keyboard focus.  Defaults to false.  Focusable
   * containers have a {@code tabIndex} and can be navigated to via the keyboard.
   * @type {boolean}
   * @private
   */
  focusable_: false,


  /**
   * Map of DOM IDs to child controls.  Each key is the DOM ID of a child control's root element; 
   * each value is a reference to the child control itself.  
   * Used for looking up the child control corresponding to a DOM node in O(1) time.
   * @type {Object?}
   * @private
   */
  childElementIdMap_: null,
  
  
  // The following flags are taken from goog.ui.Control
  

  /**
   * Whether the view allows text selection within its DOM.  Defaults to true.
   * @type {boolean}
   * @private
   */
  allowTextSelection_: true,


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
        if (!child.isInDocument()) {
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
    
    // IE doesn't support outline:none, so we have to use the hideFocus property; Taken from goog.ui.ContainerRenderer#initializeDom
    if (goog.userAgent.IE) {
      elem.hideFocus = true;
    }
  },


  /**
   * Configures the container after its DOM has been rendered, and sets up event
   * handling.  Overrides {@link goog.ui.Component#enterDocument}.
   */
  enterDocument: function() {
    // Taken from Component#enterDocument
    this.inDocument_ = true;

    // Call the renderer's initializeDom method to initialize the container's DOM.
    this.initializeDom(this);

    // Render any unrendered child views before continuing enterDocument(), because we want them
    // to be in the document before calling the child's enterDocument().
    this.renderChildren();

    // Propagate enterDocument to child components that have a DOM node, if any.
    // Taken from Component#enterDocument
    this.forEachChild(function(child) {
      if (!child.isInDocument() && child.getElement()) {
        child.enterDocument();
      }
    });
    
    // register the child components that have a DOM node and are in the document.
    // Taken from Container#enterDocument
    this.forEachChild(function(child) {
      if (child.isInDocument()) {
        this.registerChildId_(child);
      }
    }, this);
    
    // If the container is focusable, set up keyboard event handling.
    this.enableFocusHandling_(this.isFocusable());
    
    // even though we could attach the view's event handlers to the view in the constructor, we don't want to
    //   handle events unless the element_ is rendered.
    this.attachDeclaredViewEventHandlers();
    
    // we only want to attach the DOM event handlers after the element_ is rendered
    this.attachDeclaredDomEventHandlers();
    
    // we only want to attach the key event handlers to the goog.evengs.KeyHandler object after the element_ is rendered
    this.attachDeclaredKeyEventHandlers();
  },
  
  
  /**
   * Sets up listening for events applicable to focusable containers.
   * Also, enables or disables the tab index of the element. Only elements with a valid tab index can receive focus.
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
    
    // Enable or disable the tab index of the element.
    // We need to do this since only elements with a valid tab index can receive focus.
    if (!enable || (this.enabled_ && this.visible_)) {
      this.enableTabIndex(keyTarget, enable);
    }
  },
  
  
  /**
   * Iterate over the events referenced in the viewEvents map and for each event/handler 
   * pair attach an event handler to this View object.
   */
  attachDeclaredViewEventHandlers: function(viewEvents) {
    viewEvents = viewEvents || this.getViewEvents() || {};
    
    cmvc.events.attachEventHandlers(this, viewEvents, this);
  },
  
  
  /**
   * Iterate over the events referenced in the domEvents map and for each event/handler 
   * pair attach an event handler to the root element.
   */
  attachDeclaredDomEventHandlers: function(domEvents) {
    var elem = this.getElement();
    
    domEvents = domEvents || this.getDomEvents() || {};
    
    if(elem) {
      cmvc.events.attachEventHandlers(elem, domEvents, this);
    }
  },
  
  
  /**
   * Iterate over the events referenced in the keyEvents map and for each event/handler 
   * pair attach an event handler to this view's KeyHandler object.
   * NOTE: There should only be a single event/handler pair:
   *       1. goog.events.KeyHandler.EventType.KEY/[handler1, handler2, ...]
   *       2. goog.events.KeyHandler.EventType.KEY/handler
   * Note also that goog.events.KeyHandler.EventType.KEY = 'key'
   */
  attachDeclaredKeyEventHandlers: function(keyEvents) {
    keyEvents = keyEvents || this.getKeyEvents() || {};
    
    cmvc.events.attachEventHandlers(this.getKeyHandler(), keyEvents, this);
  },
  
  
  getViewEvents: function() {
    this.viewEvents_ = this.viewEvents_ || cmvc.inheritProperty(this, "viewEvents", 3);
    return this.viewEvents_;
  },
  
  
  getDomEvents: function() {
    this.domEvents_ = this.domEvents_ || cmvc.inheritProperty(this, "domEvents", 3);
    return this.domEvents_;
  },
  
  
  getKeyEvents: function() {
    this.keyEvents_ = this.keyEvents_ || cmvc.inheritProperty(this, "keyEvents", 3);
    return this.keyEvents_;
  },
  
  
  /**
   * This method dispatches the event argument to the child control/view that the event targets.
   * Redirects events originating from nodes belonging to the controls hosted in this container.
   * Locates the child control based on the DOM node that dispatched the event, 
   * and forwards the event to the control for handling.
   * @param {goog.events.BrowserEvent} e Mouse event to handle.
   */
  dispatchEventToChild: function(e) {
    var child = this.getOwnerControl(/** @type {Node} */ (e.target));
    if (child) {
      child.dispatchEvent(e);
    }
  },
  
  
  /**
   * Returns the child control that owns the given DOM node, or null if no such control is found.
   * @param {Node} node DOM node whose owner is to be returned.
   * @return {goog.ui.Control | goog.ui.Container | cmvc.ui.View} View hosted in the container to which the node belongs (if found).
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
   * Cleans up the container before its DOM is removed from the document, and
   * removes event handlers.  Overrides {@link goog.ui.Component#exitDocument}.
   */
  exitDocument: function() {
    // Remove focus handling, 
    this.enableFocusHandling_(false);

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
      this.keyHandler_.detach();
      this.keyHandler_.dispose();
      this.keyHandler_ = null;
    }
    
    // remove all property observers
    cmvc.kvo.removeObservers(this);
    
    // taken from goog.ui.Container
    this.childElementIdMap_ = null;
  },


  /*********************************************************************************************/
  /*********************************** Default event handlers. *********************************/


  /**
   * Handles focus events raised when the container's key event target receives keyboard focus.
   * @param {goog.events.BrowserEvent} e Focus event to handle.
   */
  handleFocus: function(e) {
    // No-op in the base class.
  },


  /**
   * Handles blur events raised when the container's key event target loses keyboard focus.
   * @param {goog.events.BrowserEvent} e Blur event to handle.
   */
  handleBlur: function(e) {
    // No-op in the base class.
  },
  
  /**
   * Attempts to handle a keyboard event, if the control is enabled, by calling
   * {@link handleKeyEventInternal}.  Considered protected; should only be used
   * within this package and by subclasses.
   * @param {goog.events.KeyEvent} e Key event to handle.
   * @return {boolean} Whether the key event was handled.
   */
  handleKeyEvent: function(e) {
    if (this.isEnabled() && this.getChildCount() != 0 && this.handleKeyEventInternal(e)) {
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
    switch (e.keyCode) {
      case goog.events.KeyCodes.ESC:
        if (this.isFocusable()) {
          this.getKeyEventTarget().blur();
        } else {
          return false;
        }
        break;

      default:
        return false;
    }

    return true;
  },


  /**
   * Handles mouseover events. Dispatches an ENTER event;
   * Considered protected; should only be used within this package and by subclasses.
   * @param {goog.events.BrowserEvent} e Mouse event to handle.
   */
  handleMouseOver: function(e) {
    // Ignore mouse moves between descendants.
    // From the event.relatedTarget documentation from Mozilla MDC found at
    //   https://developer.mozilla.org/en/DOM/event.relatedTarget:
    //   For the mouseover event this property (event.relatedTarget) indicates the EventTarget which the pointing device exited.
    // If the mouse just exited a non-descendent of this.element_, as it entered this element, then fire the ENTER event.
    if (e.relatedTarget && !goog.dom.contains(this.element_, e.relatedTarget)) {
      this.dispatchEvent(goog.ui.Component.EventType.ENTER);
    }
  },
  
  
  /**
   * Handles mouseout events. Dispatches a LEAVE event;
   * Considered protected; should only be used within this package and by subclasses.
   * @param {goog.events.BrowserEvent} e Mouse event to handle.
   */
  handleMouseOut: function(e) {
    // Ignore mouse moves between descendants.
    // For the mouseout event this property (event.relatedTarget) indicates the EventTarget which the pointing device entered.
    // If the mouse just entered a non-descendant of this.element_, as it exited this element, then fire the LEAVE event.
    if (e.relatedTarget && !goog.dom.contains(this.element_, e.relatedTarget)) {
      this.dispatchEvent(goog.ui.Component.EventType.LEAVE);
    }
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
    // Let the superclass implementation do the work.
    cmvc.ui.View.superClass_.addChildAt.apply(this, arguments);

    // This is taken from goog.ui.Container
    if (opt_render && this.isInDocument()) {
      this.registerChildId_(control);
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

    // Remove the mapping from the child element ID map.
    var childElem = control.getElement();
    if (childElem && childElem.id) {
      goog.object.remove(this.childElementIdMap_, childElem.id);
    }

    control = cmvc.ui.View.superClass_.removeChild.call(this, control, opt_unrender);

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
        if (this.isFocusable()) {
          // Enable keyboard access only for enabled & visible views.
          this.enableFocusHandling_(this.enabled_ && this.visible_);
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
      }

      if (this.isFocusable()) {
        // Enable keyboard access only for enabled & visible components.
        this.enableFocusHandling_(enable && this.visible_);
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
  },
  
  
  /**
   * Enables or disables the tab index of the element.  Only elements with a valid tab index can receive focus.
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
  }
});


cmvc.ui.View.EventDispatch = {
  Parent: 1,
  Child: 2
};