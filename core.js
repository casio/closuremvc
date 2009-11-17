goog.provide("cmvc");

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
// cmvc.extend = function(parentConstructor /*, instanceMembers, prototypeMembers */) {
//   var instanceMembers, prototypeMembers;
//   
//   if(arguments.length == 2) {
//     instanceMembers = {};
//     prototypeMembers = arguments[1];
//   } else if(arguments.length == 3) {
//     instanceMembers = arguments[1];
//     prototypeMembers = arguments[2];
//   }
  
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