goog.provide("cmvc.ui.ViewRenderer");

goog.require("goog.ui.ContainerRenderer");
goog.require("cmvc");
goog.require("cmvc.Template");

cmvc.ui.ViewRenderer = cmvc.extend(goog.ui.ContainerRenderer, {
  /**
   * Creates and returns the container's root element.
   * The default simply creates a DIV and applies the renderer's own CSS class name to it.
   * To be overridden in subclasses.
   *
   * @param {cmvc.ui.View} container View to render.
   * @return {Element} Root element for the container.
   *
   * Overrides goog.ui.ContainerRenderer#createDom
   */
  createDom: function(container) {
    // using the default goog.dom.createDom function
    //return container.getDomHelper().createDom(container.elementTag, container.elementAttributes);
    
    // using the cmvc.Template
    return cmvc.Template.createTemplate(container.root).createElement(container);
  },
  
  /**
   * Default implementation of {@code canDecorate}; returns false because I don't plan on using views
   * to decorate pre-existing elements, instead I plan on only creating and rendering views programmatically.
   *
   * @param {Element} element Element to decorate.
   * @return {boolean} Whether the renderer can decorate the element.
   */
  canDecorate: function(element) {
    return false;
  },
  
  // For now, I'm not going to support decoration, so just return the given element, unchanged.
  decorate: function(container, element) {
    return element;
  },
  
  // For now, I'm not going to support decoration, so don't do anything to the children.
  decorateChildren: function(container, element) {
    // do nothing
  },
  
  /**
   * Initializes the view's DOM when the view enters the document.
   * Called from {@link cmvc.ui.View#enterDocument}.
   * @param {cmvc.ui.View} container View whose DOM is to be initialized as it enters the document.
   */
  initializeDom: function(container) {
    cmvc.ui.ViewRenderer.superClass_.initializeDom.apply(this, arguments);
  }
});

goog.addSingletonGetter(cmvc.ui.ViewRenderer);