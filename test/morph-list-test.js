import QUnit from 'qunitjs';
import MorphList from 'morph-range/morph-list';
import Morph from 'morph-range';

//import { document, fragment, element, comment, domHelper } from 'support';

import { domHelper, text, element } from 'support';

QUnit.config.autostart = false;

QUnit.module('MorphList tests', {
  setup: commonSetup
});

var dom, list, root, rootElement;

function commonSetup() {
  dom = domHelper();
  list = new MorphList(dom);
  root = topLevelMorphWithList();
}

function assertChildMorphs(assert, list, expectedMorphs) {
  var actual = [];
  var current = list.firstChildMorph;
  var last = null;

  while (current) {
    actual.push(current.label);

    if (last) {
      assert.strictEqual(current.previousMorph.label, last.label,
                         "expected " + current.label + "'s previous to be " + last.label);
    }

    assert.ok(current.parentMorph === list, "the morphs have the list as the parent");

    last = current;
    current = current.nextMorph;
  }

  expectedMorphs = expectedMorphs.map(function(m) {
    return m.label;
  });

  assert.deepEqual(actual, expectedMorphs);
}

function assertOrphanedMorphs(assert, expectedMorphs) {
  for (var i=0, l=expectedMorphs.length; i<l; i++) {
    var current = expectedMorphs[i];

    assert.ok(current.nextMorph === null, current.label + " should not have a nextMorph");
    assert.ok(current.previousMorph === null, current.label + " should not have a previousMorph");
  }
}

function topLevelMorph(label) {
  var el = element('p');
  rootElement = el;
  var m = new Morph(dom);
  m.initForAppendingToElement(el);
  m.label = label;
  return m;
}

function morph(label) {
  var m = new Morph(dom);
  m.label = label;
  return m;
}

QUnit.test("can create a MorphList", function(assert) {
  assert.strictEqual(list.parentMorph, root);
  assert.strictEqual(list.firstChildMorph, null);
  assert.strictEqual(list.lastChildMorph, null);
});

function appendingMorph(parent, label) {
  if (!parent || !label) {
    throw new Error("Make sure to pass both a parent and label to appendingMorph");
  }

  var morph = new Morph(dom);
  morph.initForAppendingToMorph(parent);
  morph.label = label;
  return morph;
}

function topLevelMorphWithList() {
  var el = element('p');
  var m1 = new Morph(dom);
  m1.initForAppendingToElement(el);
  m1.label = 'top';
  m1.setMorphList(list);
  return m1;
}

QUnit.test("can append a Morph into a MorphList using insertBefore", function(assert) {
  var m2 = appendingMorph(root, 'morph2');
  var m3 = appendingMorph(root, 'morph3');

  list.appendMorph(m2);
  list.appendMorph(m3);

  assertChildMorphs(assert, list, [ m2, m3 ]);

  m3.commit();
  m2.commit();
  list.commit();
  root.commit();

  assert.equal(root.firstNode, m2.firstNode, "firstNode has synced");
  assert.equal(root.lastNode, m3.lastNode, "lastNode has synced");
});

QUnit.test("can prepend a Morph into a MorphList", function(assert) {
  var m3 = appendingMorph(root, 'morph3');

  list.appendMorph(m3);

  m3.commit();
  list.commit();
  root.commit();

  list.beginMove();
  var m2 = morph('morph2').initForAppendingToList(list);
  list.insertBeforeMorph(m2, m3);
  m2.appendNode(text("hello"));
  m2.commit();
  list.finishMove();

  assertChildMorphs(assert, list, [ m2, m3 ]);

  assert.equal(root.firstNode, m2.firstNode, "firstNode has synced");
  assert.equal(root.lastNode, m3.lastNode, "lastNode has synced");
});

