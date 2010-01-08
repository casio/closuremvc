goog.provide("cmvc.kvo");

goog.require("goog.array");


/**
 * observerTree[objectReference][property] = Array.<Function>
 */
cmvc.kvo.observerTree_ = {};


/**
 * All property observer callback functions (read: the callbackFn parameter) must have a function signature of:
 *   function(fnName, [index,] value1, value2, ..., valueN)
 *
 * Usage:
 *   cmvc.kvo.observeProperty(obj, "propertyA", function(fnName, [index,] value1, ..., valueN){ })
 */
cmvc.kvo.observeProperty = function(srcObj, srcProperty, callbackFn) {
  if(!goog.isObject(cmvc.kvo.observerTree_[srcObj])) {
    cmvc.kvo.observerTree_[srcObj] = {};
  }
  if(goog.isArray(cmvc.kvo.observerTree_[srcObj][srcProperty])) {
    cmvc.kvo.observerTree_[srcObj][srcProperty].push(callbackFn);
  } else {
    cmvc.kvo.observerTree_[srcObj][srcProperty] = [callbackFn];
  }
};


/**
 * Removes either:
 *   1. All property observers bound to any property of srcObj, as well as all references to srcObj
 *   OR
 *   2. The set of property observers bound to srcObj.srcProperty, as well as all references to the property.
 */
cmvc.kvo.removeObservers = function(srcObj, srcProperty) {
  if(arguments.length == 1) {
    if(cmvc.kvo.observerTree_[srcObj]) {
      delete cmvc.kvo.observerTree_[srcObj];
    }
  } else if(arguments.length == 2) {
    if(cmvc.kvo.observerTree_[srcObj] && cmvc.kvo.observerTree_[srcObj][srcProperty]) {
      delete cmvc.kvo.observerTree_[srcObj][srcProperty];
    }
  }
};


/**
 * Changes made to the source property are propagated to the target property.
 *
 * Usage:
 *   cmvc.kvo.bind(objA, "propertyA", objB, "propertyB");
 */
cmvc.kvo.bind = function(srcObj, srcProperty, targetObj, targetProperty) {
  cmvc.kvo.observeProperty(srcObj, srcProperty, function(modifierFnName /*, rest of the arguments */) {
    // convert the arguments into an array since it is only array-like
    var args = Array.prototype.slice.call(arguments);
    
    // shift the modifierFnName argument off of the front of the args array
    args.shift();
    
    // prepend the targetObj and targetProperty to the args array so that the args array holds:
    //   [targetObj, targetProperty, rest of the arguments]
    args.unshift(targetProperty);
    args.unshift(targetObj);
    
    // the following line translates into (for example): cmvc.kvo.set(targetObj, targetProperty, [index,] value1, ..., valueN)
    cmvc.kvo[modifierFnName].apply(targetObj, args);
  });
};


/**
 * Usage:
 *   cmvc.kvo.firePropertyObservers(srcObj, srcProperty, modifierFnName, [index,] value1, value2, ..., valueN)
 */
cmvc.kvo.firePropertyObservers = function(/* srcObj, srcProperty, modifierFnName, [index,] value1, value2, ..., valueN */) {
  var args = Array.prototype.slice.call(arguments);
  var srcObj = args.shift();        // shift off the first argument (srcObj)
  var srcProperty = args.shift();   // shift off the second argument (srcProperty)
  
  // The remaining args should be passed to each property observer callback function.
  
  // Iterate over and call each property observer callback, passing along any arguments passed to firePropertyObservers
  if(cmvc.kvo.observerTree_[srcObj] && cmvc.kvo.observerTree_[srcObj][srcProperty]) {
    goog.array.forEach(cmvc.kvo.observerTree_[srcObj][srcProperty], function(fn, i, a) {
      fn.apply(this, args);
    }, srcObj);
  }
};


/**
 * This method is applicable to primitive properties, array properties, or object properties.
 *
 * set(obj, property, value) - Set/Update a single primitive (not a collection) property.
 *   property - name of the property that was updated
 *   value - the value that the property is being set to
 *
 * set(obj, property, index, value) - Set/Update a member of a collection property (property references an array or object).
 *   property - name of the collection property
 *   index - integer index into OR named member field of the collection referenced by property
 *   value - the value that the member referenced by property[index] is being set to
 *
 * Usage:
 *   cmvc.kvo.set(obj, "propA", 5)
 *   cmvc.kvo.set(obj, "arr", 1, "blah")
 */
cmvc.kvo.set = function(srcObj, srcProperty, index, value) {
  if(goog.isDefAndNotNull(srcObj)) {
    if(arguments.length == 3) {
      value = index;
      
      srcObj[srcProperty] = value;
      
      // fire the handlePropertySet "event handler"
      if("handlePropertySet" in srcObj && goog.isFunction(srcObj.handlePropertySet)) {
        srcObj.handlePropertySet(srcProperty, index, value);
      }
      
      // propagate the assignment to other property bindings
      cmvc.kvo.firePropertyObservers(srcObj, srcProperty, 'set', value);
    } else if(arguments.length == 4) {
      if(srcProperty in srcObj) {
        // if the collection property doesn't already exist, create it:
        //   Set it to an empty array if the index is is a number, otherwise an empty object
        srcObj[property] = (typeof index == 'number') ? [] : {};
      }
      
      srcObj[property][index] = value;
      
      // fire the handlePropertySet "event handler"
      if("handlePropertySet" in srcObj && goog.isFunction(srcObj.handlePropertySet)) {
        srcObj.handlePropertySet(srcProperty, index, value);
      }
      
      // propagate the assignment to other property bindings
      cmvc.kvo.firePropertyObservers(srcObj, srcProperty, 'set', index, value);
    }
  }
};
