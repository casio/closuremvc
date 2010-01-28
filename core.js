goog.provide("cmvc");

goog.require("goog.array");
goog.require("goog.object");

goog.require("cmvc.object");

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
 * Given an object and and callback function, this function performs an ancestor-to-child traversal
 * of the "class"/prototype hierarchy. At each level in the hierarchy the callbackFn function is invoked with a single
 * argument: the prototype at the level currently being visited.
 */
cmvc.traversePrototypeTree = function(child, callbackFn, contextObj) {
  // if child has a superClass_ property, then it is a constructor function (a "class"), otherwise it is an instance of a "class" (an object)
  var klass = child.superClass_ ? child : child.constructor;
  
  var lastPrototype = klass.prototype,
      stack = [lastPrototype],
      t;
  
  // Build a stack containing the prototype objects that make up the prototype hierarchy
  // The bottom of the stack contains the "youngest" prototype
  // The top of the stack contains the "oldest" ancestor prototype
  while(klass.superClass_) {
    t = klass.superClass_;
    if (t !== lastPrototype) {
      stack.push(t);
      lastPrototype = t;
    }
    klass = t.constructor;
  }
  
  // Iterate over each element in the stack, visiting each prototype in order from top to bottom of the stack.
  while(t = stack.pop()) {    // <-- assignment (i.e. = ) is intended, not equality comparison (i.e. == )
    callbackFn.call(contextObj, t);
  }
};


/**
 * Traverse the property hierarchy in order of oldest ancestor property to child property.
 *
 * @param {Function} callbackFn should have one argument: the object mapped to
 *                              the property (i.e. the property name stored in the 'property' argument)
 */
cmvc.traverseUniquePropertyTree = function(childObj, property, callbackFn, contextObj) {
  var lastObj, currObj;
  cmvc.traversePrototypeTree(childObj, function(proto) {
    currObj = proto[property];
    if (currObj !== lastObj) {
      callbackFn.call(contextObj, currObj);
      lastObj = currObj;
    }
  });
};


cmvc.buildPropertyHistory = function(childObj, property) {
  var history = [];     // ordered from oldest ancestor property to child property
  
  cmvc.traverseUniquePropertyTree(childObj, property, function(obj) {
    history.push(obj);
  });
  
  return history;
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
 * @param {Function|object} me - the object referenced by "this"
 * @param {String} property - the name of the property that we want to merge from all the ancestors in the class hierarchy of "me"
 * @param {Numeric} mode is 1 to indicate overwrite mode, 2 to indicate merge mode, and 3 to indicate append mode; defaults to 2.
 */
cmvc.inheritProperty = function(me, property, mode) {
  var retval;
  var propHistory = cmvc.buildPropertyHistory(me, property);
  var t = goog.typeOf(retval);
  
  mode = mode || 2;
  
  goog.array.forEach(propHistory, function(e, i, a) {
    if (t === goog.typeOf(e)) {
      switch(t) {
        case "object":              // object/map/hash
          if (mode == 1) {          // overwrite
            retval = goog.cloneObject(e);
          } else if (mode == 2) {   // merge - some key/value overwrites may occur
            goog.object.extend(retval, e);
          } else if (mode == 3) {   // append - no key/value overwrites will occur
            cmvc.object.append(retval, e);
          }
          break;
        case "array":               // array
          if (mode == 1) {          // overwrite
            retval = goog.cloneObject(e);
          } else if (mode == 2) {   // merge
            retval = retval.concat(e);      // TODO: want to change this so that some overwrites may occur?
          } else if (mode == 3) {   // append
            retval = retval.concat(e);
          }
          break;
        default:                // primitive - simply overwrite in every case
          retval = goog.cloneObject(e);
      }
    } else {
      retval = goog.cloneObject(e);
      t = goog.typeOf(retval);
    }
  });

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


/**
 * This is a convenience function that simply calls goog.ui.IdGenerator.getInstance().getNextUniqueId().
 */
cmvc.getId = function() {
  return goog.ui.IdGenerator.getInstance().getNextUniqueId();
}