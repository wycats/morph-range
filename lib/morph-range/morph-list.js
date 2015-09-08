import { insertBefore, DETACHED, APPENDING, ATTACHED, MOVING, DESTROYED, BLANK, EMPTY_LIST } from './utils';

function MorphList() {
  // morph graph
  this.firstChildMorph = null;
  this.lastChildMorph  = null;

  this.parentMorph = null;
  this.stability = DETACHED;

  this.removals = null;
  this.preMovingState = null;
}

var prototype = MorphList.prototype;

prototype.eachChildMorph = function(callback) {
  var current = this.firstChildMorph;

  while (current) {
    callback(current);
    current = current.nextMorph;
  }
};

prototype.clear = function MorphList$clear() {
  this.parentMorph.unmountChild();
};

prototype.destroy = function MorphList$destroy() {
};

function appendMorph(list, morph) {
  var lastMorph = list.lastChildMorph;

  if (lastMorph) {
    lastMorph.nextMorph = morph;
    morph.previousMorph = lastMorph;
  } else {
    list.firstChildMorph = morph;
  }

  list.lastChildMorph = morph;
  morph.parentMorph = list;
}

function insertBeforeMorph(list, morph, reference) {
  if (!reference) { return appendMorph(list, morph); }

  var previousMorph = reference.previousMorph;
  var originalPrev = morph.previousMorph;

  if (previousMorph) {
    previousMorph.nextMorph = morph;
    morph.previousMorph = previousMorph;
  } else {
    morph.previousMorph = null;
    list.firstChildMorph = morph;
  }

  if (list.lastChildMorph === morph) {
    list.lastChildMorph = originalPrev;
  }

  reference.previousMorph = morph;
  morph.nextMorph = reference;
  morph.parentMorph = list;

  // update the nextSibling so appending goes into the right place
  morph.nextSibling = reference.firstNode;
}

prototype.mount = function(parentMorph) {
  this.parentMorph = parentMorph;
  parentMorph.childMorphList = this;
  this.stability = APPENDING;
};

// This is not intended to be a public API. Use morph.unmountChild() or morphList.clear();
prototype.unmount = function() {
  assert(this.stability === ATTACHED, "You can only unmount a list when it's attached and not mid-moving");
  // TODO: Maybe we want to allow unmounting a list in append mode if nothing
  // was added to it yet, but that scenario seems sloppy.

  this.parentMorph.childMorphList = null;
  this.parentMorph = null; // should not be added back
  this.firstChildMorph = null;
  this.lastChildMorph = null;
  this.stability = DESTROYED;
};

prototype.beginMove = function() {
  assert(this.stability === ATTACHED, "You can only move morphs once they're attached");
  this.removals = [];

  // attached means this must exist
  var lastNode = this.parentMorph.lastNode;

  this.preMovingState = { parent: lastNode.parentNode, nextSibling: lastNode.nextSibling };
  this.stability = MOVING;
};

prototype.finishMove = function() {
  assert(this.stability === MOVING, "You can only finish a move you started");
  this.stability = ATTACHED;

  this.syncNodes();

  var removals = this.removals;
  if (removals.length) {
    for (var i=0, l=removals.length; i<l; i++) {
      var morph = removals[i];
      if (isRemoved(this, morph)) { morph.destroy(); }
    }
  }

};

function isRemoved(morphList, morph) {
  // note that unlinking doesn't remove parentMorph, which isn't needed for GC, and
  // and it useful to track reinsertions.
  return !morph.previousMorph && !morph.nextMorph && morph !== morph.firstChildMorph;
}

// TODO: Only update nodes if the first node has changed; track around
// the transaction.
prototype.updateFirstNode = function(node) {
  this.firstNode = node;
  this.parentMorph.updateFirstNode(node);
};

prototype.updateLastNode = function(node) {
  this.lastNode = node;
  this.parentMorph.updateLastNode(node);
};

