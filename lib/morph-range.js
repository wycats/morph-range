import { clear, insertBefore } from './morph-range/utils';

import {
  COMMENT, BLANK, CONTENTS, FRAGMENT, LIST, EMPTY_LIST,
  DETACHED, APPENDING, ATTACHED, DESTROYED, UPDATING, WAS_STABLE,
  STABILITY_STATES, CONTENT_STATES
} from './morph-range/utils';

// constructor just initializes the fields
// use one of the static initializers to create a valid morph.
function Morph(domHelper) {
  this.domHelper = domHelper;
  // inclusive range of morph
  // these should be nodeType 1, 3, or 8
  this.firstNode = null;
  this.lastNode  = null;
  this.parentNode = null;

  this.contentState = BLANK;
  this.stability = DETACHED;
  this.mode = null;

  // these fields represent containment and adjacency invariants
  this.frontBoundary = false;
  this.backBoundary = false;

  this.ownerNode = null;
  this.nextSibling = null;
  this.parentNode = null;

  // flag to force text to setContent to be treated as html
  this.parseTextAsHTML = false;

  // don't do unnecessary work
  this.lastValue = null;

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

Morph.prototype.initRoot = function() {
  this.ownerNode = this;
  return this;
};

Morph.prototype.initParent = function(parentMorph) {
  this.ownerNode = parentMorph.ownerNode;
  this.parentMorph = parentMorph;
  return this;
};

Morph.prototype.initForAppendingToElement = function(element) {
  assert(this.contentState === BLANK, "You can only initialize morphs while they're still blank");
  this.beginAppendingWith(element, null);
  return this;
};

Morph.prototype.initForAppendingToList = function(morphList) {
  assert(this.contentState === BLANK, "You can only initialize morphs while they're still blank");
  assert(morphList.parentMorph && morphList.parentMorph.stability === ATTACHED, "You can only initialize morphs for appending to a list if the list is attached");

  var parentMorph = morphList.parentMorph;

  this.beginAppendingWith(parentMorph.parentNode, null);
  return this;
};

// It is expected that a system calling this method will populate parentMorph.childMorphs with an
// array containing this morph.
Morph.prototype.initForAppendingToMorph = function(parentMorph) {
  assert(this.contentState === BLANK, "You can only initialize morphs while they're still blank");
  this.beginAppendingWith(parentMorph.parentNode, parentMorph.nextSibling);
  this.initParent(parentMorph);
  return this;
};

Morph.prototype.initForInsertingBeforeMorph = function(nextMorph) {
  assert(this.contentState === BLANK && nextMorph.stability === ATTACHED, "You can only initialize morphs while they're still blank, and relative to a morph that is already in the DOM");

  var reference = nextMorph.firstNode;
  this.beginAppendingWith(reference.parentNode, reference);
  return this;
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
    case UPDATING:
      this.willClear();
      this.beginAppending();
      clear(this.firstNode.parentNode, this.firstNode, this.lastNode);
      this.firstNode = this.lastNode = null;
      this.didClear();
      this.contentState = BLANK;
      break;
    default:
      invalidState("clear for render", this.stability);
  }
};

// This method is intended to be called to begin a transaction for rerendering. If finishAppend is
// called and the morph is still in UPDATING, it will be cleared. If the morph has not changed,
// call remainedStable() and the morph will not be cleared.
//
// The lifecycle of a rerendering transaction for a morph is:
//
// expectUpdate()
//   -> remainedStable()
//    | clearForRender()
//   -> finishAppend()
Morph.prototype.expectUpdate = function() {
  assert(this.stability === ATTACHED, "You can only prepare a morph for an update if it's attached");

  this.stability = UPDATING;
};

Morph.prototype.remainedStable = function() {
  assert(this.stability === UPDATING, "You can only mark a morph as stable if it's updating");

  this.stability = WAS_STABLE; // the next thing you do must be finishAppend
};

Morph.prototype.beginAppendingWith = function Morph$beginAppendingWith(parent, nextSibling) {
  this.parentNode = parent;
  this.nextSibling = nextSibling;

  this.stability = APPENDING;
};

Morph.prototype.beginAppending = function Morph$beginAppending() {
  assert(this.stability === ATTACHED || this.stability === UPDATING, "To use beginAppending, you must be attached; otherwise, use beginAppendingWith");

  this.parentNode = this.firstNode.parentNode;
  this.nextSibling = this.lastNode.nextSibling;

  this.stability = APPENDING;
};

