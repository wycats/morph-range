import { insertBefore, DETACHED, APPENDING, ATTACHED, MOVING, BLANK, EMPTY_LIST } from './utils';

function MorphList() {
  // morph graph
  this.firstChildMorph = null;
  this.lastChildMorph  = null;

  this.parentMorph = null;
  this.stability = DETACHED;

  this.removals = null;
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
  var current = this.firstChildMorph;

  while (current) {
    var next = current.nextMorph;
    current.previousMorph = null;
    current.nextMorph = null;
    current.parentMorphList = null;
    current = next;
  }

  this.firstChildMorph = this.lastChildMorph = null;
};

prototype.destroy = function MorphList$destroy() {
};

function insertBeforeMorph(list, morph, reference) {
  var previousMorph = reference ? reference.previousMorph : list.lastChildMorph;

  if (previousMorph) {
    previousMorph.nextMorph = morph;
    morph.previousMorph = previousMorph;
  } else {
    list.firstChildMorph = morph;
  }

  if (reference) {
    reference.previousMorph = morph;
    morph.nextMorph = reference;
  } else {
    list.lastChildMorph = morph;
  }

  morph.parentMorph = list;
}

prototype.mount = function(parentMorph) {
  this.parentMorph = parentMorph;
  parentMorph.childMorphList = this;
  this.stability = APPENDING;
};

prototype.unmount = function() {
  assert(this.stability === ATTACHED, "You can only unmount a list when it's attached and not mid-moving");
  // TODO: Maybe we want to allow unmounting a list in append mode if nothing
  // was added to it yet, but that scenario seems sloppy.

  this.parentMorph.childMorphList = null;
  this.parentMorph = null;
  this.stability = DETACHED;
};

prototype.beginMove = function() {
  assert(this.stability === ATTACHED, "You can only move morphs once they're attached");
  this.removals = [];
  this.stability = MOVING;
};

prototype.finishMove = function() {
  assert(this.stability === MOVING, "You can only finish a move you started");
  this.stability = ATTACHED;

  var removals = this.removals;
  if (removals.length) {
    for (var i=0, l=removals.length; i<l; i++) {
      let morph = removals[i];

      // still gone!
      if (!morph.previousMorph && !morph.nextMorph && morph !== this.firstChildMorph) {
        morph.destroy();
      }
    }
  }

  this.syncNodes();
};

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

  this.parentMorph.firstNode = first.firstNode;
  this.parentMorph.lastNode = last.lastNode;

  this.stability = ATTACHED;
};

prototype.syncNodes = function() {
  var first = this.firstChildMorph;
  var last = this.lastChildMorph;
  var parent = this.parentMorph;

  if (!first) {
    parent.contentState = EMPTY_LIST;
    parent.clear();
  }

  this.updateFirstNode(first.firstNode);
  this.updateLastNode(last.lastNode);
};

prototype.appendMorph = function MorphList$appendMorph(morph) {
  this.insertBeforeMorph(morph, null);
};

prototype.insertBeforeMorph = function MorphList$insertBeforeMorph(morph, referenceMorph) {
  assert(this.parentMorph, "You can only insert a child into a mounted MorphList");

  var stability = this.parentMorph.stability;
  var contentState = morph.contentState;
  var moving = morph.parentMorph !== null;

  // fast path; you should create blank morphs and append them immediately
  // on first render.
  if (!referenceMorph && stability === APPENDING && contentState === BLANK) {
    insertBeforeMorph(this, morph, null);
    return;
  }

  assert(this.stability === MOVING, "You can only move a morph after calling beginMove and before you call finishMove");

  if (contentState === APPENDING && stability === ATTACHED) {
    insertBeforeMorph(this, morph, referenceMorph);
    return;
  }

  if (moving && morph.parentMorph !== this) {
    morph.unlink();
  }

  if (referenceMorph && referenceMorph.parentMorph !== this) {
    throw new Error('The morph before which the new morph is to be inserted is not a child of this morph.');
  }

  var parentMorph = this.parentMorph;

  if (parentMorph) {
    var parentNode = parentMorph.firstNode.parentNode;
    var referenceNode = referenceMorph ? referenceMorph.firstNode : parentMorph.lastNode.nextSibling;

    insertBefore(
      parentNode,
      morph.firstNode,
      morph.lastNode,
      referenceNode
    );
  }

  morph.parentMorphList = this;
  insertBeforeMorph(this, morph, referenceMorph);
};

prototype.removeChildMorph = function MorphList$removeChildMorph(morph) {
  if (morph.parentMorphList !== this) {
    throw new Error("Cannot remove a morph from a parent it is not inside of");
  }

  if (morph.previousMorph === null) {
    this.firstChildMorph = morph.nextSibling;
  } else {
    morph.previousMorph = null;
  }

  if (morph.nextMorph === null) {
    this.lastChildMorph = morph.previousSibling;
  } else {
    morph.nextMorph = null;
  }

  this.removals.push(morph);
};

function assert(test, msg) {
  if (!test) { throw new Error(msg); }
}

export default MorphList;
