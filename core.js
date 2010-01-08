goog.provide("cmvc");

goog.require("goog.array");
goog.require("goog.object");

/*
 *  Function signature:
 *    1. extend(klass, prototypeMembers)
 *  
 *  Parameters:
 *    parentConstructor - Function - the parent Constructor
 *    prototypeMembers - Object - a map with members that need to be placed into the child class's prototype
 *
 *  Usage:
 *    var G = cmvc.extend(Object, {
 *              constructor: function(message) { this.greeting = message; },
 *              sayHi: function() { alert(this.greeting); }
 *            });
 *    var g = new G("Hello!");
 *    g.sayHi();    // alert box appears with the text "Hello!"
 */
cmvc.extend = function(parentConstructor, prototypeMembers) {
  // Note: the prototypeMembers object (an Object literal), by default has a constructor property that is set 
  //   to Object (because an object literal is an instance of Object, and therefore has whatever properties are held
  //   in Object.prototype, one of which is Object.prototype.constructor === Object)
  // If no explicit constructor function has been given in prototypeMembers, then
  //   create a new temporary child constructor function that calls it's superclass constructor
  // Disclaimer: this line is a near exact duplicate of one taken from the Ext Core 3 library's definition of Ext.extend()
  var childConstructor = prototypeMembers.constructor !== Object ? prototypeMembers.constructor : function() { parentConstructor.apply(this, arguments); };
  
  // set up the prototype chain
  goog.inherits(childConstructor, parentConstructor);
  
  // at this point, childConstructor.prototype.constructor === childConstructor, so the following
  //   line isn't needed since goog.object.extend() (in the call below) uses for(a in b) to copy properties and according to
  //   the javascript documentation (https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Statements/for...in):
  //   "A for...in loop does not iterate over built-in properties. 
  //    These include all built-in methods of objects, such as String's indexOf method or Object's toString method. 
  //    However, the loop will iterate over all user-defined properties (including any which overwrite built-in properties)."
  //prototypeMembers.constructor = childConstructor;
  
  // apply the reminaing properties from prototypeMembers to the childConstructor.prototype
  goog.object.extend(childConstructor.prototype, prototypeMembers);
  
  // add an extend singleton method onto the childConstructor so we can do stuff like this (where C is a constructor):
  //   var D = C.extend(<instanceMembers>, <prototypeMembers>);
  childConstructor.extend = goog.partial(cmvc.extend, childConstructor);
  
  return childConstructor;
};

/**
 * Builds up an inherited property.
 * 
 * var C = cmvc.extend(Object, {
 *   viewEvents: {a: 1, b: 2}
 * });
 * var D = C.extend({
 *   viewEvents: {c: 3, d: 4}
 * });
 * var d = new D();
 * var p = cmvc.inheritProperty(d, 'viewEvents');
 * // At this point, p = {a: 1, b: 2, c: 3, d: 4}
 * 
 * Parameters:
 * me - the object referenced by "this"
 * property - the name of the property that we want to merge from all the ancestors in the class hierarchy of "me"
 */
cmvc.inheritProperty = function(me, property) {
  var lastObj = me[property];
  var stack = [lastObj];
  var retval;
  var obj;
  var t;
  
  // Build a stack containing the objects referenced by "property" in the class hierarchy.
  // The bottom of the stack contains the object referenced by me[property]
  // The top of the stack contains the object referenced by oldestAncestorClass.prototype[property]
  var klass = me.constructor;
  while(klass.superClass_) {
    t = klass.prototype[property];
    if(lastObj !== t) {
      stack.push(t);
      lastObj = t;
    }
    klass = klass.superClass_.constructor;
  }
  
  // Iterate over each element in the stack, merging each element with retval, in order from top to bottom of the stack.
  retval = goog.cloneObject(stack.pop());
  t = goog.typeOf(retval);
  while(obj = stack.pop()) {    // <-- assignment (i.e. = ) is intended, not equality comparison (i.e. == )
    if(t === goog.typeOf(obj)) {
      switch(t) {
        case "object":    // object/map/hash - merge objects
          goog.object.extend(retval, obj);
          break;
        case "array":     // array - simply overwrite
          retval = goog.cloneObject(obj);
          break;
        default:          // primitive - simply overwrite
          retval = goog.cloneObject(obj);
      }
    } else {
      retval = goog.cloneObject(obj);
      t = goog.typeOf(retval);
    }
  }
  
  return retval;
};

/**
 *  This implementation of construct found at:
 *  http://groups.google.com/group/comp.lang.javascript/msg/ae35286efaf132f2
 */
cmvc.construct = function(constructorFn, args) {
  args = args || [];
  var createNewObject = "new constructorFn(" 
    + goog.array.map(args, function(e, i, a) { return "args[" + i + "]"; }, this)
    + ");"
  //console.log(createNewObject);
  return eval(createNewObject);
};