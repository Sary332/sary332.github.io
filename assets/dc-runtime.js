/* Minimal template runtime for the portfolio pages.
   Supports {{dotted.path}} holes, <sc-if value>, <sc-for list as>, onClick handlers and setState. */
(function () {
  'use strict';

  function lookup(path, scope) {
    var parts = path.trim().split('.');
    var cur;
    for (var i = 0; i < scope.length; i++) {
      if (scope[i] && Object.prototype.hasOwnProperty.call(scope[i], parts[0])) { cur = scope[i][parts[0]]; break; }
    }
    for (var j = 1; j < parts.length && cur != null; j++) cur = cur[parts[j]];
    return cur;
  }

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function interpolate(str, scope) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(p, scope);
      return v == null || v === false ? '' : String(v);
    });
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interpolate(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();

    if (tag === 'sc-if') {
      var m = WHOLE.exec(node.getAttribute('value') || '');
      if (m && lookup(m[1], scope)) renderChildren(node, scope, out);
      return;
    }
    if (tag === 'sc-for') {
      var lm = WHOLE.exec(node.getAttribute('list') || '');
      var list = lm ? lookup(lm[1], scope) : null;
      var alias = node.getAttribute('as') || 'item';
      if (list && list.length) {
        for (var i = 0; i < list.length; i++) {
          var local = {}; local[alias] = list[i];
          renderChildren(node, [local].concat(scope), out);
        }
      }
      return;
    }

    var el = node.namespaceURI === 'http://www.w3.org/1999/xhtml'
      ? document.createElement(tag)
      : document.createElementNS(node.namespaceURI, node.tagName);
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], name = at.name;
      if (name.indexOf('hint-') === 0) continue;
      if (name.slice(0, 2) === 'on') {
        var hm = WHOLE.exec(at.value);
        if (hm) { var fn = lookup(hm[1], scope); if (typeof fn === 'function') el[name.toLowerCase()] = fn; }
        continue;
      }
      el.setAttribute(name, at.value.indexOf('{{') > -1 ? interpolate(at.value, scope) : at.value);
    }
    renderChildren(node, scope, el);
    out.appendChild(el);
  }

  function renderChildren(node, scope, out) {
    for (var c = node.firstChild; c; c = c.nextSibling) renderNode(c, scope, out);
  }

  function morph(oldP, newP) {
    var o = oldP.firstChild, n = newP.firstChild;
    while (n) {
      var nextN = n.nextSibling;
      if (!o) { oldP.appendChild(n); }
      else if (o.nodeType === 3 && n.nodeType === 3) {
        if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
        o = o.nextSibling;
      } else if (o.nodeType === 1 && n.nodeType === 1 && o.tagName === n.tagName) {
        for (var i = o.attributes.length - 1; i >= 0; i--) {
          var nm = o.attributes[i].name;
          if (!n.hasAttribute(nm)) o.removeAttribute(nm);
        }
        for (var j = 0; j < n.attributes.length; j++) {
          var at = n.attributes[j];
          if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
        }
        o.onclick = n.onclick || null;
        morph(o, n);
        o = o.nextSibling;
      } else {
        oldP.replaceChild(n, o);
        o = n.nextSibling;
      }
      n = nextN;
    }
    while (o) { var rm = o; o = o.nextSibling; oldP.removeChild(rm); }
  }

  function DCLogic() { this.state = {}; this._pending = false; }
  DCLogic.prototype.setState = function (patch) {
    this.state = Object.assign({}, this.state, patch);
    if (this._mounted && !this._pending) {
      var self = this; this._pending = true;
      Promise.resolve().then(function () { self._pending = false; self._render(); });
    }
  };
  DCLogic.prototype.renderVals = function () { return {}; };
  DCLogic.prototype.navVals = function () { return {}; };
  DCLogic.prototype._render = function () {
    var vals = Object.assign({}, this.navVals(), this.renderVals());
    var out = document.createElement('div');
    renderChildren(this._tpl.content, [vals], out);
    morph(this._root, out);
  };

  window.DCLogic = DCLogic;
  window.DC = {
    mount: function (Component) {
      var root = document.getElementById('app');
      var tpl = document.getElementById('dc-tpl');
      var inst = new Component();
      inst._root = root; inst._tpl = tpl;
      inst._render();
      inst._mounted = true;
      if (inst.componentDidMount) inst.componentDidMount();
      if (inst._pending === false && inst.state) inst._render();
      window.addEventListener('pagehide', function () { if (inst.componentWillUnmount) inst.componentWillUnmount(); });
    }
  };
})();
