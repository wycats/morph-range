import { clear, insertBefore } from './morph-range/utils';

import {
  COMMENT, BLANK, CONTENTS, FRAGMENT, LIST, EMPTY_LIST,
  DETACHED, APPENDING, ATTACHED
} from './morph-range/utils';

// constructor just initializes the fields
// use one of the static initializers to create a valid morph.
function Morph(domHelper, contextualElement) {
  this.domHelper = domHelper;
  // context if content if current content is detached
  this.contextualElement = contextualElement;
  // inclusive range of morph
  // these should be nodeType 1, 3, or 8
  this.firstNode = null;
  this.lastNode  = null;

  this.contentState = BLANK;
  this.stability = DETACHED;
  this.mode = null;

  // these fields represent containment and adjacency invariants
  this.ownerNode = null;
  this.frontBoundary = false;
  this.backBoundary = false;

  this.nextSibling = null;
  this.appendToParent = null;

  // flag to force text to setContent to be treated as html
  this.parseTextAsHTML = false;

  // morph list graph
  this.parentMorph = null;
  this.previousMorph = null;
  this.nextMorph = null;

  // childMorphs are intended to be set once as a fixed array before
  // finishAppend is called. For more dynamic control of morphs, use
  // MorphList.
  this.childMorphs = null;

  // childMorphList is a mount point for a MorphList.
  this.childMorphList = null;
}

Morph.empty = function (domHelper, contextualElement) {
  var morph = new Morph(domHelper, contextualElement);
  morph.clear();
  return morph;
};

Morph.create = function (domHelper, contextualElement, node) {
  var morph = new Morph(domHelper, contextualElement);
  morph.setNode(node);
  return morph;
};

Morph.attach = function (domHelper, contextualElement, firstNode, lastNode) {
  var morph = new Morph(domHelper, contextualElement);
  morph.setRange(firstNode, lastNode);
  return morph;
};

Morph.prototype.initParent = function(parentMorph) {
  this.ownerNode = parentMorph.ownerNode;
  this.parentMorph = parentMorph;
};

Morph.prototype.initForAppendingToElement = function(element, parentMorph) {
  assert(this.contentState === BLANK, "You can only initialize morphs while they're still blank");
  this.contextualElement = parentMorph;
  this.beginAppendingWith(element, null);
};

Morph.prototype.initForAppendingToMorph = function(parentMorph) {
  assert(this.contentState === BLANK, "You can only initialize morphs while they're still blank");
  this.contextualElement = parentMorph.contextualElement;
  this.beginAppendingWith(parentMorph.appendToParent, parentMorph.nextSibling);
  this.initParent(parentMorph);
};

Morph.prototype.initForInsertingBeforeMorph = function(nextMorph) {
  assert(this.contentState === BLANK && nextMorph.stability === ATTACHED, "You can only initialize morphs while they're still blank, and relative to a morph that is already in the DOM");

  let reference = nextMorph.firstNode;
  this.contextualElement = nextMorph.contextualElement;
  this.beginAppendingWith(reference.parentNode, reference);
};

Morph.prototype.prepareForInsertingBeforeMorph = function(nextMorph) {
  assert(this.contentState === APPENDING && nextMorph.stability === ATTACHED, "You can only update the nextSibling of morphs while they're being appended, and relative to a morph that is already in the DOM");
  this.nextSibling = nextMorph.firstNode;
};

/// these two callbacks get called immediately around any operation that
/// replaces the content of **attached** morphs. When didClear is called,
/// the morph will either be APPENDING or ATTACHED.

Morph.prototype.willClear = function() {};
Morph.prototype.didClear = function() {};

/// these two callbacks get called around the destruction of a morph. The
/// willDestroyMorph callback gets called before unlinking, and the
/// didDestroyMorph callback gets called after clearing.

Morph.prototype.willDestroyMorph = function() {};
Morph.prototype.didDestroyMorph = function() {};

/// these two callbacks get called around the unmounting of a morph list.

Morph.prototype.willUnmount = function() {};
Morph.prototype.didUnmount = function() {};

Morph.prototype.eachChildMorph = function(callback) {
  // if this morph is a mount point for a MorphList, just keep walking
  // to the MorphList.
  if (this.contentState === LIST) {
    this.childMorphList.eachChildMorph(callback);
    return;
  }

  var children = this.childMorphs;
  for (var i=0, l=children.length; i<l; i++) {
    callback(children[i]);
  }
};

// This is idempotent and can be used to prepare a morph for appending into For more dynamic control of morphs, use
// MorphList.
Morph.prototype.clearForRender = function() {
  assert(this.stability !== DETACHED, "You cannot append into a detached morph");

  switch (this.stability) {
    case APPENDING:
      // this case is allowed so that this method can be called idempotently
      // in both initial render and re-render.
      return;
    case ATTACHED:
      this.willClear();
      this.beginAppending();
      clear(this.firstNode.parentNode, this.firstNode, this.lastNode);
      this.didClear();
  }
};

Morph.prototype.beginAppendingWith = function Morph$beginAppendingWith(parent, nextSibling) {
  this.appendToParent = parent;
  this.nextSibling = nextSibling;

  this.stability = APPENDING;
};

