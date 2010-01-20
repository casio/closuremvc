goog.provide("cmvc.object");

/**
 * Extends an object with another object.
 * In case of key conflict, values are merged into an array, and then the array is associated with the key.
 * This operates 'in-place'; it does not create a new Object.
 *
 * Example:
 * var o = {};
 * goog.object.extend(o, {a: 0, b: 1});
 * o; // {a: 0, b: 1}
 * goog.object.extend(o, {a: 3, c: 2});
 * o; // {a: [0, 3], b: 1, c: 2}
 *
 * @param {Object} target  The object to modify.
 * @param {...Object} var_args The objects from which values will be copied.
 */
cmvc.object.append = function(target, var_args) {
  var key, source, typeTarget, typeSource;
  for (var i = 1; i < arguments.length; i++) {
    source = arguments[i];
    
    for (key in source) {
      if (key in target) {                                      // merge the values somehow
        typeTarget = goog.typeOf(target[key]);
        typeSource = goog.typeOf(source[key]);
        if(typeTarget == 'array' && typeSource == 'array') {    // both are arrays, so concatenate them
          target[key] = target[key].concat(source[key]);
        } else if (typeTarget == 'array') {                     // only target is an array, so push source[key] onto back
          target[key].push(source[key]);
        } else if (typeSource == 'array') {                     // only source is an array, so prepend target[key] before source[key] into a new array
          target[key] = [target[key]].concat(source[key]);
        } else {                                                // neither is an array, so put target[key] and source[key] into a new array
          target[key] = [target[key], source[key]];
        }
      } else {                                                  // create in the first place
        target[key] = source[key];
      }
    }
    
    // For IE the for-in-loop does not contain any properties that are not
    // enumerable on the prototype object (for example isPrototypeOf from
    // Object.prototype) and it will also not include 'replace' on objects that
    // extend String and change 'replace' (not that it is common for anyone to
    // extend anything except Object).

    for (var j = 0; j < goog.object.PROTOTYPE_FIELDS_.length; j++) {
      key = goog.object.PROTOTYPE_FIELDS_[j];
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {  // merge the values somehow
          typeTarget = goog.typeOf(target[key]);
          typeSource = goog.typeOf(source[key]);
          if(typeTarget == 'array' && typeSource == 'array') {    // both are arrays, so concatenate them
            target[key] = target[key].concat(source[key]);
          } else if (typeTarget == 'array') {                     // only target is an array, so push source[key] onto back
            target[key].push(source[key]);
          } else if (typeSource == 'array') {                     // only source is an array, so prepend target[key] before source[key] into a new array
            target[key] = [target[key]].concat(source[key]);
          } else {                                                // neither is an array, so put target[key] and source[key] into a new array
            target[key] = [target[key], source[key]];
          }
        } else {                                                  // create in the first place
          target[key] = source[key];
        }
      }
    }
  }
};