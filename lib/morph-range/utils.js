// inclusive of both nodes
export function clear(parentNode, firstNode, lastNode) {
  if (!parentNode) { return; }

  var node = firstNode;
  var nextNode;
  do {
    nextNode = node.nextSibling;
    parentNode.removeChild(node);
    if (node === lastNode) {
      break;
    }
    node = nextNode;
  } while (node);
}

export function insertBefore(parentNode, firstNode, lastNode, _refNode) {
  var node = lastNode;
  var refNode = _refNode;
  var prevNode;
  do {
    prevNode = node.previousSibling;
    parentNode.insertBefore(node, refNode);
    if (node === firstNode) {
      break;
    }
    refNode = node;
    node = prevNode;
  } while (node);
}

export var COMMENT = 1;    // the morph contains a single comment node inserted by the lib
export var BLANK = 2;      // the morph has no nodes (it's either detached or appending)
export var CONTENTS = 3;   // the morph has at least one content node
export var FRAGMENT = 4;   // the morph is detached and has a single fragment
export var LIST = 5;       // the morph represents a mount point for a MorphList
export var EMPTY_LIST = 6; // the morph represents an empty list

export var DETACHED = 1;   // the morph has contents, but it is detached from the DOM
export var APPENDING = 2;  // the morph represents a position in DOM relative to a nextSibling
export var ATTACHED = 3;   // the morph represents a start and end point in DOM
export var MOVING = 4;     // the morph is in the process of moving
