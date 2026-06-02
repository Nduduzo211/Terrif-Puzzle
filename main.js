const canvas = document.getElementById("Canvas");
const gl = canvas.getContext("webgl");
if (!gl) {
  alert("WebGL is not supported by your browser."); // Use alert as fallback
  throw new Error("WebGL not supported");
}

// Simple shaders for colored vertices
const vSrc =
  `
     attribute vec3 position; // Vertex position (x, y, z)
    attribute vec4 color;    // Vertex color (r, g, b, a)
    varying vec4 vColor;     // Pass color to fragment shader
    uniform mat4 projection; // Orthographic projection matrix
    uniform mat4 model;

    void main() {
        gl_Position = projection * model * vec4(position, 1.0); // Calculate final position
        vColor = color; // Pass color through
} ` ;



const fSrc = `
    precision mediump float; // Set precision
    varying vec4 vColor;     // Receive color from vertex shader
    
    void main() {
        gl_FragColor = vColor; // Set fragment color
    }`;

/** Compiles a shader from source. */
function compileShader(type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${info}`);
  }
  return shader;
}

/** Creates and links the shader program. */
function createProgram(vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader program linking error: ${info}`);
  }
  // Detach shaders after linking (optional but good practice)
  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  return program;
}

const vertexShader = compileShader(gl.VERTEX_SHADER, vSrc);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fSrc);
const shaderProgram = createProgram(vertexShader, fragmentShader);
gl.useProgram(shaderProgram); // Tell WebGL to use this program

/* ---------- Attribute & Uniform Locations ---------- */
// Get locations of attributes and uniforms defined in the shaders
const positionAttributeLocation = gl.getAttribLocation(
  shaderProgram,
  "position"
);
const colorAttributeLocation = gl.getAttribLocation(shaderProgram, "color");
const projectionUniformLocation = gl.getUniformLocation(
  shaderProgram,
  "projection"
);
const modelUniformLocation = gl.getUniformLocation(shaderProgram, "model");

// Enable vertex attributes
gl.enableVertexAttribArray(positionAttributeLocation);
gl.enableVertexAttribArray(colorAttributeLocation);

/* --------------------------------------------------
   2. Projection Matrix Setup (using glMatrix)
-------------------------------------------------- */
// Define the visible area in game units (10 wide, 20 high)
const GAME_WIDTH = 10;
const GAME_HEIGHT = 20;
const projectionMatrix = mat4.create(); // Create a 4x4 matrix
// Set up orthographic projection: left, right, bottom, top, near, far
mat4.ortho(projectionMatrix, 0, GAME_WIDTH, 0, GAME_HEIGHT, -1, 1);

/* --------------------------------------------------
   3. Game Constants, State, and DOM Elements
-------------------------------------------------- */
const COLS = 10; // Board width
const ROWS = 20; // Board height (visible area)
// Define colors for pieces (index 0 is unused, indices 1-7 match piece types)
const PIECE_COLORS = [
  [0.15, 0.15, 0.15, 1], // 0: Placeholder for empty/background
  [0.0, 1.0, 1.0, 1], // 1: I piece (Cyan)
  [1.0, 1.0, 0.0, 1], // 2: O piece (Yellow)
  [0.6, 0.0, 1.0, 1], // 3: T piece (Purple)
  [0.0, 1.0, 0.0, 1], // 4: S piece (Green)
  [1.0, 0.0, 0.0, 1], // 5: Z piece (Red)
  [0.0, 0.0, 1.0, 1], // 6: J piece (Blue)
  [1.0, 0.5, 0.0, 1], // 7: L piece (Orange)
];
const GRID_COLOR = [0.3, 0.3, 0.3, 1.0]; // Color for grid lines

