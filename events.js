goog.provide("cmvc.events");

goog.require("goog.object");
goog.require("goog.events");

goog.require("cmvc.ui.View.EventDispatch");

/**
 * Iterate over all pairs of event/function_reference and event/array_of_function_references pairs 
 * in the event_handlers object, attaching each function_reference as an event listener for the corresponding event.
 * 
 * IMPORTANT NOTE: Events with a handler of cmvc.ui.View.EventDispatch.Parent/Child have additional requirements:
 *   If using cmvc.ui.View.EventDispatch.Parent, eventTarget.getParent() and thatObj.dispatchEvent() must be defined.
 *   If using cmvc.ui.View.EventDispatch.Child, eventTarget.dispatchEventToChild() must be defined.
 * 
 * @param {Function} attachListenerFn should have a function signature of:
 *   function(src, type, listener, opt_capt, opt_handler) -> {?number}
 *   where:
 *     @param {EventTarget|goog.events.EventTarget} src The node to listen to
 *       events on.
 *     @param {string|Array.<string>} type Event type or array of event types.
 *     @param {Function|Object} listener Callback method, or an object with a
 *       handleEvent function.
 *     @param {boolean=} opt_capt Whether to fire in capture phase (defaults to
 *       false).
 *     @param {Object=} opt_handler Element in whose scope to call the listener.
 *     @return {?number} Unique key for the listener.
 * 
 * Usage:
 *   2 arguments: cmvc.events.attachEventHandlers(eventTarget, events);
 *   3 argumnets: cmvc.events.attachEventHandlers(eventTarget, events, opt_context);
 *   4 arguments: cmvc.events.attachEventHandlers(eventTarget, events, opt_capture, opt_context);
 *   5 arguments: cmvc.events.attachEventHandlers(eventTarget, events, opt_capture, attachListenerFn, opt_context);
 *   6 arguments: cmvc.events.attachEventHandlers(eventTarget, events, opt_capture, attachListenerFn, attachListenerFnContext, opt_context);
 * 
 * Example:
 *   cmvc.events.attachEventHandlers(thatObj, {
 *     'click': function(e) { alert(); },
 *     'mouseover': "myapp.application.mouseOverHandler",
 *     'mouseout': 'mouseOutHandler',
 *     'someOtherEvent': 'this.dispatchEvent',
 *     'anotherEvent': cmvc.ui.View.EventDispatch.Parent,
 *     'yetAnotherEvent': cmvc.ui.View.EventDispatch.Child,
 *     'enter': [function(e) { alert('Welcome!'); },
 *               function(e) { alert('... and enter!'); } ]
 *   });
 */
cmvc.events.attachEventHandlers = function(eventTarget, events, opt_capture, attachListenerFn, attachListenerFnContext, opt_context) {
  if (arguments.length == 3) {
    opt_context = opt_capture;
    opt_capture = undefined;
  } else if (arguments.length == 4) {
    opt_context = attachListenerFn;
    attachListenerFn = undefined;
  } else if (arguments.length == 5) {
    opt_context = attachListenerFnContext;
    attachListenerFnContext = undefined;
  }
  
  var fn = null,
      context = null,
      hasGetHandlerMethod = goog.isFunction(eventTarget.getHandler);
      
  opt_capture = opt_capture || false;
  attachListenerFn = attachListenerFn || (hasGetHandlerMethod ? eventTarget.getHandler().listen : goog.events.listen);
  attachListenerFnContext = attachListenerFnContext || (hasGetHandlerMethod ? eventTarget.getHandler() : opt_context);
  
  goog.object.forEach(events, function(handler, evt, o) {     // element, index, object
    switch(goog.typeOf(handler)) {
      case "function":    // the event handler is a function object that accepts a single event object argument
        fn = handler;
        context = eventTarget;
        break;
      case "string":      // the event handler is a "dotted" reference to a user defined function
        var i = handler.lastIndexOf('.');
        if(i >= 0) {
          // we found a "." in the string, so the text to the left of the "." is a reference to the context object
          context = eval(handler.substring(0, i));
          fn = eval(handler);
        } else {
          // we didn't find any "." in the string, so eventTarget is the context object
          context = eventTarget;
          fn = context[handler];
        }
        break;
      case "number":      // the event handler is a reference to a specific built-in behavior
        switch(handler) {
          case cmvc.ui.View.EventDispatch.Parent:
            context = eventTarget.getParent();
            fn = context.dispatchEvent;     // the context object (a goog.ui.Component) ought to have a dispatchEvent() method
            break;
          
          case cmvc.ui.View.EventDispatch.Child:
            context = eventTarget;
            fn = context.dispatchEventToChild;
            break;
            
          default:
            throw Error("Unable to attach event handler to the view. Unknown event handler reference.");
        }
        break;
      default:
        throw Error("Unable to attach event handler to the view. Unknown event handler type.");
    }
    
    // attachListenerFn.call(thisObj, src, type, listener, opt_capt, opt_handler);
    attachListenerFn.call(attachListenerFnContext, eventTarget, evt, fn, opt_capture, context);
  }, opt_context);
};