Morph.prototype.beginAppending = function Morph$beginAppending() {
  assert(this.stability === ATTACHED, "To use beginAppending, you must be attached; otherwise, use beginAppendingWith");

  this.appendToParent = this.firstNode.parentNode;
  this.nextSibling = this.lastNode.nextSibling;

  this.stability = APPENDING;
};

Morph.prototype.finishAppend = function Morph$finishAppending() {
  assert(this.stability === APPENDING, "You can only finish appending if you previously started");

  if (this.contentState === LIST) {
    assert(this.childMorphList.stability === ATTACHED, "You must finalize mounted morph lists before finalizing their parent morph");
  }

  if (this.contentState === BLANK || this.contentState === EMPTY_LIST) {
    let comment = this.domHelper.createComment('');
    append(this, comment);
    this.firstNode = this.lastNode = comment;
    this.contentState = COMMENT;
  }

  if (this.contentState === EMPTY_LIST) {
    this.childMorphList.stability = ATTACHED;
  }

  if (this.frontBoundary) {
    this.parentMorph.firstNode = this.firstNode;
  }

  if (this.backBoundary) {
    this.parentMorph.lastNode = this.lastNode;
  }

  this.stability = ATTACHED;
};

Morph.prototype.appendNode = function Morph$appendNode(node) {
  this.lastNode = node;

  if (!this.firstNode) {
    this.firstNode = node;
  }

  append(this, node);
  this.contentState = CONTENTS;
};

Morph.prototype.appendNodes = function Morph$appendNodes(start, end) {
  insertBefore(this.appendToParent, start, end, this.nextSibling);

  if (!this.firstNode) {
    this.firstNode = start;
  }

  this.lastNode = end;
  this.contentState = CONTENTS;
};

Morph.prototype.setContent = function Morph$setContent(content) {
  if (content === null || content === undefined) {
    return this.clear();
  }

  var type = typeof content;
  switch (type) {
    case 'string':
      if (this.parseTextAsHTML) {
        return this.setHTML(content);
      }
      return this.setText(content);
    case 'object':
      if (typeof content.nodeType === 'number') {
        return this.setNode(content);
      }
      /* Handlebars.SafeString */
      if (typeof content.string === 'string') {
        return this.setHTML(content.string);
      }
      if (this.parseTextAsHTML) {
        return this.setHTML(content.toString());
      }
      /* falls through */
    case 'boolean':
    case 'number':
      return this.setText(content.toString());
    default:
      throw new TypeError('unsupported content');
  }
};

Morph.prototype.clear = function Morph$clear() {
  assert(this.stability === ATTACHED, "You can only clear a morph in the attached state");
  assert(this.contentState !== LIST, "You cannot clear a morph that mounts a list. Use unmount() instead");

  return clearWhileAttached();
};

Morph.prototype.unmountChild = function() {
  assert(this.contentState === LIST || this.contentState === EMPTY_LIST, "You can't unmount a morph list unless you mounted one before");

  this.willUnmount();
  this.childMorphList.unmount();
  this.didUnmount();
  return clearWhileAttached(this);
};

function clearWhileAttached(morph) {
  let comment = morph.domHelper.createComment('');
  morph.contentState = COMMENT;

  morph.willClear();
  setNode(morph, comment);
  morph.didClear();

  return comment;
}

function setNode(morph, node) {
  assert(morph.stability !== APPENDING, "You cannot reset a morph while it's appending");

  switch (morph.stability) {
    case DETACHED:
      morph.firstNode = morph.lastNode = node;
      break;
    case ATTACHED:
      setStableNode(morph, node);
      morph.updateFirstNode(node);
      morph.updateLastNode(node);
  }
}

function setFragment(morph, fragment) {
  switch (morph.stability) {
    case DETACHED:
      morph.firstNode = morph.lastNode = fragment;
      morph.contentState = FRAGMENT;
      break;
    case ATTACHED:
      var firstNode = fragment.firstChild;
      if (firstNode === null) {
        morph.clear();
      } else {
        setNode(morph, fragment);
        morph.contentState = CONTENTS;
      }
  }
}

export function blank(morph) {
  switch (morph.stability) {
    case DETACHED:
      morph.contentState = BLANK;
      break;
    case APPENDING:
      assert(!morph.firstNode, "You can only blank a morph in appending mode if it's already blank");
      return;
    case ATTACHED:
      var first = morph.firstNode;
      var last = morph.lastNode;
      var parent = last.parentNode;
      morph.beginAppendingWith(parent, last.nextSibling);

      morph.willClear();
      clear(parent, first, last);
      morph.didClear();

      break;
    case LIST:
      // TODO
  }

  morph.firstNode = morph.lastNode = null;
}

Morph.prototype.setText = function Morph$setText(text) {
  var firstNode = this.firstNode;
  var lastNode = this.lastNode;

  // optimization for single-node text morphs updating their text
  if (firstNode &&
      lastNode === firstNode &&
      firstNode.nodeType === 3) {
    firstNode.nodeValue = text;
    return firstNode;
  }

  if (!text) { this.clear(); }
  setNode(this, this.domHelper.createTextNode(text));
  this.contentState = CONTENTS;
};