// Define Tetromino shapes (indices 0-6) and their rotations (0-3)
// Each coordinate is relative to the piece's pivot point
const SHAPES = [
  /* I */ [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  ],
  /* O */ [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  /* T */ [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, -1],
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, -1],
    ],
    [
      [0, -1],
      [0, 0],
      [-1, 0],
      [0, 1],
    ],
  ],
  /* S */ [
    [
      [-1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, -1],
      [0, 0],
      [-1, 0],
      [-1, 1],
    ],
    [
      [-1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, -1],
      [0, 0],
      [-1, 0],
      [-1, 1],
    ],
  ],
  /* Z */ [
    [
      [-1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [-1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  /* J */ [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
    ],
    [
      [-1, -1],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [-1, 1],
    ],
  ], // Adjusted J rotations slightly
  /* L */ [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [-1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [-1, -1],
    ],
  ], // Adjusted L rotations slightly
];

// Game state variables
let board; // 2D array representing settled pieces (0 = empty, 1-7 = piece type)
let currentPiece; // Object: { type, rot, pos: [col, row] }
let nextPieceType; // Integer: 0-6
let score;
let level;
let linesClearedTotal;
let dropInterval; // Time between automatic drops (ms)
let dropTimer; // Accumulates time since last drop
let isGameOver;
let isPaused;
let lastFrameTime;

// DOM Elements
const scoreValueElement = document.getElementById("ScoreValue");
const levelValueElement = document.getElementById("LevelValue");
const gameOverOverlay = document.getElementById("GameOverOverlay");
const pauseOverlay = document.getElementById("PauseOverlay");
const finalScoreElement = document.getElementById("FinalScore");
const restartButton = document.getElementById("RestartButton");
const nextCanvas = document.getElementById("NextPiece");
const nextCtx = nextCanvas.getContext("2d");

/* --------------------------------------------------
   4. Game Logic Functions
-------------------------------------------------- */

/** Initializes or resets the game state. */
function resetGameState() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); // Clear board
  score = 0;
  level = 1;
  linesClearedTotal = 0;
  dropInterval = 1000; // Initial drop speed (ms)
  dropTimer = 0;
  isGameOver = false;
  isPaused = false;
  lastFrameTime = 0;

  // Generate first 'next' piece and spawn the initial current piece
  nextPieceType = Math.floor(Math.random() * SHAPES.length);
  spawnNewPiece();

  // Update UI
  updateScoreDisplay();
  updateLevelDisplay();
  drawNextPiece(); // Draw the *new* next piece
  gameOverOverlay.style.display = "none"; // Hide overlays
  pauseOverlay.style.display = "none";
}

/** Checks if a piece at a given position/rotation collides with boundaries or settled pieces. */
function collides(pieceToCheck) {
  const shape = SHAPES[pieceToCheck.type][pieceToCheck.rot];
  const [pieceCol, pieceRow] = pieceToCheck.pos;

  for (const [dx, dy] of shape) {
    const col = pieceCol + dx;
    const row = pieceRow + dy;

    // Check boundaries
    if (col < 0 || col >= COLS || row < 0) {
      return true; // Collision with wall or floor
    }
    // Check against settled pieces (only within board height)
    if (row < ROWS && board[row][col] !== 0) {
      return true; // Collision with another piece
    }
  }
  return false; // No collision
}

/** Merges the current piece onto the game board. */
function mergePiece() {
  const shape = SHAPES[currentPiece.type][currentPiece.rot];
  const [pieceCol, pieceRow] = currentPiece.pos;

  for (const [dx, dy] of shape) {
    const col = pieceCol + dx;
    const row = pieceRow + dy;
    // Ensure we only merge within the board boundaries
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      board[row][col] = currentPiece.type + 1; // Store color index (1-7)
    }
  }
}

/** Clears completed lines, updates score and level. */
function clearLines() {
  let linesClearedThisTurn = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    // Check if the row is full
    if (board[y].every((cellValue) => cellValue !== 0)) {
      // Row is full, remove it and add a new empty row at the top
      board.splice(y, 1); // Remove the full row
      board.push(Array(COLS).fill(0)); // Add empty row at top
      y++; // Re-check the same row index after the shift
      linesClearedThisTurn++;
    }
  }

  if (linesClearedThisTurn > 0) {
    // Update score based on lines cleared (simple scoring)
    const points = [0, 100, 300, 500, 800]; // Points for 0, 1, 2, 3, 4 lines
    score += points[linesClearedThisTurn] * level; // Score increases with level
    linesClearedTotal += linesClearedThisTurn;

    // Update level based on total lines cleared
    const newLevel = Math.floor(linesClearedTotal / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      // Increase drop speed (decrease interval), with a minimum speed
      dropInterval = Math.max(100, 1000 - (level - 1) * 75);
      updateLevelDisplay();
    }
    updateScoreDisplay();
  }
}

