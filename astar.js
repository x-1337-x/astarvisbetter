const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 800;

let GRID_WIDTH = 20;
let GRID_HEIGHT = 20;

const TILE_WIDTH = 16;
const TILE_HEIGHT = 16;

let CELL_WIDTH = CANVAS_WIDTH / GRID_WIDTH;
let CELL_HEIGHT = CANVAS_HEIGHT / GRID_HEIGHT;

let CELL_BORDER = Math.floor(CELL_WIDTH / 20);

let startNode;
let endNode;

const DIAGONAL_COST = 14;
const LINEAR_COST = 10;

const DEBUG = false;

const WEIGHTS = {
  Road: 10,
  Grass: 50,
  Swamp: 150,
  Mountain: 1000,
};

const WEIGHT_COLORS = {
  [WEIGHTS.Mountain]: "gray",
  [WEIGHTS.Road]: "gold",
  [WEIGHTS.Grass]: "lightgreen",
  [WEIGHTS.Swamp]: "brown",
};

let tileset;
let tilesetGrass;
let tilesetMountain;
let tilesetRoad;
let tilesetWater;

class Tile {
  constructor(samples) {
    this.samples = samples;
  }

  getSample(index) {
    if (index !== undefined) {
      return this.samples[index % this.samples.length];
    }

    return this.samples[Math.floor(Math.random() * this.samples.length)];
  }

  draw(x, y, index) {
    const [tileX, tileY] = this.getSample(index);

    gameCtx.drawImage(
      tileset,
      TILE_WIDTH * tileX,
      TILE_HEIGHT * tileY,
      TILE_WIDTH,
      TILE_HEIGHT,
      x * CELL_WIDTH,
      y * CELL_HEIGHT,
      CELL_WIDTH,
      CELL_HEIGHT
    );
  }
}

const R = WEIGHTS.Road;
const G = WEIGHTS.Grass;
const S = WEIGHTS.Swamp;
const M = WEIGHTS.Mountain;

const MMM = {
  [WEIGHTS.Road]: "R",
  [WEIGHTS.Grass]: "G",
  [WEIGHTS.Swamp]: "S",
  [WEIGHTS.Mountain]: "M",
};

const roadWithRules = {
  "G-G-G-G-G-G-G-G": new Tile([[15, 3]]),
  "G-G-G-R-G-G-G-G": new Tile([[16, 3]]),
  "G-G-G-R-G-G-G-R": new Tile([[17, 3]]),
  "G-G-G-G-G-G-G-R": new Tile([[18, 3]]),
  "G-G-G-G-G-R-G-G": new Tile([[15, 0]]),
  "G-R-G-G-G-R-G-G": new Tile([[15, 1]]),
  "G-R-G-G-G-G-G-G": new Tile([[15, 2]]),
};

const mountainWithRules = {
  "M-M-M-M-M-M-M-M": new Tile([[1, 5]]),
  "G-G-G-M-M-M-G-G": new Tile([[0, 4]]),
  "G-G-G-M-M-M-M-M": new Tile([[1, 4]]),
  "G-G-G-G-G-M-M-M": new Tile([[2, 4]]),
  "M-M-G-G-G-M-M-M": new Tile([[2, 5]]),
  "M-M-G-G-G-G-G-M": new Tile([[2, 6]]),
  "M-M-M-M-G-G-G-M": new Tile([[1, 6]]),
  "G-M-M-M-G-G-G-G": new Tile([[0, 6]]),
  "G-M-M-M-M-M-G-G": new Tile([[0, 5]]),
};

const grassTile = new Tile([
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
]);

const roadTile = new Tile([[20, 1]]);
const mountainTile = new Tile([[22, 5]]);
const swampTile = new Tile([[8, 11]]);
const startTile = new Tile([[21, 4]]);
const endTile = new Tile([[22, 4]]);

function preloadImage(src) {
  return new Promise(function preload(resolve, reject) {
    console.log("loading..", src);

    const img = new Image();
    img.src = src;
    img.onload = function onImgload() {
      console.log("loaded", src);
      resolve(img);
    };
    img.onerror = function onImgError() {
      console.log("failed", src);
      reject();
    };
  });
}