Morph.prototype.finishAppend = function Morph$finishAppending() {
  assert(this.stability === APPENDING || this.stability === UPDATING || this.stability === WAS_STABLE, "You can only finish appending if you previously started");

  if (this.contentState === LIST) {
    assert(this.childMorphList.stability === ATTACHED, "You must finalize mounted morph lists before finalizing their parent morph");
  }

  if (this.stability === UPDATING) {
    this.clearForRender(); // clears the morph and moves it into APPENDING / BLANK
  }

  // APPENDING
  switch (this.contentState) {
    case EMPTY_LIST:
      this.childMorphList.stability = ATTACHED;
      /* falls through */
    case BLANK:
      var comment = this.domHelper.createComment('');
      append(this, comment);
      this.firstNode = this.lastNode = comment;
      this.contentState = COMMENT;
      break;
    case CONTENTS:
    case LIST:
      break; // nothing special to do here
    default:
      assert(false, "Cannot finish rendering in content state " + CONTENT_STATES[this.contentState]);
  }

  var frontBoundary = this.frontBoundary;
  var backBoundary = this.backBoundary;

  if (frontBoundary) {
    this.parentMorph.firstNode = this.firstNode;
  }

  if (backBoundary) {
    this.parentMorph.lastNode = this.lastNode;
  }

  if (this.parentMorph) {
    // the parent morph is no longer blank
    this.parentMorph.contentState = CONTENTS;
  }

  this.nextSibling = null;
  this.stability = ATTACHED;
};

function append(morph, node) {
  var next = morph.nextSibling;
  var parent = morph.parentNode;

  parent.insertBefore(node, next);
}

Morph.prototype.appendNode = function Morph$appendNode(node) {
  assert(this.stability === APPENDING, "You can only append nodes while the node is in appending mode");

  this.lastNode = node;

  if (!this.firstNode) {
    this.firstNode = node;
  }

  append(this, node);
  this.contentState = CONTENTS;
};

Morph.prototype.appendNodes = function Morph$appendNodes(start, end) {
  insertBefore(this.parentNode, start, end, this.nextSibling);

  if (!this.firstNode) {
    this.firstNode = start;
  }

  this.lastNode = end;
  this.contentState = CONTENTS;
};

Morph.prototype.setContent = function Morph$setContent(content) {
  if (content === null || content === undefined || content === "") {
    switch (this.stability) {
      case APPENDING:
        // this case is allowed so that this method can be called idempotently
        // in both initial render and re-render.
        return;
      case ATTACHED:
        return this.clear();
      default:
        invalidState("setting content to null or undefined", this.stability);
    }
  }

  if (this.lastValue === content) {
    return noop(this);
  }

  switch (typeof content) {
    case 'object':
      assert(typeof content.string === 'string', "You passed an unexpected object to setContent. Pass only Strings or SafeStrings. Use of the of the other APIs (e.g. setNode) if you want to set something else.");
      if (this.lastValue === content.string) { return noop(this); }
      this.lastValue = content.string;
      return this.setHTML(content.string);
    case 'string':
      this.lastValue = content;

      if (this.parseTextAsHTML) { return this.setHTML(content); }
      return this.setText(content);
    default:
      // if a caller wants to coerce into a String, fine, but we're not going to do anything fancy.
      throw new TypeError('unsupported content');
  }
};

function noop(morph) {
  if (morph.stability === UPDATING) {
    morph.stability = WAS_STABLE;
  }
}

Morph.prototype.emptyList = function(preMovingState) {
  assert(this.contentState === LIST && this.stability === ATTACHED, "You can only transition a list to an empty list, and only when the parent is attached");

  this.contentState = EMPTY_LIST;

  var comment = this.domHelper.createComment('');
  var parent = preMovingState.parent;
  var nextSibling = preMovingState.nextSibling;

  parent.insertBefore(comment, nextSibling);

  return comment;
};

Morph.prototype.listHasContents = function() {
  this.parentNode.removeChild(this.firstNode);
};

Morph.prototype.clear = function Morph$clear() {
  assert(this.stability === ATTACHED, "You can only clear a morph in the attached state");
  assert(this.contentState !== LIST, "You cannot clear a morph that mounts a list. Use unmount() instead");

  return clearWhileAttached(this);
};

Morph.prototype.unmountChild = function() {
  assert(this.stability === ATTACHED, "You can only unmount a morph list if the mount point is attached");
  assert(this.contentState === LIST || this.contentState === EMPTY_LIST, "You can't unmount a morph list unless you mounted one before");

  this.willUnmount();
  this.childMorphList.unmount();
  this.didUnmount();
  return clearWhileAttached(this);
};

function clearWhileAttached(morph) {
  var comment = morph.domHelper.createComment('');
  morph.contentState = COMMENT;

  morph.willClear();
  setNodeWhileAttached(morph, comment);
  morph.didClear();

  return comment;
}