/** Spawns a new piece at the top center. */
function spawnNewPiece() {
  currentPiece = {
    type: nextPieceType,
    rot: 0,
    pos: [Math.floor(COLS / 2) - 1, ROWS - 2], // Start near top-center
  };
  // Generate the *next* piece type
  nextPieceType = Math.floor(Math.random() * SHAPES.length);
  drawNextPiece(); // Update the preview

  // Check for immediate collision (Game Over condition)
  if (collides(currentPiece)) {
    isGameOver = true;
    finalScoreElement.textContent = score;
    gameOverOverlay.style.display = "block";
  }
}

/** Updates the score display in the HTML. */
function updateScoreDisplay() {
  scoreValueElement.textContent = score;
}

/** Updates the level display in the HTML. */
function updateLevelDisplay() {
  levelValueElement.textContent = level;
}

/** Draws the next piece preview on the 2D canvas. */
function drawNextPiece() {
  const cellSize = 20; // Size of each block in the preview
  const shape = SHAPES[nextPieceType][0]; // Use the default rotation
  const pieceColor = PIECE_COLORS[nextPieceType + 1];
  const colorString = `rgba(${pieceColor[0] * 255}, ${pieceColor[1] * 255}, ${
    pieceColor[2] * 255
  }, 1)`;

  // Calculate centering offset
  let minX = 2,
    maxX = -2,
    minY = 2,
    maxY = -2;
  shape.forEach(([dx, dy]) => {
    minX = Math.min(minX, dx);
    maxX = Math.max(maxX, dx);
    minY = Math.min(minY, dy);
    maxY = Math.max(maxY, dy);
  });
  const shapeWidth = (maxX - minX + 1) * cellSize;
  const shapeHeight = (maxY - minY + 1) * cellSize;
  const offsetX = (nextCanvas.width - shapeWidth) / 2 - minX * cellSize;
  const offsetY = (nextCanvas.height - shapeHeight) / 2 - minY * cellSize;

  // Clear the preview canvas
  nextCtx.fillStyle = "#000"; // Black background
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  // Draw the blocks of the next piece
  nextCtx.fillStyle = colorString;
  for (const [dx, dy] of shape) {
    // Draw block, adjusting y-coordinate for canvas (0,0 is top-left)
    nextCtx.fillRect(
      offsetX + dx * cellSize,
      offsetY + (1 - dy) * cellSize, // Invert dy for canvas coords, adjust pivot
      cellSize - 1, // Leave 1px gap
      cellSize - 1
    );
  }
}

/** Toggles the pause state. */
function togglePause() {
  if (isGameOver) return; // Cannot pause if game over
  isPaused = !isPaused;
  pauseOverlay.style.display = isPaused ? "block" : "none";
  if (!isPaused) {
    // Reset lastFrameTime when unpausing to avoid large deltaTime jump
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop); // Resume loop if unpaused
  }
}

/* --------------------------------------------------
   5. Input Handling
-------------------------------------------------- */
const keyState = {}; // Keep track of currently pressed keys
let keyHandled = {}; // Prevent rapid repeats for movement/rotation

document.addEventListener("keydown", (e) => {
  if (!keyState[e.code]) {
    // Handle initial press
    keyHandled[e.code] = false; // Mark as not handled yet for this press
  }
  keyState[e.code] = true;

  // Handle pause toggle immediately on keydown
  if (e.code === "KeyP") {
    togglePause();
    keyHandled[e.code] = true; // Prevent pause toggle in update loop
  }

  // Prevent default browser action for game keys
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "KeyP",
    ].includes(e.code)
  ) {
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  keyState[e.code] = false;
  keyHandled[e.code] = false; // Reset handled flag on key up
});

// Add event listener for the restart button
restartButton.addEventListener("click", () => {
  resetGameState();
  requestAnimationFrame(gameLoop); // Start loop after reset
});

