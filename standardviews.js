goog.provide("cmvc.ui.LabelView");
goog.provide("cmvc.ui.ButtonView");
goog.provide("cmvc.ui.InlineTextInputCursorView");
goog.provide("cmvc.ui.InlineTextInputView");
goog.provide("cmvc.ui.TextboxView");

goog.require("cmvc");
goog.require("cmvc.Template");
goog.require("cmvc.ui.View");

cmvc.ui.LabelView = cmvc.ui.View.extend({
  text: "",
  root: { tag: 'span', html: '{_content}', id: '{id}' },
  
  constructor: function(opt_orientation, opt_renderer, opt_domHelper) {
    cmvc.ui.LabelView.superClass_.constructor.apply(this, arguments);
  },
  
  applyTextTemplate: function() {
    // Use this.text as the template string
    this.textTemplate = new cmvc.Template(this.text || "");
    this._content = this.textTemplate.applyTemplate(this);
  },
  
  preRender: function() {
    this.applyTextTemplate();
  },
  
  updateText: function() {
    this.applyTextTemplate();
    this.getElement().innerHTML = this._content;
  }  /*,
  
  onPropertySet: function(property, index, value) {
    value = arguments.length == 2 ? index : value;
    
    switch(property) {
      case "text":
        this.updateText();
        break;
      case "textParams":
        this.updateText();
        break;
    }
  }
  */
});

cmvc.ui.ButtonView = cmvc.ui.LabelView.extend({
  root: { tag: 'a', href: 'javascript:void(null);', html: '{_content}' },
  domEvents: ['click']
});

cmvc.ui.InlineTextInputCursorView = cmvc.ui.View.extend({
  root: {
    tag: 'span',
    cls: 'cursor',
    html: '&nbsp;'
  },
  
  constructor: function(config) {
    cmvc.ui.InlineTextInputCursorView.superClass_.constructor.apply(this, arguments);
    
    this.blinkTask = { id: Ext.id(), run: this.toggleVisibility, interval: 500, scope: this };
  },
  
  destroy: function() {
    cmvc.ui.InlineTextInputCursorView.superClass_.destroy.apply(this, arguments);
    
    this.stopBlinking();
  },
  
  postRender: function() {
    cmvc.ui.InlineTextInputCursorView.superClass_.postRender.apply(this, arguments);
    
    this.el.setVisibilityMode(Ext.Element.VISIBILITY);    // this causes this.el.hide()/show()/toggle() to modify "visibility" CSS property instead of "display" property
    this.maximizeHeight();
    this.startBlinking();
  },
  
  // resize the height of all InlineTextInputCursorView view to match the height of the containing InlineTextInputView element
  maximizeHeight: function() {
    if(this.parentView && this.parentView.el && this.parentView.el instanceof Ext.Element) {
      var parent_box = this.parentView.el.getBox(true);     // get the content box
      this.el.setHeight(parent_box.height);
      //this.el.setY(parent_box.y);
    }
  },
  
  toggleVisibility: function() {
    if(this.rendered) {
      this.el.toggle();
    }
  },
  
  startBlinking: function() {
    Ext.TaskMgr.start(this.blinkTask);
  },
  
  stopBlinking: function() {
    Ext.TaskMgr.stop(this.blinkTask);
  }
});

cmvc.ui.InlineTextInputView = cmvc.ui.View.extend({
  root: {
    tag: 'span', 
    id: '{id}', 
    cls: 'inline_text_input', 
    html: "{text}",
    tabindex: -1
  },
  
  text: "",
  charArray: [],
  cursor: null,
  cursorIndex: 0,
  
  constructor: function(config) {
    cmvc.ui.InlineTextInputView.superClass_.constructor.apply(this, arguments);
    
    this.cursor = cmvc.ui.InlineTextInputCursorView.create({parentView: this});
    
    this.charArray = this.text.split('');
  },
  
  attachEventHandlers: function() {
    cmvc.ui.InlineTextInputView.superClass_.attachEventHandlers.apply(this, arguments);
    
    this.el.on("click", this.onClick, this);
    this.el.on("focus", this.onFocus, this);
    this.el.on("keypress", this.onKeyPress, this, { stopEvent: true });
    this.el.on("keydown", this.onKeyDown, this);
  },
  
  postRender: function() {
    this.appendItem(this.cursor);
    this.cursorIndex = this.item_views.length - 1;
  },
  
  onClick: function(e, t) { },
  
  onFocus: function(e, t) { console.log('text input received focus'); },
  
  refreshText: function() {
    this.text = this.charArray.join('');
    this.el.update(this.text);
  },
  
  /*
   * keydown and keypress seemed to fire on different keys.
   * keypress wouldn't fire on Delete or the Arrow keys, but keydown would.
   * keydown wouldn't fire on Left Paren (i.e. shift+9 ; also keycode 40), but keypress would.
   */
  onKeyDown: function(e, t) {
    // key codes: http://www.quirksmode.org/js/keys.html
    var kc = e.getKey();      // keycode - kc
    var key = String.fromCharCode(kc);
    switch(kc) {
      case 46:
        console.log("[Delete]");
        this.refreshText();
        break;
      case 37:
        console.log("[Left]");
        this.refreshText();
        break;
      case 39:
        console.log("[Right]");
        this.refreshText();
        break;
    }
  },
  
  /*
   * keydown and keypress seemed to fire on different keys.
   * keypress wouldn't fire on Delete or the Arrow keys, but keydown would.
   * keydown wouldn't fire on Left Paren (i.e. shift+9 ; also keycode 40), but keypress would.
   */
  onKeyPress: function(e, t) {
    // key codes: http://www.quirksmode.org/js/keys.html
    var kc = e.getKey();
    var key = String.fromCharCode(kc);
    switch(kc) {
      case 10:
      case 13:
        console.log("[Enter/Return]");
        break;
      case 8:
        console.log("[Backspace]");
        if(this.cursorIndex > 0) {
          this.cursorIndex--;
          this.charArray.splice(this.cursorIndex, 1);
        }
        break;
      case 33:
        console.log("Bang! (" + key + ")");
        break;
      case 40:
        console.log("[LParen]");
        break;
      case 41:
        console.log("[RParen]");
        break;
      case 42:
        console.log("[Multiply (" + key + ")]");
        break;
      case 43:
        console.log("[Add]");
        break;
      case 45:
        console.log("[Subtract]");
        break;
      case 47:
        console.log('[Divide]');
        break;
      case 60:
        console.log("[LT]");
        break;
      case 61:
        console.log("[EQ]");
        break;
      case 62:
        console.log("[GT]");
        break;
      default:
        if((97 <= kc && kc <= 122) ||     // lowercase letters: a-z
           (48 <= kc && kc <= 57)) {      // numbers: 0-9
          console.log("key: " + key + "(" + kc + ")");
          this.charArray.splice(this.cursorIndex, 0, key);
          this.cursorIndex++;
        }
    }
    this.refreshText();
  }
});

cmvc.ui.TextboxView = cmvc.ui.View.extend({
  root: { tag: 'input', type: 'text', id: '{id}' }
});