Morph.prototype.setNode = function Morph$setNode(newNode) {
  if (newNode.nodeType === 1) {
    setFragment(this, newNode);
    return;
  }

  setNode(newNode);
  this.contentState = CONTENTS;
  return newNode;
};

Morph.prototype.setRange = function (firstNode, lastNode) {
  if (firstNode === lastNode) {
    this.setNode(firstNode);
    return;
  }

  assert(this.stability === ATTACHED, "You cannot replace a morph with a range unless your morph is attached.");

  var previousFirstNode = this.firstNode;
  if (previousFirstNode !== null) {

    var parentNode = previousFirstNode.parentNode;
    if (parentNode !== null) {
      insertBefore(parentNode, firstNode, lastNode, previousFirstNode);
      clear(parentNode, previousFirstNode, this.lastNode);
    }
  }

  this.updateFirstNode(firstNode);
  this.updateLastNode(lastNode);

  this.contentState = CONTENTS;
};

function append(morph, node) {
  let next = morph.nextSibling;
  let parent = morph.appendToParent;

  parent.insertBefore(node, next);
}

function setStableNode(morph, node) {
  var first = morph.firstNode;
  var parent = first.parentNode;

  parent.insertBefore(node, first);
  morph.willClear();
  clear(parent, first, node);
  morph.didClear();
}

Morph.prototype.destroy = function Morph$destroy() {
  this.willDestroyMorph();
  this.unlink();

  var firstNode = this.firstNode;
  var lastNode = this.lastNode;
  var parentNode = firstNode && firstNode.parentNode;

  // it should be safe to hang on to DOM nodes, as long as they
  // don't hang on to us

  clear(parentNode, firstNode, lastNode);
  this.didDestroyMorph();
};

Morph.prototype.unlink = function Morph$unlink() {
  // It's fine for Morphs to hang on to references to other objects,
  // as long as they don't hang on to the morph. removeChildMorph
  // correctly unlinks the morph from the MorphList, so we should
  // be safe.
  //
  // Morphs in static child node arrays shouldn't need to go away
  // unless their parent goes away.
};

Morph.prototype.setHTML = function(text) {
  var fragment = this.domHelper.parseHTML(text, this.contextualElement);
  return this.setFragment(fragment);
};

Morph.prototype.setMorphList = function Morph$appendMorphList(morphList) {
  assert(this.stability === APPENDING, "You can only mount a morph in the appending state");
  assert(!morphList.firstChildMorph, "You can only mount empty morph lists");
  assert(!this.firstNode, "You can only set a morph list in appending mode if you haven't appended anything else yet");

  morphList.mount(this);
  morphList.parentMorph = this;
  this.childMorphList = morphList;
  this.contentState = LIST;
};

Morph.prototype.updateFirstNode = function Morph$updateFirstNode(node) {
  this.firstNode = node;

  if (this.frontBoundary) {
    this.parentMorph.updateFirstNode(node);
  }
};

Morph.prototype.updateLastNode = function Morph$updateLastNode(node) {
  this.lastNode = node;

  if (this.backBoundary) {
    this.parentMorph.updateLastNode(node);
  }
};

Morph.prototype._syncFirstNode = function Morph$syncFirstNode() {
  var morph = this;
  var parentMorphList;
  while (parentMorphList = morph.parentMorphList) {
    if (parentMorphList.parentMorph === null) {
      break;
    }
    if (morph !== parentMorphList.firstChildMorph) {
      break;
    }
    if (morph.firstNode === parentMorphList.parentMorph.firstNode) {
      break;
    }

    parentMorphList.parentMorph.firstNode = morph.firstNode;

    morph = parentMorphList.parentMorph;
  }
};

Morph.prototype._syncLastNode = function Morph$syncLastNode() {
  var morph = this;
  var parentMorphList;
  while (parentMorphList = morph.parentMorphList) {
    if (parentMorphList.parentMorph === null) {
      break;
    }
    if (morph !== parentMorphList.lastChildMorph) {
      break;
    }
    if (morph.lastNode === parentMorphList.parentMorph.lastNode) {
      break;
    }

    parentMorphList.parentMorph.lastNode = morph.lastNode;

    morph = parentMorphList.parentMorph;
  }
};

// Using attach is dangerous; it is your responsibility to maintain the
// invariants about adjacent boundaries and containment.
Morph.prototype.attach = function Morph$attach(start, end) {
  assert(this.contentState === BLANK, "You can only attach a morph when it has no contents");

  this.firstNode = start;
  this.lastNode = end;
};

Morph.prototype.insertBeforeNode = function Morph$insertBeforeNode(parent, reference) {
  var current = this.firstNode;

  while (current) {
    var next = current.nextSibling;
    parent.insertBefore(current, reference);
    current = next;
  }
};

Morph.prototype.appendToNode = function Morph$appendToNode(parent) {
  this.insertBeforeNode(parent, null);
};

function assert(test, msg) {
  if (!test) { throw new Error(msg); }
}

export default Morph;