/** Processes player input based on current key state. */
function handleInput() {
  if (isPaused || isGameOver) return; // Don't handle input if paused or game over

  // Left Movement
  if (keyState["ArrowLeft"] && !keyHandled["ArrowLeft"]) {
    const testPiece = {
      ...currentPiece,
      pos: [currentPiece.pos[0] - 1, currentPiece.pos[1]],
    };
    if (!collides(testPiece)) {
      currentPiece = testPiece;
    }
    keyHandled["ArrowLeft"] = true; // Mark as handled for this frame/press
  }

  // Right Movement
  if (keyState["ArrowRight"] && !keyHandled["ArrowRight"]) {
    const testPiece = {
      ...currentPiece,
      pos: [currentPiece.pos[0] + 1, currentPiece.pos[1]],
    };
    if (!collides(testPiece)) {
      currentPiece = testPiece;
    }
    keyHandled["ArrowRight"] = true;
  }

  // Rotation
  if (keyState["ArrowUp"] && !keyHandled["ArrowUp"]) {
    const originalRotation = currentPiece.rot;
    const testPiece = { ...currentPiece, rot: (currentPiece.rot + 1) % 4 }; // Try next rotation

    if (!collides(testPiece)) {
      currentPiece = testPiece; // Simple rotation works
    } else {
      // Basic Wall Kick Attempt (Try moving left/right by 1)
      const kicks = [-1, 1]; // Offsets to try
      let kicked = false;
      for (const kick of kicks) {
        const kickedPos = {
          ...testPiece,
          pos: [testPiece.pos[0] + kick, testPiece.pos[1]],
        };
        if (!collides(kickedPos)) {
          currentPiece = kickedPos; // Apply kick and rotation
          kicked = true;
          break;
        }
      }
      // Add more sophisticated wall kick logic (SRS) here if needed
    }
    keyHandled["ArrowUp"] = true;
  }

  // Soft Drop
  if (keyState["ArrowDown"]) {
    // Allow holding for faster soft drop
    dropTimer += 50; // Increase drop timer faster when holding down
    // Optional: Add scoring for soft drop distance if desired
  }

  // Hard Drop
  if (keyState["Space"] && !keyHandled["Space"]) {
    let testPiece = { ...currentPiece };
    // Move down until collision
    while (
      !collides({ ...testPiece, pos: [testPiece.pos[0], testPiece.pos[1] - 1] })
    ) {
      testPiece.pos[1]--;
    }
    currentPiece = testPiece; // Move piece to final position
    mergePiece(); // Merge immediately
    clearLines(); // Clear lines
    spawnNewPiece(); // Spawn next piece
    dropTimer = 0; // Reset drop timer
    keyHandled["Space"] = true;
  }
}


/* --------------------------------------------------
   6. Rendering Logic
-------------------------------------------------- */
const vertexBuffer = gl.createBuffer(); // Single buffer for all blocks and grid
const indexBuffer = gl.createBuffer();

/** Helper to push vertices for a colored quad into a data array. */
function pushQuadVertices(vertexData, indexData, x, y, width, height, color, offset) {
  const r = color[0];
  const g = color[1];
  const b = color[2];
  const a = color[3];
  // x, y, z, r, g, b, a (7 floats per vertex)
  // Triangle 1
  vertexData.push(x, y, 0, r, g, b, a);
  vertexData.push(x + width, y, 0, r, g, b, a);
  vertexData.push(x + width, y + height, 0, r, g, b, a);
  vertexData.push(x, y + height, 0, r, g, b, a);
  // Triangle 2
indexData.push(offset, offset + 1, offset + 2);
indexData.push(offset, offset + 2, offset + 3);
}

