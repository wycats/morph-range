import QUnit from 'qunitjs';
import MorphList from 'morph-range/morph-list';
import Morph from 'morph-range';

import { /* fragment, comment, */ element, domHelper } from 'support';

var root;

QUnit.module('ported list tests', {
  setup: function() {
    root = element('div');
  }
});

QUnit.test('insertBeforeMorph adds a child morph and updates its parentMorph', function (assert) {
  var parentMorph = new Morph(domHelper()).initForAppendingToElement(root);
  var list = new MorphList();
  parentMorph.setMorphList(list);

  assert.equalHTML(root, '<div></div>', 'initial');

  var a = element('p', 'A');
  var b = element('p', 'B');
  var c = element('p', 'C');
  var d = element('p', 'D');

  // append when there is no list
  var bMorph = new Morph(parentMorph.domHelper).initForAppendingToMorph(parentMorph);
  list.appendMorph(bMorph);
  bMorph.setNode(b);
  bMorph.commit();

  assert.equalHTML(root, '<div><p>B</p></div>', 'append B');
  assert.strictEqual(list.firstChildMorph, bMorph, 'firstChildMorph to equal B morph');
  assert.strictEqual(list.lastChildMorph, bMorph, 'lastChildMorph to equal B morph');

  var dMorph = new Morph(parentMorph.domHelper).initForAppendingToMorph(parentMorph);
  list.appendMorph(dMorph);
  dMorph.setNode(d);
  dMorph.commit(d);

  assert.equalHTML(root, '<div><p>B</p><p>D</p></div>', 'append D');
  assert.strictEqual(list.firstChildMorph, bMorph, 'firstChildMorph to be unchanged');
  assert.strictEqual(list.lastChildMorph, dMorph, 'lastChildMorph to change to D morph');

  // insert before lastChildMorph
  var cMorph = new Morph(parentMorph.domHelper).initForAppendingToMorph(parentMorph);
  list.appendMorph(cMorph);
  cMorph.setNode(c);
  cMorph.commit();

  assert.equalHTML(root, '<div><p>B</p><p>D</p><p>C</p></div>', 'append C');
  assert.strictEqual(list.firstChildMorph, bMorph, 'firstChildMorph to be unchanged');
  assert.strictEqual(list.lastChildMorph, cMorph, 'lastChildMorph to be C');

  var aMorph = new Morph(parentMorph.domHelper).initForAppendingToMorph(parentMorph);
  list.appendMorph(aMorph);
  aMorph.setNode(a);
  aMorph.commit();

  assert.equalHTML(root, '<div><p>B</p><p>D</p><p>C</p><p>A</p></div>', 'append A');
  assert.strictEqual(list.firstChildMorph, bMorph, 'firstChildMorph to be unchanged');
  assert.strictEqual(list.lastChildMorph, aMorph, 'lastChildMorph to be A');

  list.commit();
  parentMorph.commit();

  assert.strictEqual(parentMorph.firstNode, root.firstChild, 'the parent morph has the right firstNode');
  assert.strictEqual(parentMorph.lastNode, root.lastChild, 'the parent morph has the right lastNode');

  list.beginMove();
  list.insertBeforeMorph(aMorph, bMorph);
  list.insertBeforeMorph(cMorph, dMorph);
  list.finishMove();

  assert.strictEqual(parentMorph.firstNode, root.firstChild, 'the parent morph has the right firstNode');
  assert.strictEqual(parentMorph.lastNode, root.lastChild, 'the parent morph has the right lastNode');
});

