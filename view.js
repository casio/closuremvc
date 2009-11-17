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

/**
 * @fileoverview 
 *
 */

goog.provide('goog.ui.Container');
goog.provide('goog.ui.Container.Orientation');

goog.require('goog.dom');
goog.require('goog.dom.a11y');
goog.require('goog.dom.a11y.State');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyHandler');
goog.require('goog.events.KeyHandler.EventType');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('goog.ui.Component.Error');
goog.require('goog.ui.Component.EventType');
goog.require('goog.ui.Component.State');
goog.require('goog.ui.ContainerRenderer');
goog.require('goog.userAgent');


/**
 * Base class for views. Extends {@link goog.ui.Component} by adding
 * the following:
 *  <ul>
 *    <li>a {@link goog.events.KeyHandler}, to simplify keyboard handling,
 *    <li>a pluggable <em>renderer</em> framework, to simplify the creation of
 *        containers without the need to subclass this class,
 *    <li>methods to manage child controls hosted in the container,
 *    <li>default mouse and keyboard event handling methods.
 *  </ul>
 * @param {?goog.ui.Container.Orientation} opt_orientation Container
 *     orientation; defaults to {@code VERTICAL}.
 * @param {?goog.ui.ContainerRenderer} opt_renderer Renderer used to render or
 *     decorate the container; defaults to {@link goog.ui.ContainerRenderer}.
 * @param {?goog.dom.DomHelper} opt_domHelper DOM helper, used for document
 *     interaction.
 * @extends {goog.ui.Component}
 * @constructor
 */
