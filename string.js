goog.provide("cmvc.string");

goog.require("goog.string");


/**
 * Splits the string into words, separated by spaces. Empty strings are removed from the results.
 * 
 * @returns {Array} an array of non-empty strings
 */
cmvc.string.words = function(str) {
  return goog.string.collapseWhitespace(str).split(" ");
}
