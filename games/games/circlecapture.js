// Circle Capture — real-time territory control
// Click on hex cells to claim territory, expanding circles push opponents' zones.

initGame({
  title: "Circle Capture",
  tag: "claim · expand · dominate",
  fullscreen: true,
  presets: [
    { label: "Normal", values: [24, 60] },
    { label: "Quick", values: [16, 40] },
    { label: "Extended", values: [32, 80] },
  ],
  buttons: [
    { id: "btn-new", label: "New round", primary: true, onClick: () => newGame() },
    { id: "btn-surrender", label: "Surrender", onClick: () => surrender() },
  ],
  sliders: [
    { id: "s-cells", label: "Grid size", min: 16, max: 40, step: 1, fmt: v => v + "×" + v },
    { id: "s-time", label: "Round time", min: 30, max: 120, step: 10, fmt: v => v + " s" },
  ],
  onPreset: ([cells, time]) => { CELL_SIZE = cells; ROUND_TIME = time; clamp(); saveState(); syncSliderUI(); newGame(); },
  onSlider: (id, v) => {
    if (id === "s-cells") CELL_SIZE = v;
    else ROUND_TIME = v;
  },
  onClamp: clamp,
  getSliderValues: () => ({ "s-cells": CELL_SIZE, "s-time": ROUND_TIME }),
  info: {
    anim: infoAnim,
    title: "How to play",
    text: [
      "Click/tap hex cells to claim territory. Expanding circles push opponent zones.",
      "More territory = higher score. Last player standing wins each round.",
      "Multiplayer: create a room and invite friends, or join an existing room."
    ],
  },
});

let CELL_SIZE = 24;
let ROUND_TIME = 60;
let PLAYER_COUNT = 2;
let currentPlayer = 0;
let gameTime = 0;
let gameOver = false;
let winner = null;
let territory = [];
let playerColors = [];
let playerScores = [];
let hexGrid = [];
let previewHexes = [];

const HEX_W = 30;
const HEX_H = 32;

const COLORS = {
  P1: PAL.mint,
  P2: PAL.sky,
  P3: PAL.rose,
  P4: PAL.sun,
  P5: PAL.lilac,
  P6: PAL.aqua,
};

function clamp() { PLAYER_COUNT = Math.min(6, Math.max(2, PLAYER_COUNT)); }

function newGame() {
  clearInterval(roundTimer);
  clearParticles();
  gameOver = false;
  winner = null;
  gameTime = 0;
  currentPlayer = 0;
  
  // Initialize hex grid
  const cols = Math.floor(width / HEX_W);
  const rows = Math.floor(height / HEX_H);
  hexGrid = [];
  for (let x = 0; x < cols; x++) {
    hexGrid[x] = [];
    for (let y = 0; y < rows; y++) {
      hexGrid[x][y] = {
        x: x * HEX_W,
        y: y * HEX_H,
        claimed: null,
        claimRadius: 0,
        pulse: Math.random() * Math.PI * 2,
      };
    }
  }
  
  // Initialize territory based on player count
  territory = [];
  for (let i = 0; i < hexGrid.length; i++) {
    territory[i] = [];
    for (let j = 0; j < hexGrid[i].length; j++) {
      territory[i][j] = Math.floor(Math.random() * PLAYER_COUNT);
    }
  }
  
  // Generate player colors
  playerColors = [];
  playerScores = Array(PLAYER_COUNT).fill(0);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const baseColor = COLORS[`P${i + 1}`];
    const color = [...baseColor];
    playerColors.push(color);
  }
  
  setStatus(`Round starting...`, null);
  roundTimer = setInterval(updateRound, 1000);
}

