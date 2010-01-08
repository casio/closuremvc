goog.provide("cmvc.ui.ExtView");
goog.provide("cmvc.ui.ExtButtonView");
goog.provide("cmvc.ui.ExtSelectView");

goog.require("goog.array");
goog.require("goog.object");

goog.require("cmvc");
goog.require("cmvc.ui.View");

cmvc.ui.ExtView = cmvc.ui.View.extend({
  defaultExtComponentConfig: { },
  
  constructor: function(opt_domHelper, config) {
    cmvc.ui.ExtView.superClass_.constructor.apply(this, arguments);
    
    this.extComponentConfig = { };
    
    goog.object.extend(this.extComponentConfig, this.defaultExtComponentConfig);
    goog.object.extend(this.extComponentConfig, config);
  },
  
  getControl: function() {
    return this.extComponent;
  },
  
  enterDocument: function() {
    cmvc.ui.ExtView.superClass_.enterDocument.apply(this, arguments);
    
    this.extComponent = new this.extComponentClass(this.extComponentConfig);
    this.extComponent.render(this.getElement());
  },
  
  // Do Ext control cleanup before continuing the View's cleanup
  exitDocument: function() {
    if(this.extComponent) {
      this.extComponent.destroy();
    }
    
    cmvc.ui.ExtView.superClass_.exitDocument.apply(this, arguments);
  },
  
  /**
   * Iterate over the events referenced in the domEvents array and for each event attach an event handler to the
   * root element that will simply fire the same event on the View object.
   */
  attachDeclaredDomEventHandlers: function(domEvents) {
    domEvents = domEvents || this.getDomEvents() || [];
    
    // create the initial event handlers
    if(this.extComponent) {
      goog.array.forEach(domEvents, function(e, i, a) {   // e is the event name (e.g. 'click')
        this.extComponent.on(e, function(extEventObject, t) {
          goog.events.dispatchEvent(this, extEventObject);
        }, this);
      }, this);
    }
  }
});

cmvc.ui.ExtButtonView = cmvc.ui.ExtView.extend({
  root: { tag: 'span', id: "{id}" },
  
  extComponentClass: Ext.Button,
  
  defaultExtComponentConfig: {
    text: 'Click'
  },
  
  constructor: function(opt_domHelper, config) {
    cmvc.ui.ExtButtonView.superClass_.constructor.apply(this, arguments);
    
    this.extComponentConfig.text = this.text || this.extComponentConfig.text || "Click Here";
  }
});

cmvc.ui.ExtSelectView = cmvc.ui.ExtView.extend({
  root: { tag: 'span', id: "{id}" },
  
  extComponentClass: Ext.form.ComboBox,
  
  defaultExtComponentConfig: {
    displayField: 'text',
    valueField: 'value',
    typeAhead: true,
    mode: 'local',
    forceSelection: true,
    triggerAction: 'all',
    emptyText: 'Select a value...',
    selectOnFocus: true
  },
  
  constructor: function(opt_domHelper, config) {
    cmvc.ui.ExtSelectView.superClass_.constructor.apply(this, arguments);
    
    if(this.extComponentConfig.store) {
      if(typeof this.extComponentConfig.store == 'string') {
        this.extComponentConfig.store = eval(this.extComponentConfig.store);
      }
    } else {
      // simple array store
      this.store = new Ext.data.ArrayStore({
          fields: ['id', 'value', 'text'],
          data: this.data
      });
      this.extComponentConfig.store = this.store;
    }
  }
});