QUnit.test("can insert a Morph into the middle of a MorphList", function(assert) {
  var root = topLevelMorphWithList();

  var m3 = appendingMorph(root, 'morph3');
  var m1 = appendingMorph(root, 'morph1');

  list.appendMorph(m1);
  m1.commit();

  list.appendMorph(m3);
  m3.commit();

  list.commit();
  root.commit();

  assert.equal(root.firstNode, m1.firstNode, "firstNode has synced");
  assert.equal(root.lastNode, m3.lastNode, "lastNode has synced");

  list.beginMove();
  var m2 = morph('morph2').initForAppendingToList(list);
  list.insertBeforeMorph(m2, m3);
  m2.commit();
  list.finishMove();

  assertChildMorphs(assert, list, [ m1, m2, m3 ]);

  assert.equal(root.firstNode, m1.firstNode, "firstNode hasn't changed");
  assert.equal(root.lastNode, m3.lastNode, "lastNode hasn't changed");
});

QUnit.test("can remove the only morph in a MorphList", function(assert) {
  var morph1 = appendingMorph(root, "morph1");

  list.appendMorph(morph1);
  morph1.commit();
  list.commit();
  root.commit();

  list.beginMove();
  list.removeChildMorph(morph1);
  list.finishMove();

  assertChildMorphs(assert, list, [ ]);
  assertOrphanedMorphs(assert, [ morph1 ]);
});

QUnit.test("can remove the first morph in a MorphList", function(assert) {
  var morph1 = appendingMorph(root, "morph1");

  list.appendMorph(morph1);
  morph1.commit();
  list.commit();
  root.commit();

  list.beginMove();
  var morph2 = appendingMorph(root, "morph2");
  list.appendMorph(morph2);
  morph2.commit();
  list.removeChildMorph(morph1);
  list.finishMove();

  assertChildMorphs(assert, list, [ morph2 ]);
  assertOrphanedMorphs(assert, [ morph1 ]);
});

QUnit.test("can remove the last morph in a MorphList", function(assert) {
  var morph1 = appendingMorph(root, "morph1");
  var morph2 = appendingMorph(root, "morph2");

  list.appendMorph(morph1);
  morph1.commit();
  list.appendMorph(morph2);
  morph2.commit();
  list.commit();
  root.commit();

  list.beginMove();
  list.removeChildMorph(morph2);
  list.finishMove();

  assertChildMorphs(assert, list, [ morph1 ]);
  assertOrphanedMorphs(assert, [ morph2 ]);
});

QUnit.test("can remove a middle morph in a MorphList", function(assert) {
  var morph1 = appendingMorph(root, "morph1");
  list.appendMorph(morph1);
  morph1.commit();

  var morph2 = appendingMorph(root, "morph2");
  list.appendMorph(morph2);
  morph2.commit();

  var morph3 = appendingMorph(root, "morph3");
  list.appendMorph(morph3);
  morph3.commit();

  list.commit();
  root.commit();

  list.beginMove();
  list.removeChildMorph(morph2);
  list.finishMove();

  assertChildMorphs(assert, list, [ morph1, morph3 ]);
  assertOrphanedMorphs(assert, [ morph2 ]);
});

QUnit.test("can clear the only morph in a MorphList", function(assert) {
  var morph1 = appendingMorph(root, "morph1");
  list.appendMorph(morph1);
  morph1.commit();
  list.commit();
  root.commit();

  list.clear();

  assertChildMorphs(assert, list, [ ]);
});

QUnit.test("can clear two morphs in a MorphList", function(assert) {
  var morph1 = appendingMorph(root, "morph1");
  list.appendMorph(morph1);
  morph1.commit();

  var morph2 = appendingMorph(root, "morph2");
  list.appendMorph(morph2);
  morph2.commit();

  list.commit();
  root.commit();

  list.clear();

  assertChildMorphs(assert, list, [ ]);
});

QUnit.test("can remove three morphs in a MorphList", function(assert) {
  var morph1 = appendingMorph(root, "morph1");
  list.appendMorph(morph1);
  morph1.commit();

  var morph2 = appendingMorph(root, "morph2");
  list.appendMorph(morph2);
  morph2.commit();

  var morph3 = appendingMorph(root, "morph3");
  list.appendMorph(morph3);
  morph3.commit();

  list.commit();
  root.commit();

  list.clear();

  assertChildMorphs(assert, list, [ ]);
});

