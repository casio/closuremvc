goog.provide("cmvc.array");


/**
 * Takes an N-element array and splits it into two sub-arrays.
 *   - The left sub-array contains elements [0, index)
 *   - The right sub-array contains elements [index, array.length)
 *
 * The function returns a pair, containing the two sub-arrays.
 */
cmvc.array.split = function(array, index) {
  return [array.slice(0, index), array.slice(index, array.length)];
};