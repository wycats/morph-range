import QUnit from 'qunitjs';
import MorphList from 'morph-range/morph-list';
import Morph from 'morph-range';

//import { document, fragment, element, comment, domHelper } from 'support';

import { domHelper, document, text, element } from 'support';

QUnit.config.autostart = false;

QUnit.module('MorphList tests', {
  setup: commonSetup
});

var dom, list;

function commonSetup() {
  dom = domHelper();
  list = new MorphList(dom);
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

    assert.ok(current.parentMorphList === null, current.label + " should not have a parent");
    assert.ok(current.nextMorph === null, current.label + " should not have a nextMorph");
    assert.ok(current.previousMorph === null, current.label + " should not have a previousMorph");
  }
}

function morph(label) {
  var el = element('p');
  var m = new Morph(dom);
  m.initForAppendingToElement(el);
  m.label = label;
  return m;
}

QUnit.test("can create a MorphList", function(assert) {
  assert.strictEqual(list.parentMorph, null);
  assert.strictEqual(list.firstChildMorph, null);
  assert.strictEqual(list.lastChildMorph, null);
});

function appendingMorph(parent, label) {
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
  var m1 = topLevelMorphWithList();

  var m2 = appendingMorph(m1, 'morph2');
  var m3 = appendingMorph(m1, 'morph3');

  list.insertBeforeMorph(m2, null);
  list.insertBeforeMorph(m3, null);

  assertChildMorphs(assert, list, [ m2, m3 ]);

  m3.finishAppend();
  m2.finishAppend();
  list.finishAppend();
  m1.finishAppend();

  assert.equal(m1.firstNode, m2.firstNode, "firstNode has synced");
  assert.equal(m1.lastNode, m3.lastNode, "lastNode has synced");
});

QUnit.test("can prepend a Morph into a MorphList", function(assert) {
  var m1 = topLevelMorphWithList();

  var m3 = appendingMorph(m1, 'morph3');

  list.appendMorph(m3);

  m3.finishAppend();
  list.finishAppend();
  m1.finishAppend();

  list.beginMove();
  var m2 = appendingMorph(m1, 'morph2');
  m2.prepareForInsertingBeforeMorph(m3); // append fast path
  list.insertBeforeMorph(m2, m3);
  m2.finishAppend();
  list.finishMove();

  assertChildMorphs(assert, list, [ m2, m3 ]);

  assert.equal(m1.firstNode, m2.firstNode, "firstNode has synced");
  assert.equal(m1.lastNode, m3.lastNode, "lastNode has synced");
});

QUnit.test("can insert a Morph into the middle of a MorphList", function(assert) {
  var root = topLevelMorphWithList();

  var m3 = appendingMorph(root, 'morph3');
  var m1 = appendingMorph(root, 'morph1');

  list.appendMorph(m1);
  m1.finishAppend();

  list.appendMorph(m3);
  m3.finishAppend();

  list.finishAppend();
  root.finishAppend();

  assert.equal(root.firstNode, m1.firstNode, "firstNode has synced");
  assert.equal(root.lastNode, m3.lastNode, "lastNode has synced");

  list.beginMove();
  var m2 = appendingMorph(root, 'morph2');
  m2.prepareForInsertingBeforeMorph(m3); // append fast path
  list.insertBeforeMorph(m2, m3);
  m2.finishAppend();
  list.finishMove();

  assertChildMorphs(assert, list, [ m1, m2, m3 ]);

  assert.equal(root.firstNode, m1.firstNode, "firstNode hasn't changed");
  assert.equal(root.lastNode, m3.lastNode, "lastNode hasn't changed");
});

QUnit.test("can move a morph from one list to another", function(assert) {
  var list2 = new MorphList(dom);

  var morph1 = morph("morph1");

  list.appendMorph(morph1);
  list2.appendMorph(morph1);

  assertChildMorphs(assert, list, [ ]);
  assertChildMorphs(assert, list2, [ morph1 ]);
});