//QUnit.test("can append a MorphList into a MorphList", function(assert) {
  //var list2 = new MorphList(dom);
  //list2.label = "list2";

  //list.appendMorph(list2);

  //assertChildMorphs(assert, list, [ list2 ]);
//});

var root;

QUnit.module("MorphList DOM Manipulation tests", {
  setup: function() {
    commonSetup();
    domSetup();
  }
});

function domSetup() {
  root = topLevelMorph("root");
  root.setMorphList(list);
}

function assertInvariants(assert) {
  assert.strictEqual(rootElement.firstChild, root.firstNode, "invariant: the root element's first child is the root's first node");
  assert.strictEqual(rootElement.lastChild, root.lastNode, "invariant: the root element's last child is the root's last node");
  assert.strictEqual(rootElement.firstChild, list.firstNode, "invariant: the root element's first child is the list's first node");
  assert.strictEqual(rootElement.lastChild, list.lastNode, "invariant: the root element's last child is the list's last node");
}

QUnit.test("appending a morph updates the DOM representation", function(assert) {
  var morph1 = appendingMorph(root, "morph1");

  list.appendMorph(morph1);
  morph1.setNode(text("hello"));
  morph1.commit();

  assert.equalHTML(rootElement, "<p>hello</p>");

  var morph2 = appendingMorph(root, "morph2");

  list.appendMorph(morph2);
  morph2.setNode(text(" world"));
  morph2.commit();

  list.commit();
  root.commit();
  assertInvariants(assert); // invariants are guaranteed after transaction is complete

  assert.equalHTML(rootElement, "<p>hello world</p>");
});

QUnit.test("prepending a morph updates the DOM representation", function(assert) {
  // create a morph with appendToParent: rootElement, nextSibling: null
  var morph1 = appendingMorph(root, "morph1");

  // append the BLANK morph to the list
  list.appendMorph(morph1);

  // set its node, allowed in APPENDING because the morph is BLANK
  morph1.setNode(text("world"));

  // finish appending the morph; sets the morph's firstNode and lastNode
  morph1.commit();

  // sanity check the HTML
  assert.equalHTML(rootElement, "<p>world</p>");

  // finalize the list and root, which sets the firstNode and lastNode
  list.commit();
  root.commit();

  // ensure that the firstNode and lastNode of root and list are what we expect
  assertInvariants(assert);

  // sanity check the HTML
  assert.equalHTML(rootElement, "<p>world</p>");

  // begin a list move transaction, transitions the list from ATTACHED to MOVING
  list.beginMove();

  // create a new morph to append into the list (whose parent element is root)
  var morph2 = morph("morph2").initForAppendingToList(list);

  // insert morph2 into the list before morph1, allowed because it's BLANK, the
  // list is MOVING, and morph2's parent is the same as the list's parent.
  list.insertBeforeMorph(morph2, morph1);

  // set its node, allowed in APPENDING because the morph is BLANK.
  morph2.setNode(text("hello "));

  // finalize the morph, transitioning it into ATTACHED
  morph2.commit();

  // finish the move transaction, transitioning it back into ATTACHED and
  // syncing the firstNode and lastNode. There are no nodes to throw away
  // in this case, but this is when we would normally do that.
  list.finishMove();

  assertInvariants(assert);

  assert.equalHTML(rootElement, "<p>hello world</p>");
});

QUnit.test("removing the last morph makes the mount point empty again", function(assert) {
  var morph1 = appendingMorph(root, "morph1");
  list.appendMorph(morph1);
  morph1.setNode(text("hello world"));

  assert.equalHTML(rootElement, "<p>hello world</p>");

  morph1.commit();
  list.commit();
  root.commit();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p>hello world</p>");

  list.beginMove();
  list.removeChildMorph(morph1);
  list.finishMove();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p><!----></p>");
});

