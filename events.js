goog.provide("cmvc.events");

goog.require("goog.object");
goog.require("goog.events");

goog.require("cmvc.ui.View.EventDispatch");

/**
 * Iterate over all pairs of event/function_reference pairs in the event_handlers object, attaching
 * each function_reference as an event listener for the corresponding event.
 *
 * IMPORTANT NOTE: Events with a handler of cmvc.ui.View.EventDispatch.Self/Parent/Child have additional requirements:
 *   If using cmvc.ui.View.EventDispatch.Self, thatObj.dispatchEvent() must be defined.
 *   If using cmvc.ui.View.EventDispatch.Parent, thatObj.getParent() and thatObj.dispatchEvent() must be defined.
 *   If using cmvc.ui.View.EventDispatch.Child, thatObj.dispatchEventToChild() must be defined.
 * 
 * Example:
 * cmvc.events.attachEventHandlers(thatObj, {
 *   'click': function(e) { alert(); },
 *   'mouseover': "myapp.application.mouseOverHandler",
 *   'mouseout': 'mouseOutHandler',
 *   'someOtherEvent': cmvc.ui.View.EventDispatch.Self,
 *   'anotherEvent': cmvc.ui.View.EventDispatch.Parent,
 *   'yetAnotherEvent': cmvc.ui.View.EventDispatch.Child
 * });
 */
cmvc.events.attachEventHandlers = function(eventTarget, events) {
  var fn = null,
      context = null,
      hasGetHandlerMethod = goog.isFunction(eventTarget.getHandler);
  
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
          case cmvc.ui.View.EventDispatch.Self:
            context = eventTarget;
            fn = context.dispatchEvent;     // the context object (a goog.ui.Component) ought to have a dispatchEvent() method
            break;
            
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
    
    if(hasGetHandlerMethod) {
      eventTarget.getHandler().listen(eventTarget, evt, fn, false, context);
    } else {
      goog.events.listen(eventTarget, evt, fn, false, context);
    }
  });
};