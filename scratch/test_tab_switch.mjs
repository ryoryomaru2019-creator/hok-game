import { StudioApp } from '../src/studio/studioApp.js';
import { getSquidPreset } from '../src/studio/model.js';

class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classList = new Set();
    this.style = {};
    this.dataset = {};
    this._innerHTML = '';
    this.attributes = {};
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  getAttribute(k) {
    return this.attributes[k];
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
    return elements[sel] || new MockElement('div');
  }
  querySelectorAll(sel) {
    return [];
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 600, height: 100 };
  }
}

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
  '#timelineDopeSheetView': new MockElement('div'),
  '#timelineGraphView': new MockElement('div'),
  '#tabDopeSheet': new MockElement('button'),
  '#tabGraphEditor': new MockElement('button'),
  '#timelineGraphCanvasBox': new MockElement('div'),
};

globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  createElementNS: (ns, tag) => new MockElement(tag),
  querySelector: (sel) => elements[sel] || new MockElement('div'),
  querySelectorAll: () => [],
};

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

const app = Object.create(StudioApp.prototype);
app.container = new MockElement('div');
app.container.querySelector = (sel) => elements[sel] || new MockElement('div');
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

console.log('1. Initial renderTimeline (DopeSheet):');
app.renderTimeline();
console.log('Headers count:', elements['#tlHeadersList'].children.length);

console.log('\n2. Simulate tabGraph click (60Fグラフ一括切替 / グラフ表示):');
// Let's see what tabGraph click handler did:
// tabGraph click handler in studioApp.js:
const tabGraphHandler = () => {
  app.timelineMode = 'dopesheet';
  const allProps = ['pos', 'scale', 'rot', 'opacity'];
  const selIds = new Set(app.editor.selectedPartIds || []);
  if (app.editor.selectedPartId) selIds.add(app.editor.selectedPartId);
  let targetPartIds = app.character.parts.filter(p => selIds.has(p.id)).map(p => p.id);
  if (targetPartIds.length === 0) {
    targetPartIds = app.expandedTimelineParts.size > 0 
      ? Array.from(app.expandedTimelineParts)
      : (app.character.parts.length > 0 ? [app.character.parts[0].id] : []);
  }

  targetPartIds.forEach(pId => {
    app.expandedTimelineParts.add(pId);
    app.expandedTimelineTransforms.add(pId);
    allProps.forEach(prop => {
      const key = `${pId}:${prop}`;
      app.inlineGraphProps.add(key);
      if (!app.propRowHeights.has(key) || app.propRowHeights.get(key) < 80) {
        app.propRowHeights.set(key, 90);
      }
    });
  });
  app.renderTimeline();
};

try {
  tabGraphHandler();
  console.log('Success after tabGraph! Headers count:', elements['#tlHeadersList'].children.length);
} catch (e) {
  console.error('Error on tabGraph:', e);
}

console.log('\n3. Simulate tabDope click (部位別タイムライン / タイムライン表示):');
const tabDopeHandler = () => {
  app.timelineMode = 'dopesheet';
  app.inlineGraphProps.clear();
  app.renderTimeline();
};

try {
  tabDopeHandler();
  console.log('Success after tabDope! Headers count:', elements['#tlHeadersList'].children.length);
} catch (e) {
  console.error('Error on tabDope:', e);
}