async function preload() {
  tileset = await preloadImage("./punyworld-overworld-tileset.png");
  tilesetGrass = await preloadImage("./tileset-grass.png");
  tilesetMountain = await preloadImage("./tileset-mountain.png");
  tilesetRoad = await preloadImage("./tileset-road.png");
  tilesetWater = await preloadImage("./tileset-water.png");

  WEIGHT_TILESET = {
    [WEIGHTS.Grass]: tilesetGrass,
    [WEIGHTS.Mountain]: tilesetMountain,
    [WEIGHTS.Road]: tilesetRoad,
    [WEIGHTS.Swamp]: tilesetWater,
  };
}

function distance(p1, p2) {
  //   return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)) * 10;
  const horizontal = Math.abs(p1.x - p2.x);
  const vertical = Math.abs(p1.y - p2.y);
  const diagonal = Math.min(horizontal, vertical);
  const linear = Math.max(horizontal, vertical) - diagonal;

  const result = diagonal * DIAGONAL_COST + linear * LINEAR_COST;
  //   console.log(p1, p2, result);

  return result;
}

class PQ {
  constructor() {
    this.items = [];
  }

  enqueue(item, priority) {
    this.items.push({ item, priority });
    this.items.sort((a, b) => {
      return a.priority - b.priority;
    });
  }

  dequeue() {
    return this.items.shift();
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

const wait = (time) => new Promise((r) => setTimeout(r, time));

class Graph {
  constructor(proximity) {
    this.nodes = new Map();
  }

  addNode(n, data) {
    this.nodes.set(n, { data, neighbors: new Set() });
  }

  async astar(start, end) {
    const open = new Set([start]);
    const closed = new Set();
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();

    this.nodes.forEach((value, key) => {
      gScore.set(key, Infinity);
      fScore.set(key, Infinity);
    });

    gScore.set(start, 0);
    fScore.set(start, distance(startNode, endNode));

    while (open.size) {
      const nodes = Array.from(open.values());
      nodes.sort((a, b) => {
        return fScore.get(a) - fScore.get(b);
      });
      const current = nodes[0];

      if (current === end) {
        const steps = [end];
        let cur = end;
        while (cameFrom.has(cur)) {
          cur = cameFrom.get(cur);
          steps.unshift(cur);
        }

        return steps;
      }

      open.delete(current);
      closed.add(current);

      for (const neighbor of this.nodes.get(current).neighbors.values()) {
        const neighborData = this.nodes.get(neighbor).data;
        const weight = grid[neighborData.y][neighborData.x].weight;
        const g = gScore.get(current) + weight;
        const h = distance(neighborData, endNode);
        if (g < gScore.get(neighbor)) {
          DEBUG && (await wait(25));
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, g);
          fScore.set(neighbor, g + h);
          if (!open.has(neighbor)) {
            open.add(neighbor);
          }
        }
        if (DEBUG) {
          drawGrid();
          drawStats(gScore, fScore);
        }
      }
    }

    return null;
  }
}

let graph = new Graph();
let grid;

const NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

function buildGraph() {
  graph = new Graph();

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const node = `${x}-${y}`;
      graph.addNode(node, { x, y });
    }
  }

  // calculate neighbors
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const node = `${x}-${y}`;
      for (let n = 0; n < NEIGHBORS.length; n++) {
        const xx = x + NEIGHBORS[n][0];
        const yy = y + NEIGHBORS[n][1];
        if (yy < 0 || yy >= GRID_HEIGHT || xx < 0 || xx >= GRID_WIDTH) {
          continue;
        }

        const nnode = `${xx}-${yy}`;
        graph.nodes.get(node).neighbors.add(nnode);
      }
    }
  }
}

const gameCanvas = document.getElementById("game-canvas");
const gameCtx = gameCanvas.getContext("2d");
gameCtx.imageSmoothingEnabled = false;
gameCtx.font = "normal 20px monospace";
gameCtx.textBaseline = "middle";

const roadCanvas = document.getElementById("road-canvas");
const roadCtx = roadCanvas.getContext("2d");
roadCtx.imageSmoothingEnabled = false;

const grassCanvas = document.getElementById("grass-canvas");
const grassCtx = grassCanvas.getContext("2d");
grassCtx.imageSmoothingEnabled = false;

const mountainCanvas = document.getElementById("mountain-canvas");
const mountainCtx = mountainCanvas.getContext("2d");
mountainCtx.imageSmoothingEnabled = false;

const waterCanvas = document.getElementById("water-canvas");
const waterCtx = waterCanvas.getContext("2d");
waterCtx.imageSmoothingEnabled = false;

function drawTile(x, y, tileX, tileY) {
  gameCtx.drawImage(
    tileset,
    TILE_WIDTH * tileX,
    TILE_HEIGHT * tileY,
    TILE_WIDTH,
    TILE_HEIGHT,
    x * CELL_WIDTH,
    y * CELL_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT
  );
}

