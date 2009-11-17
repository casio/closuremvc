/*
 * The Template class below is a near exact duplicate of the Template class and supporting methods
 *   as implemented in the Ext Core 3 library. I also take the Ext.DomHelper#createHtml function
 *   and merge it into this Template class.
 *
 * I'm re-posting their copyright and license info along with this since this is a derivative work.
 *
 * Ext Core Library 3.0
 * http://extjs.com/
 * Copyright(c) 2006-2009, Ext JS, LLC.
 * 
 * MIT Licensed - http://extjs.com/license/mit.txt
 */

goog.provide("cmvc.Template");

goog.require("goog.array");
goog.require("goog.object");
goog.require("goog.dom");
goog.require("goog.userAgent");
goog.require("cmvc");

/**
 * @class cmvc.Template
 * Represents an HTML fragment template. Templates can be precompiled for greater performance.
 *
 * Usage:
<pre><code>
var t = new cmvc.Template("Hi {name}");
console.log(t.apply({name: "Bob"}));
</code></pre>
 * @constructor
 * @param {String/Array} html The HTML fragment or an array of fragments to join("") or multiple arguments to join("")
 */
cmvc.Template = cmvc.extend(Object, {
  constructor: function(html) {
    var me = this,
    	  args = arguments,
    	  buf = [];

    if(goog.isArray(html)) {
      html = html.join("");
    } else if(args.length > 1) {
	    goog.array.forEach(args, function(v) {
        if(goog.isObject(v)) {
          goog.object.extend(me, v);
        } else {
          buf.push(v);
        }
      });
      html = buf.join('');
    }

    /**@private*/
    me.html = html;
    if (me.compiled) {
      me.compile();
    }
  },
  
  /**
   * Returns an HTML fragment of this template with the specified values applied.
   * @param {Object/Array} values The template values. Can be an array if your params are numeric (i.e. {0}) or an object (i.e. {foo: 'bar'})
   * @return {String} The HTML fragment
   */
  applyTemplate : function(values) {
    var me = this;

    return me.compiled ? 
      me.compiled(values) : 
      me.html.replace(me.re, function(m, name) { return values[name] !== undefined ? values[name] : ""; });
  },
  
  /**
   * Applies the template with the specified values applied, and returns a 
   * document fragment (a Node -> https://developer.mozilla.org/en/DOM/Node).
   *
   * @param {Object/Array} values The template values. Can be an array if your params are numeric (i.e. {0}) or an object (i.e. {foo: 'bar'})
   * @return {!Node} The resulting document fragment.
   */
  createNode: function(values) {
    return goog.dom.htmlToDocumentFragment(this.applyTemplate(values));
  },
  
  /**
   * Applies the template with the specified values applied, and returns an
   * Element.
   *
   * **IMPORTANT NOTE** : This method *assumes* that the template was created by a call to
   *                      cmvc.Template.createTemplate(<ExtJS DomHelper spec Object>), which means that the
   *                      HTML template has a single root element, 'e1', and no sibling elements, and therefore
   *                      the only possible Node that can be referenced by tempElement.firstChild is an Element
   *                      representing the root element 'e1'.
   *
   * @param {Object/Array} values The template values. Can be an array if your params are numeric (i.e. {0}) or an object (i.e. {foo: 'bar'})
   * @return {!Element} The resulting Element.
   */
  createElement: function(values) {
    var tempDiv = goog.dom.createElement('div');
    tempDiv.innerHTML = this.applyTemplate(values);
    if(tempDiv.childNodes.length == 1) {
      // Technically, the DOM Level 1 and 2 standards define tempDiv.firstChild to refer to
      // a Node object but since we make the assumption documented in the method docstring, we
      // can say with certainty that tempDiv.firstChild is an Element object.
      return /** @type {!Element} */ goog.dom.getFirstElementChild(tempDiv);
    } else {
      throw Error('cmvc.Template#createElement requires the HTML Template to have only one "root" element; This Template has multiple "root" elements.');
    }
  },

  /**
   * Sets the HTML used as the template and optionally compiles it.
   * @param {String} html
   * @param {Boolean} compile (optional) True to compile the template (defaults to undefined)
   * @return {cmvc.Template} this
   */
  set : function(html, compile){
    var me = this;
    me.html = html;
    me.compiled = null;
    return compile ? me.compile() : me;
  },

  /**
   * The regular expression used to match template variables
   * @type RegExp
   * @property
   */
  re : /\{([\w-]+)\}/g,

  /**
   * Compiles the template into an internal function, eliminating the RegEx overhead.
   * @return {cmvc.Template} this
   */
  compile : function(){
    var me = this,
    	  sep = goog.userAgent.GECKO ? "+" : ",";
    
    function fn(m, name){                        
      name = "values['" + name + "']";
      return "'"+ sep + '(' + name + " == undefined ? '' : " + name + ')' + sep + "'";
    }
    
    eval("this.compiled = function(values){ return " + (goog.userAgent.GECKO ? "'" : "['") +
         me.html.replace(/\\/g, '\\\\').replace(/(\r\n|\n)/g, '\\n').replace(/'/g, "\\'").replace(this.re, fn) +
         (goog.userAgent.GECKO ?  "';};" : "'].join('');};"));
    return me;
  }
});

/**
 * Alias for {@link #applyTemplate}
 * Returns an HTML fragment of this template with the specified values applied.
 * @param {Object/Array} values The template values. Can be an array if your params are numeric (i.e. {0}) or an object (i.e. {foo: 'bar'})
 * @return {String} The HTML fragment
 * @member cmvc.Template
 * @method apply
 */
cmvc.Template.prototype.apply = cmvc.Template.prototype.applyTemplate;

/**
 * Build as innerHTML where available; a near exact duplicate of Ext.DomHelper#createHtml
 * @return {String} The HTML fragment
 */
cmvc.Template.createHtml = function(o) {
  var b = "",
    	attr,
    	val,
    	key,
    	keyVal,
    	cn,
    	emptyTags = /^(?:br|frame|hr|img|input|link|meta|range|spacer|wbr|area|param|col)$/i;
  
  if(goog.isString(o)) {
    b = o;
  } else if(goog.isArray(o)) {
    goog.array.forEach(o, function(v) {
      b += cmvc.Template.createHtml(v);
    });
  } else {
    b += "<" + (o.tag = o.tag || "div");
    goog.object.forEach(o, function(val, attr, o) {
      if(!(/tag|children|cn|html$/i.test(attr)) && !goog.isFunction(val)) {
        if(goog.isObject(val)) {
        	//b += " " + attr + "='";       // I'm replacing this with the line below because this would break when
        	                                //   I stored a string like "{accountName}'s Screens", since the single quote
        	                                //   in my attribute would, without my knowing, close the attribute string
        	                                //   and cause this function to misbehave immediately after.
        	b += " " + attr + '="';
        	
          goog.object.forEach(val, function(keyVal, key, val) {
            b += !goog.isFunction(keyVal) ? key + ":" + keyVal + ";" : "";
          });
          
          //b += "'";                     // I had to replace this line too as part of my change documented above.
          b += '"';
        } else {
       	  b += " " + ({cls : "class", htmlFor : "for"}[attr] || attr) + '="' + val + '"';
        }
      }
    });
    // Now either just close the tag or try to add children and close the tag.
    if(emptyTags.test(o.tag)) {
      b += "/>";
    } else {
      b += ">";
      if(cn = o.children || o.cn) {
        b += cmvc.Template.createHtml(cn);
      } else if(o.html) {
        b += o.html;
      }
      b += "</" + o.tag + ">";
  	}
  }
  return b;
};

cmvc.Template.createTemplate = function(o) {
  return new cmvc.Template(cmvc.Template.createHtml(o));
}