cmvc.ui.View = cmvc.extend(goog.ui.Component, {
  constructor: function(opt_orientation, opt_renderer, opt_domHelper) {
    cmvc.ui.View.superClass_.constructor.call(this, opt_domHelper);

    this.renderer_ = opt_renderer || cmvc.ui.ViewRenderer.getInstance();
    this.orientation_ = opt_orientation || this.renderer_.getDefaultOrientation();
    
    /*
    // prepare the tag and attributes for createDom
    this.elementTag = this.root['tag'] || 'div';
    this.elementAttributes = goog.object.clone(this.root);
    delete this.elementAttributes['tag'];
    //*/
    
    // enumerate the child views declared in this.children and add each as a child view of this view (the parent/root)
    if(this.children) {
      goog.array.forEach(cmvc.string.words(this.children), function(e, i, a) {
        // add child views (view objects) but do not render them yet because if we render the child view now, we
        //   are forced to create the DOM node for this view (the parent of the children) before we're ready.
        //   We only want to create the DOM node for this view when we call render().
        this.addChild(new (this[e])(opt_domHelper), false);
      }, this);
    }
  },
  
  
  /**
   * This is a convenience method for applying properties to a newly created View immediately after instantiation.
   * 
   * Example:
   *   var v = (new cmvc.ui.View(...)).extend({id: "view12", parent: thatContainer});
   */
  extend: function(properties) {
    goog.object.extend(this, properties);
    return this;
  },


  /**
   * Default view event handlers.
   */
  viewEvents: {
    goog.ui.Component.EventType.ENTER:        'this.handleEnterItem',
    goog.ui.Component.EventType.HIGHLIGHT:    'this.handleHighlightItem',
    goog.ui.Component.EventType.UNHIGHLIGHT:  'this.handleUnHighlightItem',
    goog.ui.Component.EventType.OPEN:         'this.handleOpenItem',
    goog.ui.Component.EventType.CLOSE:        'this.handleCloseItem'
  },
  

  /*********************************************************************************************/
  /******View Properties (combination of goog.ui.Container and goog.ui.Control properties)******/


  /**
   * Allows an alternative element to be set to recieve key events, otherwise
   * defers to the renderer's element choice.
   * @type {Element|undefined}
   * @private
   */
  keyEventTarget_ = null,


  /**
   * Keyboard event handler.
   * @type {goog.events.KeyHandler?}
   * @private
   */
  keyHandler_ = null,


  /**
   * Renderer for the container.  Defaults to {@link goog.ui.ContainerRenderer}.
   * @type {goog.ui.ContainerRenderer?}
   * @private
   */
  renderer_ = null,


  /**
   * Container orientation; determines layout and default keyboard navigation.
   * @type {?goog.ui.Container.Orientation}
   * @private
   */
  orientation_ = null,


  /**
   * Whether the container is set to be visible.  Defaults to true.
   * @type {boolean}
   * @private
   */
  visible_ = true,


  /**
   * Whether the container is enabled and reacting to keyboard and mouse events.
   * Defaults to true.
   * @type {boolean}
   * @private
   */
  enabled_ = true,


  /**
   * Whether the container supports keyboard focus.  Defaults to true.  Focusable
   * containers have a {@code tabIndex} and can be navigated to via the keyboard.
   * @type {boolean}
   * @private
   */
  focusable_ = true,


  /**
   * The 0-based index of the currently highlighted control in the container
   * (-1 if none).
   * @type {number}
   * @private
   */
  highlightedIndex_ = -1,


  /**
   * The currently open (expanded) child view in this view (null if none).
   * @type {cmvc.ui.View?}
   * @private
   */
  openItem_ = null,


  /**
   * Whether the mouse button is held down.  Defaults to false.  This flag is set
   * when the user mouses down over the container, and remains set until they
   * release the mouse button.
   * @type {boolean}
   * @private
   */
  mouseButtonPressed_ = false,


  /**
   * Whether focus of child componenets should be allowed.  Only effective if focusable_ is set to false.
   * @type {boolean}
   * @private
   */
  allowFocusableChildren_ = false,


  /**
   * Map of DOM IDs to child controls.  Each key is the DOM ID of a child
   * control's root element; each value is a reference to the child control
   * itself.  Used for looking up the child control corresponding to a DOM
   * node in O(1) time.
   * @type {Object?}
   * @private
   */
  childElementIdMap_ = null,


  /**
   * Whether the view should listen for and handle mouse events; defaults to true.
   * @type {boolean}
   * @private
   */
  handleMouseEvents_ = true,


  /**
   * Whether the view allows text selection within its DOM.  Defaults to false.
   * @type {boolean}
   * @private
   */
  allowTextSelection_ = false,


  /**
   * Current component state; a bit mask of {@link goog.ui.Component.State}s.
   * @type {number}
   * @private
   */
  state_ = 0x00,


  /**
   * A bit mask of {@link goog.ui.Component.State}s this component supports.
   * @type {number}
   * @private
   */
  supportedStates_ = goog.ui.Component.State.DISABLED |
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


  /**
   * A bit mask of {@link goog.ui.Component.State}s for which this component
   * dispatches state transition events.  Because events are expensive, the
   * default behavior is to not dispatch any state transition events at all.
   * Use the {@link #setDispatchTransitionEvents} API to request transition
   * events  as needed.  Subclasses may enable transition events by default.
   * Controls hosted in containers or managed by a selection model will typically
   * want to dispatch transition events.
   * @type {number}
   * @private
   */
  statesWithTransitionEvents_: 0x00,


  /*********************************************************************************************/
  /************************ Event handler and renderer management. *****************************/


  /**
   * Returns the DOM element on which the container is listening for keyboard
   * events (null if none).
   * @return {Element?} Element on which the container is listening for key
   *     events.
   */
  getKeyEventTarget: function() {
    // Delegate to renderer, unless we've set an explicit target.
    return this.keyEventTarget_ || this.renderer_.getKeyEventTarget(this);
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
        // Unlisten for events on the old key target.  Requires us to reset
        // key target state temporarily.
        this.keyEventTarget_ = oldTarget;
        this.enableFocusHandling_(false);
        this.keyEventTarget_ = element;

        // Listen for events on the new key target.
        this.getKeyHandler().attach(newTarget);
        this.enableFocusHandling_(true);
      }
    } else {
     throw Error('Can\'t set key event target for container that doesn\'t support keyboard focus!');
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


  /**
   * Returns true if the control is configured to handle its own mouse events,
   * false otherwise.  Controls not hosted in {@link goog.ui.Container}s have
   * to handle their own mouse events, but controls hosted in containers may
   * allow their parent to handle mouse events on their behalf.  Considered
   * protected; should only be used within this package and by subclasses.
   * @return {boolean} Whether the control handles its own mouse events.
   */
  isHandleMouseEvents: function() {
    return this.handleMouseEvents_;
  },


  /**
   * Enables or disables mouse event handling for the control.  Containers may
   * use this method to disable mouse event handling in their child controls.
   * Considered protected; should only be used within this package and by
   * subclasses.
   * @param {boolean} enable Whether to enable or disable mouse event handling.
   */
  setHandleMouseEvents: function(enable) {
    if (this.isInDocument() && enable != this.handleMouseEvents_) {
      // Already in the document; need to update event handler.
      this.enableMouseEventHandling_(enable);
    }
    this.handleMouseEvents_ = enable;
  },
  

  /**
   * Returns the renderer used by this container to render itself or to decorate
   * an existing element.
   * @return {goog.ui.ContainerRenderer} Renderer used by the container.
   */
  getRenderer: function() {
    return this.renderer_;
  },


  /**
   * Registers the given renderer with the container.  Changing renderers after
   * the container has already been rendered or decorated is an error.
   * @param {goog.ui.ContainerRenderer} renderer Renderer used by the container.
   */
  setRenderer: function(renderer) {
    if (this.getElement()) {
      // Too late.
      throw Error(goog.ui.Component.Error.ALREADY_RENDERED);
    }

    this.renderer_ = renderer;
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
   */
  render_: function(opt_parentElement) {
    this.preRender();
    
    // render the root element
    cmvc.ui.View.superClass_.render_.apply(this, arguments);
    
    this.postRender();
  },
  
  
  // placeholder preRender function
  preRender: function() {},
  
  
  // placeholder postRender function
  postRender: function() {},
  
  
  renderChildren: function() {
    if(this.element_) {
      // render any child views that haven't been rendered yet
      this.forEachChild(function(child, i) {
        if(!child.isInDocument()) {
          child.render(this.element_);
        }
      }, this);
    }
  },
  
  
  /**
   * Creates the container's DOM.  Overrides {@link goog.ui.Component#createDom}.
   */
  createDom: function() {
    var element = this.renderer_.createDom(this);
    
    // Delegate to renderer.
    this.setElementInternal(element);
    
    // Initialize ARIA role.
    this.renderer_.setAriaRole(element);

    // Initialize text selection.
    if (!this.isAllowTextSelection()) {
      // The renderer is assumed to create selectable elements.  Since making
      // elements unselectable is expensive, only do it if needed (bug 1037090).
      this.renderer_.setAllowTextSelection(element, false);
    }

    // Initialize visibility.
    if (!this.isVisible()) {
      // The renderer is assumed to create visible elements. Since hiding
      // elements can be expensive, only do it if needed (bug 1037105).
      this.renderer_.setVisible(element, false);
    }
  },


  /**
   * Returns the DOM element into which child components are to be rendered,
   * or null if the container itself hasn't been rendered yet.  Overrides
   * {@link goog.ui.Component#getContentElement} by delegating to the renderer.
   * @return {Element?} Element to contain child elements (null if none).
   */
  getContentElement: function() {
    // Delegate to renderer.
    return this.renderer_.getContentElement(this.getElement());
  },


  /**
   * Returns true if the given element can be decorated by this container.
   * Overrides {@link goog.ui.Component#canDecorate}.
   * @param {Element} element Element to decorate.
   * @return {boolean} True iff the element can be decorated.
   */
  canDecorate: function(element) {
    // Delegate to renderer.
    return this.renderer_.canDecorate(element);
  },


  /**
   * Decorates the given element with this component. Overrides {@link
   * goog.ui.Component#decorateInternal} by delegating DOM manipulation
   * to the control's renderer.
   * @param {Element} element Element to decorate.
   * @protected
   * @override
   */
  decorateInternal: function(element) {
    element = this.renderer_.decorate(this, element);

    // Delegate to renderer.
    this.setElementInternal(element);

    // Initialize ARIA role.
    this.renderer_.setAriaRole(element);

    // Initialize text selection.
    if (!this.isAllowTextSelection()) {
      // Decorated elements are assumed to be selectable.  Since making elements
      // unselectable is expensive, only do it if needed (bug 1037090).
      this.renderer_.setAllowTextSelection(element, false);
    }

    // Initialize visibility based on the decorated element's styling.
    this.visible_ = element.style.display != 'none';
  },


  /**
   * Configures the container after its DOM has been rendered, and sets up event
   * handling.  Overrides {@link goog.ui.Component#enterDocument}.
   */
  enterDocument: function() {
    // render any unrendered child views before continuing enterDocument(), because we want them
    // to be in the document before continuing
    this.renderChildren();
    
    /**
     * Calling the superclass enterDocument (goog.ui.Component#enterDocument) does the following, in order:
     * 1. Sets inDocument_ to true
     * 2. Propagate enterDocument to rendered child components (i.e. child components that have a DOM element), if any.
     */
    cmvc.ui.View.superClass_.enterDocument.call(this);

    this.forEachChild(function(child) {
      if (child.isInDocument()) {
        this.registerChildId_(child);
      }
    }, this);
    
    // Call the renderer's initializeDom method to initialize the container's DOM.
    this.renderer_.initializeDom(this);
    
    // Initialize visibility (opt_force = true, so we don't dispatch events).
    this.setVisible(this.visible_, true);

    // Initialize event handling if at least one state other than DISABLED is supported.
    if (this.supportedStates_ & ~goog.ui.Component.State.DISABLED) {
      // If the container is focusable, set up keyboard event handling.
      if (this.isFocusable()) {
        this.enableFocusHandling_(true);
      }

      // Initialize mouse event handling if the control is configured to handle
      // its own mouse events.  (Controls hosted in containers don't need to
      // handle their own mouse events.)
      if (this.isHandleMouseEvents()) {
        this.enableMouseEventHandling_(true);
      }
      
      // even though we could attach the view's event handlers to the view in the constructor, we don't want to
      //   handle events unless the element_ is rendered.
      this.attachDeclaredViewEventHandlers();

      // we only want to attach the DOM event handlers after the element_ is rendered
      this.attachDeclaredDomEventHandlers();
    }
  },
  
  
  /**
   * Iterate over all pairs of event/function_reference pairs in the event_handlers object, attaching
   * each function_reference as an event listener for the corresponding event.
   */
  attachDeclaredViewEventHandlers: function(viewEvents) {
    var fn = null,
        context = null;
    
    viewEvents = viewEvents || this.viewEvents || {};
    
    goog.object.forEach(viewEvents, function(handler, evt, o) {
      switch(goog.typeof(handler)) {
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
        case "number";      // the event handler is a reference to a specific built-in behavior
          // TODO: Finish this case. Add the named constants to the View "class" object.
          switch(handler) {
            case cmvc.ui.View.EventHandlers.Parent:
              context = this;
              break;
            case cmvc.ui.View.EventHandlers.Child:
              // context = somehow get the child view object that the event target references.
              break;
            default:
              throw Error("Unable to attach event handler to the view. Unknown event handler reference.");
          }
          fn = context.handleEvent;
          break;
        default:
          throw Error("Unable to attach event handler to the view. Unknown event handler type.");
      }
      
      // I started attaching events like this:
      //goog.events.listen(this, e, fn, false, context);
      // but I'd rather use this object's EventHandler object, like below, instead of the global listen "registry"
      //   because all I have to do to stop listening to the events is to dispose of the EventHandler object.
      this.getHandler().listen(this, evt, fn, false, context);
    });
  },
  
  
  /**
   * Iterate over the events referenced in the domEvents array and for each event attach an event handler to the
   * root element that will simply fire the same event on the View object.
   */
  attachDeclaredDomEventHandlers: function(domEvents) {
    var elem = this.getElement();
    
    domEvents = domEvents || this.domEvents || {};
    
    if(elem) {
      // create the initial event handlers
      goog.array.forEach(domEvents, function(e, i, a) {
        // e is the event name/constant (e.g. 'click', goog.events.EventType.MOUSEDOWN)
        this.getHandler().listen(elem, e, goog.partial(goog.events.dispatchEvent, this), false, this);
      }, this);
    }
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
              listen(element, goog.events.EventType.MOUSEOUT, this.handleMouseOut);
      if (goog.userAgent.IE) {
        handler.listen(element, goog.events.EventType.DBLCLICK, this.handleDblClick);
      }
    } else {
      handler.unlisten(element, goog.events.EventType.MOUSEOVER, this.handleMouseOver).
              unlisten(element, goog.events.EventType.MOUSEDOWN, this.handleMouseDown).
              unlisten(element, goog.events.EventType.MOUSEUP, this.handleMouseUp).
              unlisten(element, goog.events.EventType.MOUSEOUT, this.handleMouseOut);
      if (goog.userAgent.IE) {
        handler.unlisten(element, goog.events.EventType.DBLCLICK, this.handleDblClick);
      }
    }
  },
  
  
  /**
   * Cleans up the container before its DOM is removed from the document, and
   * removes event handlers.  Overrides {@link goog.ui.Component#exitDocument}.
   */
  exitDocument: function() {
    // {@link #setHighlightedIndex} has to be called before
    // {@link goog.ui.Component#exitDocument}, otherwise it has no effect.
    this.setHighlightedIndex(-1);

    if (this.openItem_) {
      this.openItem_.setOpen(false);
    }

    this.mouseButtonPressed_ = false;
    
    /**
     * goog.ui.Component#exitDocument does the following, in order:
     * 1. Propagate exitDocument to child components that have been rendered, if any.
     * 2. Removes all event handlers from the goog.events.EventHandler object returned by this.getHandler().
     */
    cmvc.ui.View.superClass_.exitDocument.call(this);
    
    if (this.keyHandler_) {
      this.keyHandler_.detach();
    }
    
    if (this.isVisible() && this.isEnabled()) {
      this.setFocusable(false);
    }
  },


  /** @inheritDoc */
  disposeInternal: function() {
    cmvc.ui.View.superClass_.disposeInternal.call(this);

    if (this.keyHandler_) {
      this.keyHandler_.dispose();
      this.keyHandler_ = null;
    }

    this.childElementIdMap_ = null;
    this.openItem_ = null;
    this.renderer_ = null;
  },


  /*********************************************************************************************/
  /*********************************** Default event handlers. *********************************/


  /**
   * Handles ENTER events raised by child controls when they are navigated to.
   * @param {goog.events.Event} e ENTER event to handle.
   * @return {boolean} Whether to prevent handleMouseOver from handling
   *    the event.
   */
  handleEnterItem: function(e) {
    // Allow the Control to highlight itself.
    return true;
  },


  /**
   * Handles HIGHLIGHT events dispatched by items in the container when they are highlighted.
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

      // Open follows highlight.
      if (this.openItem_ && item != this.openItem_) {
        if (item.isSupportedState(goog.ui.Component.State.OPENED)) {
          item.setOpen(true);
        } else {
          this.openItem_.setOpen(false);
        }
      }
    }
    goog.dom.a11y.setState(this.getElement(),
        goog.dom.a11y.State.ACTIVEDESCENDANT, e.target.getElement().id);
  },


  /**
   * Handles UNHIGHLIGHT events dispatched by items in the container when
   * they are unhighlighted.
   * @param {goog.events.Event} e Unhighlight event to handle.
   */
  handleUnHighlightItem: function(e) {
    if (e.target == this.getHighlighted()) {
      this.highlightedIndex_ = -1;
    }
    goog.dom.a11y.setState(this.getElement(),
         goog.dom.a11y.State.ACTIVEDESCENDANT, '');
  },


  /**
   * Handles OPEN events dispatched by items in the container when they are
   * opened.
   * @param {goog.events.Event} e Open event to handle.
   */
  handleOpenItem: function(e) {
    var item = /** @type {goog.ui.Control} */ (e.target);
    if (item && item != this.openItem_ && item.getParent() == this) {
      if (this.openItem_) {
        this.openItem_.setOpen(false);
      }
      this.openItem_ = item;
    }
  },


  /**
   * Handles CLOSE events dispatched by items in the container when they are
   * closed.
   * @param {goog.events.Event} e Close event to handle.
   */
  handleCloseItem: function(e) {
    if (e.target == this.openItem_) {
      this.openItem_ = null;
    }
  },


  /**
   * Handles mousedown events over the container.  The default implementation
   * sets the "mouse button pressed" flag and, if the container is focusable,
   * grabs keyboard focus.
   * @param {goog.events.BrowserEvent} e Mousedown event to handle.
   */
  handleMouseDown: function(e) {
    if (this.enabled_) {
      this.setMouseButtonPressed(true);
    }

    var keyTarget = this.getKeyEventTarget();
    if (this.renderer_.hasTabIndex(keyTarget)) {
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
   * Handles mouse events originating from nodes belonging to the controls hosted
   * in the container.  Locates the child control based on the DOM node that
   * dispatched the event, and forwards the event to the control for handling.
   * @param {goog.events.BrowserEvent} e Mouse event to handle.
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
   * Returns the child control that owns the given DOM node, or null if no such
   * control is found.
   * @param {Node} node DOM node whose owner is to be returned.
   * @return {goog.ui.Control?} Control hosted in the container to which the node
   *     belongs (if found).
   * @protected
   */
  getOwnerControl: function(node) {
    // Ensure that this container actually has child controls before
    // looking up the owner.
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
   * Handles focus events raised when the container's key event target receives
   * keyboard focus.
   * @param {goog.events.BrowserEvent} e Focus event to handle.
   */
  handleFocus: function(e) {
    // No-op in the base class.
  },


  /**
   * Handles blur events raised when the container's key event target loses
   * keyboard focus.  The default implementation clears the highlight index.
   * @param {goog.events.BrowserEvent} e Blur event to handle.
   */
  handleBlur: function(e) {
    this.setHighlightedIndex(-1);
    this.setMouseButtonPressed(false);
    // If the container loses focus, and one of its children is open, close it.
    if (this.openItem_) {
      this.openItem_.setOpen(false);
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
    if (this.isEnabled() && this.getChildCount() != 0 &&
        this.handleKeyEventInternal(e)) {
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
    // Give the highlighted control the chance to handle the key event.
    var highlighted = this.getHighlighted();
    if (highlighted && typeof highlighted.handleKeyEvent == 'function' &&
        highlighted.handleKeyEvent(e)) {
      return true;
    }

    // Give the open control the chance to handle the key event.
    if (this.openItem_ && this.openItem_ != highlighted &&
        typeof this.openItem_.handleKeyEvent == 'function' &&
        this.openItem_.handleKeyEvent(e)) {
      return true;
    }

    // Either nothing is highlighted, or the highlighted control didn't handle
    // the key event, so attempt to handle it here.
    switch (e.keyCode) {
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
        if (this.orientation_ == goog.ui.Container.Orientation.VERTICAL) {
          this.highlightPrevious();
        } else {
          return false;
        }
        break;

      case goog.events.KeyCodes.LEFT:
        if (this.orientation_ == goog.ui.Container.Orientation.HORIZONTAL) {
          if (this.isRightToLeft()) {
            this.highlightNext();
          } else {
            this.highlightPrevious();
          }
        } else {
          return false;
        }
        break;

      case goog.events.KeyCodes.DOWN:
        if (this.orientation_ == goog.ui.Container.Orientation.VERTICAL) {
          this.highlightNext();
        } else {
          return false;
        }
        break;

      case goog.events.KeyCodes.RIGHT:
        if (this.orientation_ == goog.ui.Container.Orientation.HORIZONTAL) {
          if (this.isRightToLeft()) {
            this.highlightPrevious();
          } else {
            this.highlightNext();
          }
        } else {
          return false;
        }
        break;

      default:
        return false;
    }

    return true;
  },


  /*********************************************************************************************/
  /************************************ Child component management. ****************************/


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
   * @param {goog.ui.Control} child The new child control.
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
   * @param {goog.ui.Control} control New child.
   * @param {number} index Index at which the new child is to be added.
   * @param {boolean} opt_render Whether the new child should be rendered
   *     immediately after being added (defaults to false).
   */
  addChildAt: function(control, index, opt_render) {
    // Make sure the child control dispatches HIGHLIGHT, UNHIGHLIGHT, OPEN, and
    // CLOSE events, and that it doesn't steal keyboard focus.
    control.setDispatchTransitionEvents(goog.ui.Component.State.HOVER, true);
    control.setDispatchTransitionEvents(goog.ui.Component.State.OPENED, true);
    if (this.isFocusable() || !this.isFocusableChildrenAllowed()) {
      control.setSupportedState(goog.ui.Component.State.FOCUSED, false);
    }

    // Disable mouse event handling by child controls.
    control.setHandleMouseEvents(false);

    // Let the superclass implementation do the work.
    cmvc.ui.View.superClass_.addChildAt.call(this, control, index,
        opt_render);

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
   * @param {string|goog.ui.Control} control The ID of the child to remove, or
   *     the control itself.
   * @param {boolean} opt_unrender Whether to call {@code exitDocument} on the
   *     removed control, and detach its DOM from the document (defaults to
   *     false).
   * @return {goog.ui.Control} The removed control, if any.
   */
  removeChild: function(control, opt_unrender) {
    // TODO: Fix implementation so that it works if control is a string.

    var index = this.indexOfChild(/** @type {goog.ui.Control} */ (control));
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

    control = /** @type {goog.ui.Control} */ (
        cmvc.ui.View.superClass_.removeChild.call(this, control,
            opt_unrender));

    // Re-enable mouse event handling (in case the control is reused elsewhere).
    control.setHandleMouseEvents(true);

    return control;
  },


  /*********************************************************************************************/
  /************************************** View state management. *******************************/


  /**
   * Returns the container's orientation.
   * @return {?goog.ui.Container.Orientation} Container orientation.
   */
  getOrientation: function() {
    return this.orientation_;
  },


  /**
   * Sets the container's orientation.
   * @param {goog.ui.Container.Orientation} orientation Container orientation.
   */
  // TODO: Do we need to support containers with dynamic orientation?
  setOrientation: function(orientation) {
    if (this.getElement()) {
      // Too late.
      throw Error(goog.ui.Component.Error.ALREADY_RENDERED);
    }

    this.orientation_ = orientation;
  },


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
      this.renderer_.setAllowTextSelection(element, allow);
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
    if (opt_force || (this.visible_ != visible && this.dispatchEvent(visible ?
        goog.ui.Component.EventType.SHOW : goog.ui.Component.EventType.HIDE))) {
      this.visible_ = visible;

      var elem = this.getElement();
      if (elem) {
        goog.style.showElement(elem, visible);
        if (this.isFocusable()) {
          // Enable keyboard access only for enabled & visible containers.
          this.renderer_.enableTabIndex(this.getKeyEventTarget(),
              this.enabled_ && this.visible_);
        }
        if (this.visible_ && !opt_force) {
          this.dispatchEvent(goog.ui.Container.EventType.AFTER_SHOW);
        }
      }

      return true;
    }

    return false;
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
    if (this.enabled_ != enable && this.dispatchEvent(enable ?
        goog.ui.Component.EventType.ENABLE :
        goog.ui.Component.EventType.DISABLE)) {
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
        this.setMouseButtonPressed(false);
      }

      if (this.isFocusable()) {
        // Enable keyboard access only for enabled & visible components.
        this.renderer_.enableTabIndex(this.getKeyEventTarget(),
            enable && this.visible_);
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
      this.renderer_.enableTabIndex(this.getKeyEventTarget(), focusable);
    }
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


  /*********************************************************************************************/
  /*********************************** Highlight management. ***********************************/


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
      var control = /** @type {goog.ui.Control} */ (this.getChildAt(curIndex));
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
  }
});

// Define two constants on the View "class"
cmvc.ui.View.EventHandlers.Parent = 1;
cmvc.ui.View.EventHandlers.Child = 2;