QUnit.test("can remove the only morph in a MorphList", function(assert) {
  var morph1 = morph("morph1");

  list.appendMorph(morph1);
  list.removeChildMorph(morph1);

  assertChildMorphs(assert, list, [ ]);
  assertOrphanedMorphs(assert, [ morph1 ]);
});

QUnit.test("can remove the first morph in a MorphList", function(assert) {
  var morph1 = morph("morph1");
  var morph2 = morph("morph2");

  list.appendMorph(morph1);
  list.appendMorph(morph2);
  list.removeChildMorph(morph1);

  assertChildMorphs(assert, list, [ morph2 ]);
  assertOrphanedMorphs(assert, [ morph1 ]);
});

QUnit.test("can remove the last morph in a MorphList", function(assert) {
  var morph1 = morph("morph1");
  var morph2 = morph("morph2");

  list.appendMorph(morph1);
  list.appendMorph(morph2);
  list.removeChildMorph(morph2);

  assertChildMorphs(assert, list, [ morph1 ]);
  assert.ok(morph2.parentMorphList === null, "A removed morph doesn't still have its old parent");
});

QUnit.test("can remove a middle morph in a MorphList", function(assert) {
  var morph1 = morph("morph1");
  var morph2 = morph("morph2");
  var morph3 = morph("morph3");

  list.appendMorph(morph1);
  list.appendMorph(morph2);
  list.appendMorph(morph3);
  list.removeChildMorph(morph2);

  assertChildMorphs(assert, list, [ morph1, morph3 ]);
  assertOrphanedMorphs(assert, [ morph2 ]);
});

QUnit.test("can clear the only morph in a MorphList", function(assert) {
  var morph1 = morph("morph1");

  list.appendMorph(morph1);
  list.clear();

  assertChildMorphs(assert, list, [ ]);
  assertOrphanedMorphs(assert, [ morph1 ]);
});

QUnit.test("can clear two morphs in a MorphList", function(assert) {
  var morph1 = morph("morph1");
  var morph2 = morph("morph2");

  list.appendMorph(morph1);
  list.appendMorph(morph2);
  list.clear();

  assertChildMorphs(assert, list, [ ]);
  assertOrphanedMorphs(assert, [ morph1, morph2 ]);
});

QUnit.test("can remove three morphs in a MorphList", function(assert) {
  var morph1 = morph("morph1");
  var morph2 = morph("morph2");
  var morph3 = morph("morph3");

  list.appendMorph(morph1);
  list.appendMorph(morph2);
  list.appendMorph(morph3);
  list.clear();

  assertChildMorphs(assert, list, [ ]);
  assertOrphanedMorphs(assert, [ morph1, morph2, morph3 ]);
});

//QUnit.test("can append a MorphList into a MorphList", function(assert) {
  //var list2 = new MorphList(dom);
  //list2.label = "list2";

  //list.appendMorph(list2);

  //assertChildMorphs(assert, list, [ list2 ]);
//});

var frag, root;

QUnit.module("MorphList DOM Manipulation tests", {
  setup: function() {
    commonSetup();
    domSetup();
  }
});

function domSetup() {
  frag = document.createDocumentFragment();
  root = morph("root");
  root.appendToNode(frag);
  root.setMorphList(list);
}

function assertInvariants(assert) {
  assert.strictEqual(frag.firstChild, root.firstNode, "invariant: the fragment's first child is the root's first node");
  assert.strictEqual(frag.lastChild, root.lastNode, "invariant: the fragment's last child is the root's last node");
}

QUnit.test("appending a morph updates the DOM representation", function(assert) {
  var morph1 = morph("morph1");
  morph1.setNode(text("hello"));

  list.appendMorph(morph1);
  assertInvariants(assert);

  assert.equalHTML(frag, "hello");

  var morph2 = morph("morph2");
  morph2.setNode(text(" world"));
  list.appendMorph(morph2);
  assertInvariants(assert);

  assert.equalHTML(frag, "hello world");
});

