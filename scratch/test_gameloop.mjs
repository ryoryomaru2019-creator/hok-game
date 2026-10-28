// Full comprehensive simulation test for game loop, renderer, and UI updates
class MockCanvas {
  constructor(w = 800, h = 600) {
    this.width = w;
    this.height = h;
  }
  getContext(type) {
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'canvas') return this;
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === 'measureText') {
          return () => ({ width: 50 });
        }
        return () => {};
      },
      set: () => true
    });
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
}

globalThis.window = {
  innerWidth: 800,
  innerHeight: 600,
  addEventListener: () => {},
  removeEventListener: () => {},
  AudioContext: class {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.sampleRate = 44100;
    }
    createGain() { return { gain: { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }; }
    createOscillator() { return { frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
    createBufferSource() { return { connect: () => {}, start: () => {}, stop: () => {} }; }
  },
  webkitAudioContext: class {}
};

globalThis.Audio = class {
  constructor() {
    this.volume = 1;
    this.loop = false;
    this.src = '';
  }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  removeEventListener() {}
};

globalThis.Path2D = class Path2D {
  constructor() {}
};

const domElements = {};
globalThis.document = {
  getElementById: (id) => {
    if (!domElements[id]) {
      const classes = new Set();
      domElements[id] = {
        id,
        classList: {
          add: (c) => classes.add(c),
          remove: (c) => classes.delete(c),
          contains: (c) => classes.has(c)
        },
        style: {},
        innerText: '',
        value: 'テスト吉',
        offsetHeight: 70,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 60, height: 60 }),
        addEventListener: () => {}
      };
    }
    return domElements[id];
  },
  createElement: (tag) => ({
    classList: { add: () => {}, remove: () => {} },
    style: {},
    appendChild: () => {},
    getContext: () => ({ fillRect: () => {}, clearRect: () => {} }),
    width: 800,
    height: 600
  }),
  documentElement: { clientWidth: 800, clientHeight: 600 },
  body: { appendChild: () => {}, clientWidth: 800, clientHeight: 600 }
};

globalThis.localStorage = {
  data: {},
  getItem: (k) => globalThis.localStorage.data[k] || null,
  setItem: (k, v) => { globalThis.localStorage.data[k] = String(v); },
  removeItem: (k) => { delete globalThis.localStorage.data[k]; }
};

globalThis.performance = { now: () => Date.now() };

async function run() {
  console.log("=== Comprehensive Game Test Started ===");
  const { Game, GAME_STATES, MODES } = await import('../src/game.js');
  const { GameRenderer } = await import('../src/renderer.js');
  
  const canvas = new MockCanvas(400, 750);
  const renderer = new GameRenderer(canvas);
  const game = new Game(canvas, renderer);

  // Test resize
  renderer.resize(400, 750);
  game.setSafeBounds(100, 600);

  for (const mode of [MODES.KAREI, MODES.HIRAME, MODES.HIRAI]) {
    console.log(`\n--- Testing Mode: ${mode} ---`);
    game.setMode(mode);
    game.startCountdown();
    game.startGameplay();
    console.log(`State: ${game.state}, TimeLeft: ${game.timeLeft}, Spawned Fishes: ${game.fishes.length}`);

    // Simulate 30 frames
    for (let f = 0; f < 30; f++) {
      game.update();
      renderer.render(game);
    }
    console.log(`Rendered 30 frames successfully. Active fishes: ${game.fishes.length}`);

    // Simulate tapping a fish
    if (game.fishes.length > 0) {
      const targetFish = game.fishes[0];
      game.handleTap(targetFish.x, targetFish.y);
      game.update();
      renderer.render(game);
      console.log(`Tapped fish (${targetFish.type}). Score: ${game.score}, Combo: ${game.combo}`);
    }

    // Simulate time-up & endGame
    game.timeLeft = 1;
    game.timeLeft--;
    game.endGame();
    console.log(`EndGame called. State: ${game.state}`);
    if (game.state !== GAME_STATES.RESULT) {
      throw new Error(`Expected state to be RESULT, got ${game.state}`);
    }

    // Render result frame
    renderer.render(game);
    console.log(`Result frame rendered without error!`);
  }

  console.log("\n=== All Tests Passed Successfully! ===");
  process.exit(0);
}

run().catch(err => {
  console.error("FATAL ERROR IN TEST:", err);
  process.exit(1);
});
