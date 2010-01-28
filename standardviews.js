goog.provide("cmvc.ui.LabelView");
goog.provide("cmvc.ui.ButtonView");
goog.provide("cmvc.ui.InlineTextInputCursorView");
goog.provide("cmvc.ui.InlineTextInputView");

goog.require("goog.dom");
goog.require("goog.dom.classes");
goog.require("goog.ui.Component");
goog.require("goog.ui.Component.EventType");
goog.require("goog.events.KeyCodes");

goog.require("cmvc");
goog.require("cmvc.array");
goog.require("cmvc.Template");
goog.require("cmvc.ui.View");
goog.require("cmvc.ui.View.EventDispatch");


cmvc.ui.LabelView = cmvc.ui.View.extend({
  text: "",
  root: { tag: 'span', html: '{content_}', id: '{id}' },
  
  constructor: function(opt_orientation, opt_renderer, opt_domHelper) {
    cmvc.ui.LabelView.superClass_.constructor.apply(this, arguments);
  },
  
  applyTextTemplate: function() {
    // Use this.text as the template string
    this.textTemplate = new cmvc.Template(this.text || "");
    this.content_ = this.textTemplate.applyTemplate(this);
  },
  
  preRender: function() {
    this.applyTextTemplate();
  },
  
  updateText: function() {
    this.applyTextTemplate();
    this.getElement().innerHTML = this.content_;
  },
  
  handlePropertySet: function(property, index, value) {
    value = arguments.length == 2 ? index : value;
    
    this.updateText();
  }
});


cmvc.ui.ButtonView = cmvc.ui.LabelView.extend({
  root: { tag: 'a', href: 'javascript:void(null);', html: '{content_}' },
  
  domEvents: {
    'click': 'this.dispatchEvent'
  },
  
  viewEvents: {
    'enter': 'this.handleEnter',
    'leave': 'this.handleLeave'
  },
  
  focusable_: true,
  hoverClass: null,
  activeClass: null,
  
  constructor: function(opt_orientation, opt_renderer, opt_domHelper) {
    cmvc.ui.ButtonView.superClass_.constructor.apply(this, arguments);
  },
  
  handleEnter: function(e) {
    if(this.hoverClass) {
      goog.dom.classes.enable(this.getElement(), this.hoverClass, true);
    }
  },
  
  handleLeave: function(e) {
    if(this.hoverClass) {
      goog.dom.classes.enable(this.getElement(), this.hoverClass, false);
    }
  }
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
  text: "",
  charArray: [],
  cursor: null,
  cursorIndex: 0,

  root: {
    tag: 'span', 
    id: '{id}', 
    cls: 'inline_text_input', 
    html: "{text}",
    tabindex: -1
  },
  
  domEvents: {
    'focus': 'this.onFocus'
  },
  
  keyEvents: {
    'key': 'this.onKeyPress'
  },
  
  focusable_: true,
  
  constructor: function(config) {
    cmvc.ui.InlineTextInputView.superClass_.constructor.apply(this, arguments);
    
    //this.cursor = new cmvc.ui.InlineTextInputCursorView();
    
    this.charArray = this.text.split('');
  },
  
  disposeInternal: function() {
    //this.cursor.dispose();
    
    cmvc.ui.InlineTextInputView.superClass_.disposeInternal.call(this);
  },
  
  postRender: function() {
    cmvc.ui.InlineTextInputView.superClass_.postRender.apply(this, arguments);
    
    //this.addChild(this.cursor, true);                   // render the cursor
    
    this.cursorIndex = this.children_ ? this.children_.length - 1 : 0;
  },
  
  onFocus: function(e) { console.log('text input received focus'); },
  
  refreshText: function() {
    var pair = cmvc.array.split(this.charArray, this.cursorIndex),
        left = pair[0],
        right = pair[1];
    
    //this.text = this.charArray.join('');
    this.text = left.join('') + '|' + right.join('');
        
    //console.log("text = ", left.join('') + '|' + right.join(''));
    goog.dom.setTextContent(this.element_, this.text);
  },
  
  /**
   * keydown and keypress seemed to fire on different keys.
   * keypress wouldn't fire on Delete or the Arrow keys, but keydown would.
   * keydown wouldn't fire on Left Paren (i.e. shift+9 ; also keycode 40), but keypress would.
   */
  onKeyPress: function(e) {
    // key codes: http://www.quirksmode.org/js/keys.html
    var cc = e.charCode,
        kc = e.keyCode;
    console.log(cc, kc);
    if (cc > 0) {           // we have a valid charCode; no need to use keyCode
      var key = String.fromCharCode(cc);
      switch(cc) {
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
          if((97 <= cc && cc <= 122) ||     // lowercase letters: a-z
             (65 <= cc && cc <= 90) ||      // uppercase letters: A-Z
             (48 <= cc && cc <= 57)) {      // numbers: 0-9
            console.log("key: " + key + "(" + cc + ")");
            this.charArray.splice(this.cursorIndex, 0, key);
            this.cursorIndex++;
          }
      }
    } else {            // we don't have a valid charCode, so we deal with the keyCode
      switch(kc) {
        case goog.events.KeyCodes.BACKSPACE:
          console.log("[Backspace]");
          if(this.cursorIndex > 0) {
            this.cursorIndex--;
            this.charArray.splice(this.cursorIndex, 1);
          }
          break;
        case goog.events.KeyCodes.ENTER:
          console.log("[Enter/Return]");
          break;
        case goog.events.KeyCodes.DELETE:
          console.log("[Delete]");
          if (this.charArray.length > 0 && this.cursorIndex < this.charArray.length) {
            this.charArray.splice(this.cursorIndex, 1);
          }
          break;
        case goog.events.KeyCodes.LEFT:
          console.log("[Left]");
          if (this.cursorIndex > 0) {
            this.cursorIndex--;
          }
          break;
        case goog.events.KeyCodes.RIGHT:
          console.log("[Right]");
          if (this.cursorIndex < this.charArray.length) {
            this.cursorIndex++;
          }
          break;
      }
    }
    this.refreshText();
  }
});