function updateRound() {
  gameTime++;
  setStatus(`${ROUND_TIME - gameTime}s remaining`, null);
  
  // Update claim radii based on territory
  for (let x = 0; x < hexGrid.length; x++) {
    for (let y = 0; y < hexGrid[x].length; y++) {
      const hex = hexGrid[x][y];
      const playerId = territory[x][y];
      
      if (playerId !== null) {
        // Calculate control strength by counting neighboring hexes
        let control = 1;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx;
            const ny = y + dy;
            if (territory[nx] && territory[nx][ny] === playerId) {
              control++;
            }
          }
        }
        
        // Update claim radius
        const targetRadius = control * 8;
        hex.claimRadius += (targetRadius - hex.claimRadius) * 0.1;
        
        // Update score
        playerScores[playerId] = Math.floor(hex.claimRadius / 10);
        
        // Pulse based on control strength
        hex.pulse += control * 0.05;
      }
    }
  }
  
  // Check for winner
  if (gameTime >= ROUND_TIME) {
    endRound();
  }
}

function endRound() {
  clearInterval(roundTimer);
  gameOver = true;
  
  // Find winner
  let maxScore = -1;
  winner = null;
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (playerScores[i] > maxScore) {
      maxScore = playerScores[i];
      winner = i;
    }
  }
  
  if (winner !== null) {
    setStatus(`Player ${winner + 1} wins!`, "solved");
    celebrate(Math.min(3, winner + 1));
  } else {
    setStatus("Draw!", null);
  }
}

function surrender() {
  if (gameOver) return;
  clearInterval(roundTimer);
  gameOver = true;
  setStatus("You surrendered!", "dead");
}

function draw() {
  background(...PAL.board);
  
  // Draw hex grid with Liquid Glass effects
  for (let x = 0; x < hexGrid.length; x++) {
    for (let y = 0; y < hexGrid[x].length; y++) {
      const hex = hexGrid[x][y];
      const playerId = territory[x][y];
      
      if (playerId !== null) {
        const color = playerColors[playerId];
        
        // Draw hex with glow effect
        push();
        translate(hex.x, hex.y);
        rotate(hex.pulse * 0.3);
        
        // Liquid glass glow
        noFill();
        stroke(color[0], color[1], color[2], 40 + Math.sin(frameCount * 0.005 + hex.pulse) * 20);
        strokeWeight(2);
        
        // Draw hex with liquid glass effect
        beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI * 2 / 6;
          const radius = HEX_W / 2 - hex.claimRadius + Math.sin(frameCount * 0.01 + i) * 3;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          vertex(px, py);
        }
        endShape(CLOSE);
        
        // Inner fill with transparency
        noStroke();
        fill(color[0], color[1], color[2], 30);
        beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI * 2 / 6;
          const radius = HEX_W / 2 * 0.8 - hex.claimRadius;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          vertex(px, py);
        }
        endShape(CLOSE);
        
        // Text label showing claim strength
        fill(255, 255, 255);
        textAlign(CENTER, CENTER);
        textSize(12);
        textStyle(BOLD);
        text(playerScores[playerId], 0, hex.claimRadius + 15);
        
        pop();
      } else {
        // Empty hex
        push();
        translate(hex.x, hex.y);
        noStroke();
        fill(...PAL.well, 60);
        beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI * 2 / 6;
          const px = Math.cos(angle) * HEX_W / 2;
          const py = Math.sin(angle) * HEX_W / 2;
          vertex(px, py);
        }
        endShape(CLOSE);
        
        // Add subtle liquid animation
        noFill();
        stroke(...PAL.lilac, 30);
        strokeWeight(1);
        beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI * 2 / 6 + frameCount * 0.01;
          const radius = HEX_W / 2 * 0.4 + Math.sin(frameCount * 0.02 + angle) * 4;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          vertex(px, py);
        }
        endShape(CLOSE);
        pop();
      }
    }
  }
  
  drawParticles();
  
  // UI overlay
  if (gameOver) {
    drawBoardOverlay(width / 2, height / 2, width - 40, 120, winner !== null ? `Player ${winner + 1} wins!` : "Draw!", `${ROUND_TIME}s round • ${playerScores.map(s => s).join(" · ")} points`, winner !== null ? playerColors[winner] : PAL.muted);
  }
}