function drawGrid() {
  gameCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const { weight, tileX, tileY } = grid[y][x];
      const ts = WEIGHT_TILESET[weight];

      gameCtx.drawImage(
        ts,
        tileX * 16,
        tileY * 16,
        16,
        16,
        x * CELL_WIDTH,
        y * CELL_HEIGHT,
        CELL_WIDTH,
        CELL_HEIGHT
      );

      // gameCtx.fillRect(
      //   x * CELL_WIDTH + CELL_BORDER,
      //   y * CELL_HEIGHT + CELL_BORDER,
      //   CELL_WIDTH - CELL_BORDER * 2,
      //   CELL_HEIGHT - CELL_BORDER * 2
      // );
      // if (grid[y][x] === WEIGHTS.Grass) {
      //   grassTile.draw(x, y);
      // } else if (grid[y][x] === WEIGHTS.Swamp) {
      //   swampTile.draw(x, y);
      // } else if (grid[y][x] === WEIGHTS.Road) {
      //   roadTile.draw(x, y);
      // } else if (grid[y][x] === WEIGHTS.Mountain) {
      //   mountainTile.draw(x, y);
      // } else {

      // }
    }
  }

  startTile.draw(startNode.x, startNode.y);
  // ctx.fillStyle = "red";
  // ctx.fillRect(
  //   startNode.x * CELL_WIDTH + CELL_BORDER,
  //   startNode.y * CELL_HEIGHT + CELL_BORDER,
  //   CELL_WIDTH - CELL_BORDER * 2,
  //   CELL_HEIGHT - CELL_BORDER * 2
  // );

  endTile.draw(endNode.x, endNode.y);
  // ctx.fillStyle = "blue";
  // ctx.fillRect(
  //   endNode.x * CELL_WIDTH + CELL_BORDER,
  //   endNode.y * CELL_HEIGHT + CELL_BORDER,
  //   CELL_WIDTH - CELL_BORDER * 2,
  //   CELL_HEIGHT - CELL_BORDER * 2
  // );
  drawHighlight();
}

function drawStats(gScore, fScore) {
  gameCtx.fillStyle = "#000";
  for (const node of Array.from(fScore.keys())) {
    const [x, y] = node.split("-");

    const f = fScore.get(node);
    const g = gScore.get(node);
    const h = f - g;

    if (f === Infinity) {
      continue;
    }

    gameCtx.font = "normal 20px monospace";

    gameCtx.textAlign = "left";
    gameCtx.fillText(
      h === Infinity ? "∞" : h,
      x * CELL_WIDTH + 2,
      y * CELL_HEIGHT + 2 + CELL_HEIGHT / 4
    );

    gameCtx.textAlign = "right";
    gameCtx.fillText(
      g === Infinity ? "∞" : g,
      x * CELL_WIDTH + CELL_WIDTH - 2,
      y * CELL_HEIGHT + 2 + CELL_HEIGHT / 4
    );

    gameCtx.textAlign = "center";
    gameCtx.font = "normal 30px monospace";
    gameCtx.fillText(
      f === Infinity ? "∞" : f,
      x * CELL_WIDTH + CELL_WIDTH / 2,
      y * CELL_HEIGHT + 2 + (CELL_HEIGHT / 4) * 3
    );
  }
}

let mode = "drawing";
let mouseDown = false;
let currentWeight = "Grass";
const gameHighlight = {
  show: false,
  x: 0,
  y: 0,
};

function getGridCoord(canvas, pageX, pageY, cellWidth, cellHeight) {
  const rect = canvas.getBoundingClientRect();

  const xx = pageX - rect.x;
  const yy = pageY - rect.y;

  const x = Math.floor(xx / cellWidth);
  const y = Math.floor(yy / cellHeight);

  return { x, y };
}

function draw(e) {
  const { pageX, pageY } = e;

  const { x, y } = getGridCoord(
    gameCanvas,
    pageX,
    pageY,
    CELL_WIDTH,
    CELL_HEIGHT
  );

  if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
    if (mode === "drawing") {
      grid[y][x].tileX = activeTool.x;
      grid[y][x].tileY = activeTool.y;
      grid[y][x].weight = activeTool.weight;
    } else if (mode === "start") {
      startNode.x = x;
      startNode.y = y;
    } else if (mode === "end") {
      endNode.x = x;
      endNode.y = y;
    }

    drawGrid();

    save();
  }
}

