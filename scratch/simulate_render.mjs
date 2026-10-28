class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classList = new Set();
    this.style = {};
    this.dataset = {};
    this._innerHTML = '';
  }
  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
  }
  get innerHTML() {
    return this._innerHTML;
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
  }
  addEventListener() {}
  removeEventListener() {}
  querySelector(sel) {
    return new MockElement('div');
  }
  querySelectorAll(sel) {
    return [];
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 600, height: 100 };
  }
}

globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  createElementNS: (ns, tag) => new MockElement(tag),
  querySelector: () => new MockElement('div'),
  querySelectorAll: () => [],
};

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

import { StudioApp } from '../src/studio/studioApp.js';
import { getSquidPreset } from '../src/studio/model.js';

const container = new MockElement('div');
const elements = {
  '#tlHeadersList': new MockElement('div'),
  '#tlTracksList': new MockElement('div'),
  '#tlTracksScroll': new MockElement('div'),
  '#timelineRulerBar': new MockElement('div'),
  '#tlLeftPane': new MockElement('div'),
  '#tlExtScrollbar': new MockElement('div'),
  '#tlExtScrollDummy': new MockElement('div'),
  '#tlPlayheadLine': new MockElement('div'),
  '#tlCtiHead': new MockElement('div'),
  '#tlFrameScrub': new MockElement('div'),
  '#tlSecDisp': new MockElement('div'),
  '#timelineScrubber': new MockElement('input'),
};

container.querySelector = (sel) => elements[sel] || new MockElement('div');

const app = Object.create(StudioApp.prototype);
app.container = container;
app.character = getSquidPreset();
app.currentMotion = 'swim';
app.currentFrame = 5;
app.totalFrames = 60;
app.timelineMode = 'dopesheet';
app.expandedTimelineParts = new Set();
app.expandedTimelineTransforms = new Set();
app.timelineAspectLocked = new Map();
app.stopwatchState = new Map();
app.inlineGraphProps = new Set();
app.propRowHeights = new Map();
app.selectedKeyframes = [];
app.editor = {
  selectedPartId: 'squid_mantle',
  selectedPartIds: new Set(['squid_mantle']),
  render: () => {},
  renderOverlay: () => {},
  getSelectedPart: () => app.character.parts.find(p => p.id === 'squid_mantle'),
};

console.log('Testing real StudioApp.renderDopeSheet()...');
app.renderDopeSheet();
console.log('SUCCESS!');
console.log('tlHeadersList children count:', elements['#tlHeadersList'].children.length);
console.log('tlTracksList children count:', elements['#tlTracksList'].children.length);
elements['#tlHeadersList'].children.forEach((c, idx) => {
  console.log(` Row ${idx + 1}: class="${c.className}" data-part-id="${c.dataset.partId || ''}" data-prop="${c.dataset.propType || ''}" text="${c.textContent || ''}"`);
});