prototype.finishAppend = function() {
  assert(this.stability === APPENDING, "You can only finish appending if you previously started");

  var first = this.firstChildMorph;
  var last = this.lastChildMorph;

  if (!first) {
    this.contentState = EMPTY_LIST;
    this.parentMorph.contentState = EMPTY_LIST;
    // stability will become ATTACHED when the parent is finalized and
    // installs the comment node;
    return;
  }

  this.firstNode = this.parentMorph.firstNode = first.firstNode;
  this.lastNode = this.parentMorph.lastNode = last.lastNode;

  this.stability = ATTACHED;
};

prototype.syncNodes = function() {
  var firstMorph = this.firstChildMorph;
  var lastMorph = this.lastChildMorph;
  var parent = this.parentMorph;
  var firstNode, lastNode;

  if (!firstMorph) {
    var comment = parent.emptyList(this.preMovingState);
    firstNode = lastNode = comment;
  } else {
    if (parent.contentState === EMPTY_LIST) { parent.listHasContents(); }
    firstNode = firstMorph.firstNode;
    lastNode = lastMorph.lastNode;
  }

  this.updateFirstNode(firstNode);
  this.updateLastNode(lastNode);

  this.preMovingState = null;
};

prototype.appendMorph = function MorphList$appendMorph(morph) {
  this.insertBeforeMorph(morph, null);
};

prototype.insertBeforeMorph = function MorphList$insertBeforeMorph(morph, referenceMorph) {
  assert(this.parentMorph, "You can only insert a child into a mounted MorphList");

  var parentStability = this.parentMorph.stability;

  assert(parentStability === ATTACHED || !referenceMorph, "You can only append a morph into a morph list if the parent is not attached (you passed a referenceMorph in append mode)");

  // fast path; you should create blank morphs and append them immediately on first render.
  if (parentStability === APPENDING) {
    assert(morph.contentState === BLANK, "You can only insert a morph into a morph list if it's still blank");
    assert(this.parentMorph.parentNode === morph.parentNode, "You can only append a morph to a morph list in append mode if it shares an parentNode with the morph list's mount point");
    appendMorph(this, morph);
    return;
  }

  // fast path for rerender; create a blank morph, initForAppendingToElement(mountPoint.parentNode), and then insertBefore
  if (parentStability === ATTACHED && morph.contentState === APPENDING) {
    assert(morph.nextSibling === null && morph.parentNode === this.parentMorph.parentNode, "To insert a new morph into a morph list, it must be blank and primed for appending to the same parent node");
    this.nextSibling = referenceMorph ? referenceMorph.firstNode : this.lastNode.nextSibling;
    insertBeforeMorph(this, morph, referenceMorph);
    return;
  }

  assert(this.stability === MOVING, "You can only move a morph after calling beginMove and before you call finishMove");
  assert((morph.stability === ATTACHED || morph.stability === APPENDING) && parentStability === ATTACHED, "You can only insert a morph into a morph list that is not in append mode if the morph list is attached and if the morph is in append mode");
  assert(this.parentMorph.parentNode === morph.parentNode, "You can only append a morph to a morph list in append mode if its parentNode is the parent of the mount point");

  // TODO: HTMLBars has a more optimal transactional approach to this problem. Import it.
  insertBefore(this.parentMorph.parentNode, morph.firstNode, morph.lastNode, referenceMorph.firstNode);
  insertBeforeMorph(this, morph, referenceMorph);

  // TODO: Reparenting? Requires a dedicated API.
};

prototype.removeChildMorph = function MorphList$removeChildMorph(morph) {
  assert(morph.parentMorph === this, "Cannot remove a morph from a parent morph list it is not inside of");
  assert(this.stability === MOVING, "You can only move a morph after calling beginMove and before you call finishMove");

  var prev = morph.previousMorph;
  var next = morph.nextMorph;

  if (prev === null) {
    this.firstChildMorph = next;
  } else {
    prev.nextMorph = next;
  }

  if (next === null) {
    this.lastChildMorph = prev;
  } else {
    next.previousMorph = prev;
  }

  morph.previousMorph = morph.nextMorph = null;

  this.removals.push(morph);
};

function assert(test, msg) {
  if (!test) { throw new Error(msg); }
}

export default MorphList;