function drawHighlight() {
  if (gameHighlight.show) {
    gameCtx.strokeStyle = "#00000099";
    gameCtx.lineWidth = 2;
    gameCtx.strokeRect(
      gameHighlight.x * CELL_WIDTH,
      gameHighlight.y * CELL_HEIGHT,
      CELL_WIDTH,
      CELL_HEIGHT
    );
  }
}

document.addEventListener("mousedown", function (e) {
  e.stopPropagation();

  draw(e);

  mouseDown = true;

  drawing = true;
});

document.addEventListener("mouseup", function (e) {
  e.stopPropagation();

  mouseDown = false;
});

gameCanvas.addEventListener("mousemove", function (e) {
  e.stopPropagation();

  const { x, y } = getGridCoord(
    gameCanvas,
    e.pageX,
    e.pageY,
    CELL_WIDTH,
    CELL_HEIGHT
  );
  gameHighlight.show = true;
  gameHighlight.x = x;
  gameHighlight.y = y;

  if (mouseDown) {
    draw(e);
  } else {
    drawGrid();
  }
});

gameCanvas.addEventListener("mouseleave", function (e) {
  gameHighlight.show = false;
  drawGrid();
});

document.getElementById("solve").addEventListener("click", function (e) {
  buildGraph();
  solve();
});

document.getElementById("Draw").addEventListener("click", function (e) {
  mode = "drawing";
});

document.getElementById("Start").addEventListener("click", function (e) {
  mode = "start";
});

document.getElementById("End").addEventListener("click", function (e) {
  mode = "end";
});

document.getElementById("Reset").addEventListener("click", function (e) {
  reset();
  save();
});

async function solve() {
  const shortestPath = await graph.astar(
    `${startNode.x}-${startNode.y}`,
    `${endNode.x}-${endNode.y}`
  );

  if (shortestPath) {
    gameCtx.fillStyle = "#4c88ff";
    for (const n of shortestPath) {
      const node = graph.nodes.get(n);

      gameCtx.fillRect(
        node.data.x * CELL_WIDTH + 5,
        node.data.y * CELL_HEIGHT + 5,
        CELL_WIDTH - 10,
        CELL_HEIGHT - 10
      );
    }
  }
}

function reset() {
  startNode = { x: 3, y: 3 };
  endNode = { x: 16, y: 16 };

  grid = new Array(GRID_HEIGHT).fill(0);
  for (let y = 0; y < GRID_HEIGHT; y++) {
    grid[y] = new Array(GRID_WIDTH).fill(0);
    for (let x = 0; x < GRID_WIDTH; x++) {
      grid[y][x] = {
        tileX: 0,
        tileY: 0,
        weight: WEIGHTS.Grass,
      };
    }
  }

  drawGrid();
}

const storageKey = "astar";
const VERSION = 2;