QUnit.test("prepending a morph updates the DOM representation", function(assert) {
  var morph1 = morph("morph1");
  morph1.setNode(text("world"));

  list.appendMorph(morph1);
  assertInvariants(assert);

  assert.equalHTML(frag, "world");

  var morph2 = morph("morph2");
  morph2.setNode(text("hello "));
  list.insertBeforeMorph(morph2, morph1);
  assertInvariants(assert);

  assert.equalHTML(frag, "hello world");
});

QUnit.test("removing the last morph makes the mount point empty again", function(assert) {
  var morph1 = morph("morph1");
  morph1.setNode(text("hello world"));
  assert.equalHTML(frag, "<!---->");

  list.appendMorph(morph1);
  assertInvariants(assert);
  assert.equalHTML(frag, "hello world");

  list.removeChildMorph(morph1);
  assertInvariants(assert);
  assert.equalHTML(frag, "<!---->");
});

QUnit.test("multiple nestings is allowed", function(assert) {
  var list2 = new MorphList(dom);
  list2.label = "list2";

  var middle = morph("middle");
  middle.setMorphList(list2);

  var content = morph("content");
  content.setNode(text("hello world"));

  list.appendMorph(middle);

  list2.appendMorph(content);
  assertInvariants(assert);

  assert.equalHTML(frag, "hello world");

  list2.removeChildMorph(content);
  assertInvariants(assert);

  assert.equalHTML(frag, "<!---->");

  root.setNode(text("hello world"));
  assertInvariants(assert);

  assert.equalHTML(frag, "hello world");
});

var list2, c1, c2, c3;

QUnit.module("Recursively updating firstNode and lastNode", {
  setup: function() {
    commonSetup();
    domSetup();

    list2 = new MorphList(dom);
    list2.label = "list2";

    var middle = morph("middle");
    middle.setMorphList(list2);
    list.appendMorph(middle);

    c1 = morph("c1");
    c1.setNode(text("c1"));

    c2 = morph("c2");
    c2.setNode(text("c2"));

    c3 = morph("c3");
    c3.setNode(text("c3"));

    list2.appendMorph(c1);
    list2.appendMorph(c2);
    list2.appendMorph(c3);
  }
});

QUnit.test("sanity checks", function(assert) {
  assert.equalHTML(frag, "c1c2c3");
  assertInvariants(assert);
});

QUnit.test("removing the first node updates firstNode", function(assert) {
  list2.removeChildMorph(c1);
  assertInvariants(assert);
  assert.equalHTML(frag, "c2c3");
});

QUnit.test("removing the last node updates lastNode", function(assert) {
  list2.removeChildMorph(c3);
  assertInvariants(assert);
  assert.equalHTML(frag, "c1c2");
});

QUnit.test("removing a middle node doesn't do anything", function(assert) {
  list2.removeChildMorph(c2);
  assertInvariants(assert);
  assert.equalHTML(frag, "c1c3");
});

QUnit.test("prepending a node updates firstNode", function(assert) {
  var c4 = morph("c4");
  c4.setNode(text("c4"));

  list2.insertBeforeMorph(c4, c1);
  assertInvariants(assert);
  assert.equalHTML(frag, "c4c1c2c3");
});

QUnit.test("appending a node updates lastNode", function(assert) {
  var c4 = morph("c4");
  c4.setNode(text("c4"));

  list2.appendMorph(c4);
  assertInvariants(assert);
  assert.equalHTML(frag, "c1c2c3c4");
});

QUnit.test("moving a morph from one list to another updates firstNode", function(assert) {
  var list3 = new MorphList(dom);
  var secondMiddle = morph("secondMiddle");
  secondMiddle.setMorphList(list3);

  list.appendMorph(secondMiddle);

  var morph1 = morph("morph1");

  list2.appendMorph(morph1);
  assertInvariants(assert);

  assertChildMorphs(assert, list2, [ c1, c2, c3, morph1 ]);

  list3.appendMorph(morph1);
  assertInvariants(assert);

  assertChildMorphs(assert, list2, [ c1, c2, c3 ]);
  assertChildMorphs(assert, list3, [ morph1 ]);
});
