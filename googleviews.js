goog.provide("cmvc.ui.GoogleView");
goog.provide("cmvc.ui.GoogleSelect");
goog.provide("cmvc.ui.GoogleButton");

goog.require("goog.array");
goog.require("goog.events");
goog.require("goog.object");
//goog.require("goog.ui.Button");
goog.require("goog.ui.CustomButton");
goog.require("goog.ui.Select");
goog.require("goog.ui.MenuItem");

goog.require("cmvc");
goog.require("cmvc.ui.View");

cmvc.ui.GoogleView = cmvc.ui.View.extend({
  constructor: function(opt_domHelper) {
    cmvc.ui.GoogleView.superClass_.constructor.apply(this, arguments);
    
    this.setFocusableChildrenAllowed(true);
  },
  
  getControl: function() {
    return this.googleComponent;
  },
  
  enterDocument: function() {
    this.googleComponent = cmvc.construct(this.googleComponentClass, this.googleComponentArgs);
    
    this.addChild(this.googleComponent, false);
    
    // call View#enterDocument to render child views
    cmvc.ui.GoogleView.superClass_.enterDocument.apply(this, arguments);
  },
  
  // Remove all references to the googleComponent so that the superclass can perform cleanup of child elements.
  exitDocument: function() {
    goog.events.removeAll(this.googleComponent);

    this.googleComponent = null;
    
    cmvc.ui.GoogleView.superClass_.exitDocument.apply(this, arguments);
  },
  
  /**
   * Iterate over the events referenced in the domEvents array and for each event attach an event handler to the
   * root element that will simply fire the same event on the View object.
   */
  attachDeclaredDomEventHandlers: function(domEvents) {
    domEvents = domEvents || this.getDomEvents() || [];
    
    // create the initial event handlers
    if(this.googleComponent) {
      goog.array.forEach(domEvents, function(e, i, a) {   // e is the event name (e.g. 'click')
        goog.events.listen(this.googleComponent, e, goog.partial(goog.events.dispatchEvent, this), false, this);
      }, this);
    }
  }
});

cmvc.ui.GoogleSelect = cmvc.ui.GoogleView.extend({
  root: { tag: 'span', id: '{id}' },
  store: [],
  
  googleComponentClass: goog.ui.Select,
  //googleComponentArgs: [arg1, arg2, arg3, ..., argN],
  
  domEvents: [goog.ui.Component.EventType.ACTION],
  
  constructor: function(opt_domHelper, store) {
    cmvc.ui.GoogleSelect.superClass_.constructor.apply(this, arguments);
    
    this.store_ = store || eval(cmvc.inheritProperty(this, "store")) || [];
  },
  
  postRender: function() {
    cmvc.ui.GoogleSelect.superClass_.postRender.apply(this, arguments);
    
    this.load();
  },
  
  load: function() {
    // this assumes that each element in the store array is an array of the form [id, value, text]
    goog.array.forEach(this.store_, function(e, i, a) {
      this.googleComponent.addItem(new goog.ui.MenuItem(e[2]));
    }, this);
  }
});

cmvc.ui.GoogleButton = cmvc.ui.GoogleView.extend({
  root: { tag: 'span', id: '{id}' },
  
  googleComponentClass: goog.ui.CustomButton,
  
  domEvents: [goog.ui.Component.EventType.ACTION]
});