function mousePressed() {
  if (gameOver) {
    newGame();
    return;
  }
  
  // Check if click is on hex grid
  const col = Math.floor(mouseX / HEX_W);
  const row = Math.floor(mouseY / HEX_H);
  
  if (territory[col] && territory[col][row] !== undefined) {
    // Claim this hex for current player
    territory[col][row] = currentPlayer;
    spawnBurst(mouseX, mouseY, {
      count: 8,
      speed: [2, 4],
      life: [80, 120],
      size: [3, 6],
      col: playerColors[currentPlayer],
    });
    
    // Switch player
    currentPlayer = (currentPlayer + 1) % PLAYER_COUNT;
    setStatus(`Player ${currentPlayer + 1}'s turn`, null);
  }
}

function keyPressed() {
  if (key === ' ') {
    newGame();
    return false;
  }
}

function infoAnim(p, w, h, frame) {
  p.background(...PAL.board);
  p.noStroke();
  
  // Animated hex grid demonstration
  const hexSize = 20;
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 6; y++) {
      const px = w / 2 - 120 + x * hexSize * 1.7;
      const py = h / 2 - 60 + y * hexSize * 1.4;
      
      const color = [150 + Math.sin(frame * 0.05 + x) * 50,
                     100 + Math.cos(frame * 0.07 + y) * 50,
                     200 + Math.sin(frame * 0.03 + (x + y)) * 50];
      
      p.fill(...color, 40);
      p.beginShape();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI * 2 / 6 + frame * 0.02;
        const radius = hexSize * 0.8 + Math.sin(frame * 0.1 + i) * 5;
        const vx = px + Math.cos(angle) * radius;
        const vy = py + Math.sin(angle) * radius;
        p.vertex(vx, vy);
      }
      p.endShape(p.CLOSE);
    }
  }
  
  // Text description
  p.fill(...PAL.ink);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(20);
  p.text("Claim hexes to expand your territory!", w / 2, h / 2 - 40);
  p.textSize(14);
  p.textStyle(p.NORMAL);
  p.text("Each claim pushes opponent's zones over time", w / 2, h / 2 + 20);
}

function drawCircleCapture(p, w, h) {
  previewBg(p, w, h);
  
  // Preview: show a few hexes with different claim states
  const hexSize = 30;
  const centerX = w / 2;
  const centerY = h / 2;
  
  // Empty hex
  p.fill(...PAL.well, 60);
  p.beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI * 2 / 6;
    const px = centerX - hexSize * 0.7 + Math.cos(angle) * hexSize * 0.5;
    const py = centerY - hexSize * 0.7 + Math.sin(angle) * hexSize * 0.5;
    p.vertex(px, py);
  }
  p.endShape(p.CLOSE);
  
  // Claimed hex for player 1 (mint) with static animation
  p.fill(...PAL.mint, 40);
  p.beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI * 2 / 6;
    const radius = hexSize * 0.5 + Math.sin(i * 0.5) * 8;
    const px = centerX + hexSize * 0.7 + Math.cos(angle) * radius;
    const py = centerY - hexSize * 0.7 + Math.sin(angle) * radius;
    p.vertex(px, py);
  }
  p.endShape(p.CLOSE);
  
  // Claimed hex for player 2 (sky) with static animation
  p.fill(...PAL.sky, 40);
  p.beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI * 2 / 6;
    const radius = hexSize * 0.5 + Math.sin(i * 0.3 + Math.PI) * 8;
    const px = centerX + hexSize * 1.4 + Math.cos(angle) * radius;
    const py = centerY + hexSize * 0.7 + Math.sin(angle) * radius;
    p.vertex(px, py);
  }
  p.endShape(p.CLOSE);
  
  // Add claim strength indicators
  p.fill(255, 255, 255);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(16);
  p.text("3", centerX - hexSize * 0.3, centerY - hexSize * 0.2);
  p.text("7", centerX + hexSize * 1.0, centerY + hexSize * 0.5);
  
  // Add multiplayer indicator
  p.textSize(12);
  p.textStyle(p.NORMAL);
  p.text("Real-time 2-6 players", w / 2, h / 2 + 60);
}