function setFragment(morph, fragment) {
  switch (morph.stability) {
    case APPENDING:
      assert(morph.contentState === BLANK, "You can only set a fragment on an appending morph if it's blank");
      morph.firstNode = fragment.firstNode;
      morph.lastNode = fragment.lastNode;
      append(morph, fragment);
      morph.contentState = CONTENTS;
      break;
    case DETACHED:
      morph.firstNode = morph.lastNode = fragment;
      morph.contentState = FRAGMENT;
      break;
    case ATTACHED:
      var firstNode = fragment.firstChild;
      if (firstNode === null) {
        morph.clear();
      } else {
        setNodeWhileAttached(morph, fragment);
        morph.contentState = CONTENTS;
      }
      break;
    default:
      invalidState("set a morph's fragment", morph.stability);
  }
}

export function blank(morph) {
  switch (morph.stability) {
    case DETACHED:
      morph.contentState = BLANK;
      break;
    case APPENDING:
      assert(morph.firstNode === null, "You can only blank a morph in appending mode if it's already blank");
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
    default:
      invalidState("blank a morph", morph.stability);
  }

  morph.firstNode = morph.lastNode = null;
}

Morph.prototype.setText = function Morph$setText(text) {
  var firstNode = this.firstNode;
  var lastNode = this.lastNode;

  // optimization for single-node text morphs updating their text
  // TODO: Track this as a separate state
  if (firstNode &&
      lastNode === firstNode &&
      firstNode.nodeType === 3) {
    firstNode.nodeValue = text;
    if (this.stability === UPDATING) { this.stability = APPENDING; }
    return firstNode;
  }

  if (!text) { this.clear(); }
  setContentNode(this, this.domHelper.createTextNode(text));
};

Morph.prototype.setNode = function Morph$setNode(newNode) {
  if (newNode.nodeType === 11) {
    setFragment(this, newNode);
    return;
  }

  setContentNode(this, newNode);
  return newNode;
};

function setContentNode(morph, node) {
  assert(morph.contentState !== LIST && morph.contentState !== EMPTY_LIST, "You cannot set a morph's node while it's in list mode. You must unmount the list first");

  switch (morph.stability) {
    case DETACHED:
      morph.firstNode = morph.lastNode = node;
      morph.contentState = CONTENTS;
      break;
    case UPDATING:
      morph.clearForRender();
      /* fall through */
    case APPENDING:
      assert(morph.contentState === BLANK, "You can only set a morph while it's appending if it has not already been appended to");
      morph.appendNode(node);
      break;
    case ATTACHED:
      setNodeWhileAttached(morph, node);
      morph.contentState = CONTENTS;
      break;
    default:
      invalidState("set a morph's node", morph.stability);
  }

}

function invalidState(operation, stability) {
  throw new Error("You cannot " + operation + " while it's in " + STABILITY_STATES[stability] + " mode");
}

function setNodeWhileAttached(morph, node) {
  var first = morph.firstNode;
  var last = morph.lastNode;
  var parent = first.parentNode;

  parent.insertBefore(node, first);
  morph.willClear();
  clear(parent, first, last);
  morph.didClear();

  morph.updateFirstNode(node);
  morph.updateLastNode(node);
}

Morph.prototype.setRange = function (firstNode, lastNode) {
  if (firstNode === lastNode) {
    this.setNode(firstNode);
    return;
  }

  assert(this.stability === ATTACHED, "You cannot replace a morph with a range unless your morph is attached (and not appending or in list mode)");

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


Morph.prototype.destroy = function Morph$destroy() {
  this.willDestroyMorph();
  this.unlink();

  var firstNode = this.firstNode;
  var lastNode = this.lastNode;
  var parentNode = firstNode && firstNode.parentNode;

  // it should be safe to hang on to DOM nodes, as long as they
  // don't hang on to us

  clear(parentNode, firstNode, lastNode);
  this.stability = DESTROYED;
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
  var newNodes;

  switch (this.stability) {
    case APPENDING:
      assert(this.contentState === BLANK, "You can only set a morph's HTML in appending mode if it's still blank");
      newNodes = this.domHelper.appendHTMLBefore(this.parentNode, this.nextSibling, text);
      this.contentState = CONTENTS;
      this.firstNode = newNodes[0];
      this.lastNode = newNodes[1];
      break;
    case ATTACHED:
      this.willClear();
      newNodes = this.domHelper.replaceHTML(this.firstNode, this.lastNode, text);
      this.didClear();

      updateNodes(this, newNodes[0], newNodes[1]);
      this.updateFirstNode(newNodes[0]);
      this.updateLastNode(newNodes[1]);
      break;
    default:
      invalidState("set a morph's HTML", this.stability);
  }
};

function updateNodes(morph, first, last) {
  var frontBoundary = morph.frontBoundary;
  var backBoundary = morph.backBoundary;

  this.firstNode = first;
  this.lastNode = last;

  if (frontBoundary) {
    morph.parentMorph.updateFirstNode(first);
  }

  if (backBoundary) {
    morph.parentMorph.updateLastNode(last);
  }
}

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
    this.parentMorph.contentState = this.contentState;
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
