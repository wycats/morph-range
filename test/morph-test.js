import QUnit from 'qunitjs';
import Morph from 'morph-range';

import { document, /* fragment, */ element, text, domHelper } from 'support';

var root;

QUnit.module('Morph tests', {
  setup: function() {
    root = element("p", "before ");
  }
});

QUnit.test('can construct a Morph', function (assert) {
  var m = new Morph(domHelper());
  assert.ok(m, "this test is fine" );
});

QUnit.test('can setContent of a morph', function (assert) {
  var morph = new Morph(domHelper());
  morph.initForAppendingToElement(root);
  morph.commit();
  root.appendChild(text(' after'));

  assert.equalHTML(root, '<p>before <!----> after</p>', 'sanity check');

  morph.begin();
  morph.clearForRender();
  morph.setContent('Hello World');
  morph.commit();

  assert.equalHTML(root, '<p>before Hello World after</p>', 'it updated');

  morph.clear();
  assert.equalHTML(root, '<p>before <!----> after</p>', 'clear');

  var el = element('div', '\n', root, '\n');

  morph.setContent('Again');

  assert.equalHTML(el, '<div>\n<p>before Again after</p>\n</div>', 'works after appending to an element');

  morph.setContent('');
  assert.equalHTML(el, '<div>\n<p>before <!----> after</p>\n</div>', 'setting to empty');
});

QUnit.test("Appending to a BLANK morph", function(assert) {
  var dom = domHelper();
  var morph = new Morph(dom).initForAppendingToElement(root);
  assert.equalHTML(root, '<p>before </p>');
  morph.appendNode(element('span'));
  assert.equalHTML(root, '<p>before <span></span></p>');
  morph.commit();
  root.appendChild(text(' world'));
  assert.equalHTML(root, '<p>before <span></span> world</p>');
});

QUnit.test("When destroying a morph, do not explode if a parentMorph does not exist", function(assert) {
  var dom = domHelper();
  var morph = new Morph(dom).initForAppendingToElement(root);
  morph.commit();

  var morphFrag = document.createDocumentFragment();
  morphFrag.appendChild(morph.firstNode);
  assert.strictEqual(morphFrag.firstChild, morph.firstNode);
  assert.strictEqual(morphFrag.lastChild, morph.lastNode);
  morph.destroy();
  assert.strictEqual(morphFrag.firstChild, null);
});

QUnit.test("When destroying a morph, do not explode if a parentNode does not exist", function(assert) {
  var dom = domHelper();
  var morph = new Morph(dom);
  morph.destroy();
  assert.ok(true, "The test did not crash");
});