/*
QUnit.test('insertBeforeMorph inserts correctly when appending to the morph', function (assert) {
  var dom = domHelper();
  var parentMorph = new Morph(dom);
  var list = new MorphList();

  var insertion = comment();

  var a = element('p', 'A');
  var b = element('p', 'B');

  var frag = fragment(a, insertion, b);

  parentMorph.setContent(insertion);
  parentMorph.setMorphList(list);

  var childMorph = new Morph(dom);
  childMorph.setContent('Y');
  list.insertBeforeMorph(childMorph, null);
  assert.equalHTML(frag, '<p>A</p>Y<p>B</p>', 'appended content correctly');

  var refMorph = childMorph;
  childMorph = new Morph(dom);
  childMorph.setContent('W');
  list.insertBeforeMorph(childMorph, refMorph);
  assert.equalHTML(frag, '<p>A</p>WY<p>B</p>', 'prepended content correctly');

  childMorph = new Morph(dom);
  childMorph.setContent('X');
  list.insertBeforeMorph(childMorph, refMorph);
  assert.equalHTML(frag, '<p>A</p>WXY<p>B</p>', 'inserted content correctly');

  childMorph = new Morph(dom);
  childMorph.setContent('Z');
  list.insertBeforeMorph(childMorph, null);
  assert.equalHTML(frag, '<p>A</p>WXYZ<p>B</p>', 'inserted content correctly');
});

QUnit.test('insertContentBeforeMorph', function (assert) {
  var parentMorph = new Morph(domHelper());
  var list = new MorphList();

  var insertion = comment();

  var frag = fragment(insertion);

  parentMorph.setContent(insertion);
  parentMorph.setMorphList(list);

  var aMorph = new Morph(parentMorph.domHelper);
  var bMorph = new Morph(parentMorph.domHelper);
  var cMorph = new Morph(parentMorph.domHelper);
  var dMorph = new Morph(parentMorph.domHelper);

  aMorph.setContent('A');
  bMorph.setContent('B');
  cMorph.setContent('C');
  dMorph.setContent('D');

  list.insertBeforeMorph(bMorph, null);
  list.insertBeforeMorph(dMorph, null);
  list.insertBeforeMorph(cMorph, dMorph);
  list.insertBeforeMorph(aMorph, bMorph);

  assert.equalHTML(frag, 'ABCD', 'inserted content correctly');
  assert.equal(parentMorph.firstNode.nodeValue, 'A');
  assert.equal(parentMorph.lastNode.nodeValue, 'D');

  var a = element('p', 'A');
  var b = element('p', 'B');
  var c = element('p', 'C');
  var d = element('p', 'D');

  aMorph.setContent(a);

  assert.equalHTML(frag, '<p>A</p>BCD', 'changed list through returned A morph');
  assert.strictEqual(parentMorph.firstNode, a);
  assert.equal(parentMorph.lastNode.nodeValue, 'D');

  bMorph.setContent(b);

  assert.equalHTML(frag, '<p>A</p><p>B</p>CD', 'changed list through returned B morph');

  cMorph.setContent(c);

  assert.equalHTML(frag, '<p>A</p><p>B</p><p>C</p>D', 'changed list through returned C morph');

  dMorph.setContent(d);

  assert.equalHTML(frag, '<p>A</p><p>B</p><p>C</p><p>D</p>', 'changed list through returned D morph');

  assert.strictEqual(parentMorph.firstNode, a);
  assert.strictEqual(parentMorph.lastNode, d);
  assert.strictEqual(list.firstChildMorph, aMorph, 'firstChildMorph to change to A morph');
  assert.strictEqual(list.lastChildMorph, dMorph, 'lastChildMorph to change to D morph');

  cMorph.destroy();

  assert.equalHTML(frag, '<p>A</p><p>B</p><p>D</p>', 'C was destroyed');
  assert.strictEqual(list.firstChildMorph, aMorph, 'firstChildMorph unchanged');
  assert.strictEqual(list.lastChildMorph, dMorph, 'lastChildMorph unchanged');
  assert.strictEqual(dMorph.previousMorph, bMorph, 'D morph previousMorph is B');
  assert.strictEqual(bMorph.nextMorph, dMorph, 'B morph nextMorph is D');

  assert.strictEqual(cMorph.parentMorphList, null);
  assert.strictEqual(cMorph.firstNode, null);
  assert.strictEqual(cMorph.lastNode, null);
  assert.strictEqual(c.parentNode, null);

  aMorph.destroy();

  assert.equalHTML(frag, '<p>B</p><p>D</p>', 'A was destroyed');
  assert.strictEqual(parentMorph.firstNode, b);
  assert.strictEqual(list.firstChildMorph, bMorph, 'firstChildMorph is B');

  assert.strictEqual(aMorph.parentMorphList, null);
  assert.strictEqual(aMorph.firstNode, null);
  assert.strictEqual(aMorph.lastNode, null);
  assert.strictEqual(a.parentNode, null);

  dMorph.destroy();

  assert.equalHTML(frag, '<p>B</p>', 'D was destroyed');
  assert.strictEqual(parentMorph.lastNode, b);
  assert.strictEqual(list.lastChildMorph, bMorph, 'firstChildMorph is B');

  assert.strictEqual(dMorph.parentMorphList, null);
  assert.strictEqual(dMorph.firstNode, null);
  assert.strictEqual(dMorph.lastNode, null);
  assert.strictEqual(d.parentNode, null);

  bMorph.destroy();

  assert.strictEqual(bMorph.parentMorphList, null);
  assert.strictEqual(bMorph.firstNode, null);
  assert.strictEqual(bMorph.lastNode, null);
  assert.strictEqual(d.parentNode, null);

  assert.strictEqual(list.firstChildMorph, null, 'firstChildMorph is null');
  assert.strictEqual(list.lastChildMorph, null, 'lastChildMorph is null');

  // insert the fragment
  frag = fragment(frag);

  aMorph = new Morph(parentMorph.domHelper);
  aMorph.setNode(a);

  // ensure list still works
  list.insertBeforeMorph(aMorph, null);

  assert.equalHTML(frag, '<p>A</p>', 'detected insertion after clear');
});
*/