/** Builds the vertex data array for the current frame. */
function buildVertexData() {
  const vertexData = []; // Array to hold [x, y, z, r, g, b, a, ...]
  const indexData = [];
  let vertexOffset = 0;
  const GRID_LINE_WIDTH = 0.03; // Width of grid lines in game units

  // Draw Grid Lines (optional, can be disabled for performance)
  // Vertical lines
  for (let x = 0; x <= COLS; x++) {
    pushQuadVertices(
      vertexData,
      indexData,
      x - GRID_LINE_WIDTH / 2,
      0,
      GRID_LINE_WIDTH,
      ROWS,
      GRID_COLOR,
      vertexOffset
    );
    vertexOffset += 4;
  }
  // Horizontal lines
  for (let y = 0; y <= ROWS; y++) {
    pushQuadVertices(
      vertexData,
      indexData,
      0,
      y - GRID_LINE_WIDTH / 2,
      COLS,
      GRID_LINE_WIDTH,
      GRID_COLOR,
      vertexOffset
    );
    vertexOffset += 4;
  }

  // Draw Settled Pieces on the Board
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== 0) {
        // If cell is occupied
        const color = PIECE_COLORS[board[y][x]];
        pushQuadVertices(vertexData, indexData, x, y, 1, 1, color, vertexOffset); // Draw 1x1 block
        vertexOffset += 4;
      }
    }
  }

  // Draw Current Falling Piece (if game not over)
  if (!isGameOver && currentPiece) {
    const shape = SHAPES[currentPiece.type][currentPiece.rot];
    const [pieceCol, pieceRow] = currentPiece.pos;
    const color = PIECE_COLORS[currentPiece.type + 1];

    for (const [dx, dy] of shape) {
      pushQuadVertices(vertexData, indexData , pieceCol + dx, pieceRow + dy,  1, 1, color, vertexOffset);
      vertexOffset += 4;
    }
  }

  return {
    verteces: new Float32Array(vertexData),
    indices: new Uint16Array(indexData)
  };
}

/** Renders the scene for the current frame. */
function render() {
  // Build vertex data for the current state
  const mesh = buildVertexData();
  const vertexData = mesh.verteces;
  const indexData = mesh.indices;

  // Buffer the new vertex data
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  // Use DYNAMIC_DRAW because vertex data changes frequently
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.DYNAMIC_DRAW);


  // Specify vertex layout (stride and offsets)
  const stride = 7 * Float32Array.BYTES_PER_ELEMENT; // 7 floats per vertex (xyz rgba)
  const positionOffset = 0;
  const colorOffset = 3 * Float32Array.BYTES_PER_ELEMENT; // Color starts after 3 position floats

  gl.vertexAttribPointer(
    positionAttributeLocation,
    3,
    gl.FLOAT,
    false,
    stride,
    positionOffset
  );
  gl.vertexAttribPointer(
    colorAttributeLocation,
    4,
    gl.FLOAT,
    false,
    stride,
    colorOffset
  );

  // Set projection matrix uniform
  gl.uniformMatrix4fv(projectionUniformLocation, false, projectionMatrix);
  
  const modelMatrix = mat4.create();

  gl.uniformMatrix4fv(modelUniformLocation, false, modelMatrix);

  // Clear canvas and set viewport
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.05, 0.05, 0.1, 1.0); // Dark background color
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Draw everything (grid + blocks)
  const vertexCount = vertexData.length / 7; // 7 floats per vertex
  gl.drawElements(gl.TRIANGLES, indexData.length, gl.UNSIGNED_SHORT, 0);
}

/* --------------------------------------------------
   7. Game Loop
-------------------------------------------------- */
function gameLoop(currentTime) {
  if (isGameOver) {
    // Stop the loop if game is over
    console.log("Game Over - Loop stopped.");
    return;
  }
  if (isPaused) {
    // Skip update and render if paused, but keep requesting frames
    // to check for unpause.
    requestAnimationFrame(gameLoop);
    return;
  }

  // Calculate delta time (time since last frame)
  if (!lastFrameTime) {
    lastFrameTime = currentTime; // Initialize on first frame
  }
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  // --- Update Game State ---
  // Handle player input
  handleInput();

  // Automatic piece drop
  dropTimer += deltaTime;
  if (dropTimer >= dropInterval) {
    dropTimer = 0; // Reset timer
    const testPiece = {
      ...currentPiece,
      pos: [currentPiece.pos[0], currentPiece.pos[1] - 1],
    };
    if (!collides(testPiece)) {
      currentPiece = testPiece; // Move piece down
    } else {
      // Piece has landed
      mergePiece();
      clearLines();
      spawnNewPiece(); // Spawn next piece (checks for game over)
      // If spawn caused game over, the flag is set, and loop will exit next frame
    }
  }

  // --- Render Scene ---
  render();

  // Request next frame
  requestAnimationFrame(gameLoop);
}

/* --------------------------------------------------
   8. Initialization
-------------------------------------------------- */
function initGame() {
  console.log("Initializing Tetris...");
  resetGameState(); // Set up initial board, score, piece, etc.
  requestAnimationFrame(gameLoop); // Start the game loop
  console.log("Game loop started.");
}

// Start the game when the script loads
initGame();