function save() {
  const payload = {
    version: VERSION,
    startNode,
    endNode,
    grid,
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
  console.log("saving..", payload);
}

function load() {
  const value = localStorage.getItem(storageKey);
  if (!value) {
    return;
  }

  try {
    const data = JSON.parse(value);
    if (data?.version !== VERSION) {
      localStorage.removeItem(storageKey);
      return;
    }
    console.log("loaded", data);
    grid = data.grid;
    startNode = data.startNode;
    endNode = data.endNode;

    GRID_HEIGHT = data.grid.length;
    GRID_WIDTH = data.grid[0].length;
    CELL_WIDTH = CANVAS_WIDTH / GRID_WIDTH;
    CELL_HEIGHT = CANVAS_HEIGHT / GRID_HEIGHT;
    CELL_BORDER = Math.floor(CELL_WIDTH / 20);

    drawGrid();
  } catch (e) {
    localStorage.removeItem(storageKey);
  }
}

const activeTool = {
  ctx: roadCtx,
  canvas: roadCanvas,
  tilset: tilesetRoad,
  x: 0,
  y: 0,
  weight: WEIGHTS.Road,
};

let highlightTool = {
  show: false,
  ctx: roadCtx,
  x: 0,
  y: 0,
};

let WEIGHT_TILESET;

roadCanvas.addEventListener("click", function (e) {
  const { x, y } = getGridCoord(roadCanvas, e.pageX, e.pageY, 16 * 2, 16 * 2);

  activeTool.tilset = tilesetRoad;
  activeTool.canvas = roadCanvas;
  activeTool.ctx = roadCtx;
  activeTool.x = x;
  activeTool.y = y;
  activeTool.weight = WEIGHTS.Road;

  mode = "drawing";

  drawToolbar();
});

grassCanvas.addEventListener("click", function (e) {
  const { x, y } = getGridCoord(grassCanvas, e.pageX, e.pageY, 16 * 2, 16 * 2);

  activeTool.tilset = tilesetGrass;
  activeTool.canvas = grassCanvas;
  activeTool.ctx = grassCtx;
  activeTool.x = x;
  activeTool.y = y;
  activeTool.weight = WEIGHTS.Grass;

  mode = "drawing";

  drawToolbar();
});

mountainCanvas.addEventListener("click", function (e) {
  const { x, y } = getGridCoord(
    mountainCanvas,
    e.pageX,
    e.pageY,
    16 * 2,
    16 * 2
  );

  activeTool.tilset = tilesetMountain;
  activeTool.canvas = mountainCanvas;
  activeTool.ctx = mountainCtx;
  activeTool.x = x;
  activeTool.y = y;
  activeTool.weight = WEIGHTS.Mountain;

  mode = "drawing";

  drawToolbar();
});

waterCanvas.addEventListener("click", function (e) {
  const { x, y } = getGridCoord(waterCanvas, e.pageX, e.pageY, 16 * 2, 16 * 2);

  activeTool.tilset = tilesetWater;
  activeTool.canvas = waterCanvas;
  activeTool.ctx = waterCtx;
  activeTool.x = x;
  activeTool.y = y;
  activeTool.weight = WEIGHTS.Swamp;

  mode = "drawing";

  drawToolbar();
});

roadCanvas.addEventListener("mousemove", function (e) {
  const { x, y } = getGridCoord(roadCanvas, e.pageX, e.pageY, 16 * 2, 16 * 2);

  highlightTool.show = true;
  highlightTool.ctx = roadCtx;
  highlightTool.x = x;
  highlightTool.y = y;

  drawToolbar();
});

grassCanvas.addEventListener("mousemove", function (e) {
  const { x, y } = getGridCoord(grassCanvas, e.pageX, e.pageY, 16 * 2, 16 * 2);

  highlightTool.show = true;
  highlightTool.ctx = grassCtx;
  highlightTool.x = x;
  highlightTool.y = y;

  drawToolbar();
});

mountainCanvas.addEventListener("mousemove", function (e) {
  const { x, y } = getGridCoord(
    mountainCanvas,
    e.pageX,
    e.pageY,
    16 * 2,
    16 * 2
  );

  highlightTool.show = true;
  highlightTool.ctx = mountainCtx;
  highlightTool.x = x;
  highlightTool.y = y;

  drawToolbar();
});

waterCanvas.addEventListener("mousemove", function (e) {
  const { x, y } = getGridCoord(waterCanvas, e.pageX, e.pageY, 16 * 2, 16 * 2);

  highlightTool.show = true;
  highlightTool.ctx = waterCtx;
  highlightTool.x = x;
  highlightTool.y = y;

  drawToolbar();
});

roadCanvas.addEventListener("mouseleave", function (e) {
  highlightTool.show = false;
});
grassCanvas.addEventListener("mouseleave", function (e) {
  highlightTool.show = false;
});
mountainCanvas.addEventListener("mouseleave", function (e) {
  highlightTool.show = false;
});
waterCanvas.addEventListener("mouseleave", function (e) {
  highlightTool.show = false;
});

function drawToolbar() {
  roadCtx.drawImage(tilesetRoad, 0, 0, 64, 64, 0, 0, 64, 64);
  mountainCtx.drawImage(tilesetMountain, 0, 0, 80, 48, 0, 0, 80, 48);
  grassCtx.drawImage(tilesetGrass, 0, 0, 48, 48, 0, 0, 48, 48);
  waterCtx.drawImage(tilesetWater, 0, 0, 192, 48, 0, 0, 192, 48);

  const { ctx, x, y } = activeTool;

  ctx.strokeStyle = "#ff000099";
  ctx.lineWidth = 1;
  ctx.strokeRect(x * 16, y * 16, 16, 16);

  if (highlightTool.show) {
    const { ctx, x, y } = highlightTool;
    ctx.strokeStyle = "#ffffff99";
    ctx.lineWidth = 1;
    ctx.strokeRect(x * 16, y * 16, 16, 16);
  }
}

preload().then(function onpreload() {
  reset();
  load();
  save();
  drawGrid();
  drawToolbar();
});