QUnit.test("multiple nestings is allowed", function(assert) {
  var list2 = new MorphList(dom);
  list2.label = "list2";

  var middle = appendingMorph(root, "middle");
  middle.frontBoundary = true;
  middle.backBoundary = true;
  list.appendMorph(middle);

  middle.setMorphList(list2);

  var content = appendingMorph(root, "content");
  list2.appendMorph(content);
  content.setNode(text("hello world"));
  content.commit();
  list2.commit();
  middle.commit();
  list.commit();
  root.commit();

  assertInvariants(assert);

  assert.equalHTML(rootElement, "<p>hello world</p>");

  list2.beginMove();
  list2.removeChildMorph(content);
  list2.finishMove();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p><!----></p>");

  list2.beginMove();
  var content2 = appendingMorph(root, "content2");
  list2.appendMorph(content2);
  content2.setNode(text("goodbye world"));
  content2.commit();
  list2.finishMove();

  assertInvariants(assert);

  assert.equalHTML(rootElement, "<p>goodbye world</p>");
});

var list2, c1, c2, c3;

QUnit.module("Recursively updating firstNode and lastNode", {
  setup: function() {
    commonSetup();
    domSetup();

    list2 = new MorphList(dom);
    list2.label = "list2";

    var middle = appendingMorph(root, "middle");
    middle.frontBoundary = true;
    middle.backBoundary = true;
    list.appendMorph(middle);

    middle.setMorphList(list2);

    c1 = appendingMorph(root, "c1");
    list2.appendMorph(c1);
    c1.setNode(text("c1"));
    c1.commit();

    c2 = appendingMorph(root, "c2");
    list2.appendMorph(c2);
    c2.setNode(text("c2"));
    c2.commit();

    c3 = appendingMorph(root, "c3");
    list2.appendMorph(c3);
    c3.setNode(text("c3"));
    c3.commit();

    list2.commit();
    middle.commit();
    list.commit();
    root.commit();
  }
});

QUnit.test("sanity checks", function(assert) {
  assert.equalHTML(rootElement, "<p>c1c2c3</p>");
  assertInvariants(assert);
});

QUnit.test("removing the first node updates firstNode", function(assert) {
  list2.beginMove();
  list2.removeChildMorph(c1);
  list2.finishMove();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p>c2c3</p>");
});

QUnit.test("removing the last node updates lastNode", function(assert) {
  list2.beginMove();
  list2.removeChildMorph(c3);
  list2.finishMove();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p>c1c2</p>");
});

QUnit.test("removing a middle node doesn't do anything", function(assert) {
  list2.beginMove();
  list2.removeChildMorph(c2);
  list2.finishMove();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p>c1c3</p>");
});

QUnit.test("prepending a node updates firstNode", function(assert) {
  list2.beginMove();
  var c4 = morph("c4").initForAppendingToList(list2);
  list2.insertBeforeMorph(c4, c1);
  c4.setNode(text("c4"));
  c4.commit();
  list2.finishMove();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p>c4c1c2c3</p>");
});

QUnit.test("appending a node updates lastNode", function(assert) {
  list2.beginMove();
  var c4 = appendingMorph(root, "c4");
  list2.appendMorph(c4);
  c4.setNode(text("c4"));
  c4.commit();
  list2.finishMove();

  assertInvariants(assert);
  assert.equalHTML(rootElement, "<p>c1c2c3c4</p>");
});

QUnit.skip("can move a morph from one list to another", function() {
  //var list2 = new MorphList(dom);

  //var morph1 = morph("morph1");

  //list.appendMorph(morph1);
  //list2.appendMorph(morph1);

  //assertChildMorphs(assert, list, [ ]);
  //assertChildMorphs(assert, list2, [ morph1 ]);
});

QUnit.skip("moving a morph from one list to another updates firstNode", function() {
  //var list3 = new MorphList(dom);
  //var secondMiddle = morph("secondMiddle");
  //secondMiddle.setMorphList(list3);

  //list.appendMorph(secondMiddle);

  //var morph1 = morph("morph1");

  //list2.appendMorph(morph1);
  //assertInvariants(assert);

  //assertChildMorphs(assert, list2, [ c1, c2, c3, morph1 ]);

  //list3.appendMorph(morph1);
  //assertInvariants(assert);

  //assertChildMorphs(assert, list2, [ c1, c2, c3 ]);
  //assertChildMorphs(assert, list3, [ morph1 ]);
});

