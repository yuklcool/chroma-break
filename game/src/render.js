// Drawing only: the world's state and the current screen in, pixels out. The
// 960x640 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Neon glow, a starfield, canvas text for the HUD
// and the panels. Text that holds a number is rebuilt only when the number
// changes, so a frame allocates nothing.

import { COLOURS, FIELD, FONT, LIVES, PALETTE, PRISM } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 118, line: 32, bottom: 76 };
const HEART = '\u2665';

/** The starfield: fixed stars, drawn once per frame from a constant seed. */
function makeStars() {
  let a = 1337;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({ x: next() * FIELD.width, y: next() * FIELD.height, size: 0.6 + next() * 1.6, alpha: 0.25 + next() * 0.55 });
  }
  return stars;
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next.toLocaleString('en-US');
    }
    return text;
  };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  const stars = makeStars();
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const levelLabel = cachedLabel('LEVEL ');
  const finalLabel = cachedLabel('Score ');
  const bestLineLabel = cachedLabel('Best ');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    view.ratio = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a pointer's client coordinates to playfield coordinates. */
  function screenToField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = view.scale / view.ratio;
    return {
      x: (clientX - rect.left - view.x / view.ratio) / scale,
      y: (clientY - rect.top - view.y / view.ratio) / scale,
    };
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawBackground() {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of stars) {
      context.globalAlpha = star.alpha;
      context.fillStyle = '#cbd5e1';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    context.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 120; x < FIELD.width; x += 120) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
  }

  function drawPrisms(state) {
    for (const prism of state.prisms) {
      if (!prism.alive) continue;
      const colour = COLOURS[prism.colour];
      context.save();
      context.shadowColor = colour;
      context.shadowBlur = prism.steel ? 4 : 14;
      context.fillStyle = colour;
      roundRect(context, prism.x, prism.y, prism.width, prism.height, 6);
      context.fill();
      context.restore();
      // Glossy top edge.
      context.fillStyle = 'rgba(255, 255, 255, 0.35)';
      roundRect(context, prism.x + 4, prism.y + 3, prism.width - 8, 5, 2);
      context.fill();
      if (prism.steel) {
        context.fillStyle = 'rgba(15, 23, 42, 0.55)';
        context.beginPath();
        context.arc(prism.x + 12, prism.y + prism.height / 2, 3, 0, Math.PI * 2);
        context.arc(prism.x + prism.width - 12, prism.y + prism.height / 2, 3, 0, Math.PI * 2);
        context.fill();
      }
      if (prism.flash > 0) {
        context.globalAlpha = Math.min(1, prism.flash / PRISM.flashSeconds);
        context.fillStyle = '#ffffff';
        roundRect(context, prism.x, prism.y, prism.width, prism.height, 6);
        context.fill();
        context.globalAlpha = 1;
      }
    }
  }

  function drawPaddle(state) {
    const paddle = state.paddle;
    const spark = state.sparks[0];
    const colour = spark ? COLOURS[spark.colour] : COLOURS.cyan;
    const y = 600;
    context.save();
    context.shadowColor = colour;
    context.shadowBlur = 18;
    context.fillStyle = colour;
    roundRect(context, paddle.x, y, paddle.width, 16, 8);
    context.fill();
    context.restore();
    context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    roundRect(context, paddle.x + 6, y + 3, paddle.width - 12, 4, 2);
    context.fill();
  }

  function drawSparks(state) {
    for (const spark of state.sparks) {
      const colour = COLOURS[spark.colour];
      for (let index = spark.trail.length - 1; index >= 0; index -= 1) {
        const point = spark.trail[index];
        context.globalAlpha = 0.28 * (1 - index / spark.trail.length);
        context.fillStyle = colour;
        context.beginPath();
        context.arc(point.x, point.y, 8 * (1 - index / spark.trail.length) + 2, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.save();
      context.shadowColor = colour;
      context.shadowBlur = 20;
      context.fillStyle = colour;
      context.beginPath();
      context.arc(spark.x, spark.y, 8, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(spark.x, spark.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = COLOURS[particle.colour] || '#ffffff';
      context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    context.globalAlpha = 1;
  }

  function drawPowerups(state) {
    for (const drop of state.powerups) {
      const def = { wide: { label: 'WIDE', colour: '#22d3ee' }, multi: { label: 'x3', colour: '#f472b6' }, slow: { label: 'SLOW', colour: '#fbbf24' }, life: { label: '+1', colour: '#4ade80' } }[drop.kind];
      context.save();
      context.shadowColor = def.colour;
      context.shadowBlur = 10;
      context.fillStyle = '#0f172a';
      roundRect(context, drop.x - 30, drop.y - 13, 60, 26, 13);
      context.fill();
      context.restore();
      context.strokeStyle = def.colour;
      context.lineWidth = 2;
      roundRect(context, drop.x - 30, drop.y - 13, 60, 26, 13);
      context.stroke();
      text(def.label, drop.x, drop.y + 6, 15, def.colour, 'center', true);
    }
  }

  function drawHud(state, best) {
    context.textBaseline = 'alphabetic';
    text(scoreLabel(state.score), 24, 38, 26, PALETTE.text, 'left', true);
    text(bestLabel(best), 24, 64, 16, PALETTE.muted, 'left');
    text(levelLabel(state.level), FIELD.width / 2, 38, 26, PALETTE.text, 'center', true);
    text(state.levelName, FIELD.width / 2, 64, 16, PALETTE.muted, 'center');
    // Lives as hearts, top right: filled for lives left, dim for lost ones.
    const totalHearts = Math.max(LIVES, state.lives);
    let heartX = FIELD.width - 24;
    for (let life = totalHearts - 1; life >= 0; life -= 1) {
      const filled = life < state.lives;
      text(HEART, heartX, 40, 26, filled ? '#f87171' : '#334155', 'right', true);
      heartX -= 30;
    }
    // Combo meter under the level name.
    const comboText = state.multiplier > 1 ? `COMBO x${state.multiplier}` : 'COMBO x1';
    text(comboText, FIELD.width / 2, 108, 16, state.multiplier > 1 ? PALETTE.gold : PALETTE.muted, 'center', true);
    const barWidth = 120;
    const barX = FIELD.width / 2 - barWidth / 2;
    context.fillStyle = '#1e293b';
    roundRect(context, barX, 116, barWidth, 7, 3);
    context.fill();
    const progress = state.multiplier >= 8 ? 1 : (state.streak % 3) / 3;
    if (progress > 0) {
      context.fillStyle = PALETTE.gold;
      roundRect(context, barX, 116, barWidth * progress, 7, 3);
      context.fill();
    }
    // Current spark colour chip, bottom left of the HUD row.
    const spark = state.sparks[0];
    if (spark) {
      const colour = COLOURS[spark.colour];
      context.save();
      context.shadowColor = colour;
      context.shadowBlur = 10;
      context.fillStyle = colour;
      context.beginPath();
      context.arc(FIELD.width - 24 - 8, 64, 8, 0, Math.PI * 2);
      context.fill();
      context.restore();
      text(`SPARK ${spark.colour.toUpperCase()}`, FIELD.width - 24 - 22, 70, 16, colour, 'right', true);
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 15, 26, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, y, PANEL.width, height, 16);
    context.stroke();
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.gold, 'center', true);
  }

  function drawTitle(state, best) {
    const lines = [
      'Match the spark to the prism to break it.',
      'A wrong colour bounces off — and breaks your combo.',
      'Tap Space or click mid-flight to switch the spark colour.',
      'Steel prisms never break. Clear the board to advance.',
      'Move: mouse or \u2190 \u2192  ·  Launch: Space or click  ·  Pause: P  ·  Mute: M',
    ];
    const lineTop = 176;
    const lineHeight = 30;
    const linesEnd = lineTop + lines.length * lineHeight;
    const legendY = linesEnd + 20;
    const bestY = legendY + 80;
    const promptY = bestY + 34;
    const height = promptY + 30;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 15, 26, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, y, PANEL.width, height, 16);
    context.stroke();
    text('CHROMA', FIELD.width / 2, y + 76, 58, PALETTE.text, 'center', true);
    text('BREAK', FIELD.width / 2, y + 132, 58, PALETTE.gold, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + lineTop + index * lineHeight, 19, PALETTE.muted, 'center');
    }
    // Colour legend: the three prisms and the spark they match.
    const names = ['cyan', 'magenta', 'amber'];
    for (let index = 0; index < 3; index += 1) {
      const cx = FIELD.width / 2 + (index - 1) * 150;
      context.save();
      context.shadowColor = COLOURS[names[index]];
      context.shadowBlur = 12;
      context.fillStyle = COLOURS[names[index]];
      roundRect(context, cx - 32, y + legendY, 64, 26, 6);
      context.fill();
      context.restore();
      text(names[index].toUpperCase(), cx, y + legendY + 48, 15, COLOURS[names[index]], 'center', true);
    }
    text(bestLabel(best), FIELD.width / 2, y + bestY, 20, PALETTE.muted, 'center');
    text('Press Space or click to start', FIELD.width / 2, y + promptY, 22, PALETTE.gold, 'center', true);
  }

  function drawField(state) {
    drawBackground();
    drawPrisms(state);
    drawParticles(state);
    drawPowerups(state);
    drawPaddle(state);
    drawSparks(state);
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, extra) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The prisms will wait for you.'], 'Press P or Space to resume');
    } else if (screen === SCREEN_CLEAR) {
      const bonus = extra && extra.clearBonus ? extra.clearBonus : state.clearBonus;
      drawPanel(`Level ${state.level} clear!`, [`Bonus +${bonus.toLocaleString('en-US')}`, `Next: ${extra && extra.nextName ? extra.nextName : 'the next board'}`], 'Get ready…');
    } else if (screen === SCREEN_OVER) {
      const lines = [finalLabel(state.score), bestLineLabel(best)];
      if (extra && extra.newBest) lines.push('NEW BEST!');
      drawPanel('Game over', lines, 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      const lines = [finalLabel(state.score), bestLineLabel(best)];
      if (extra && extra.newBest) lines.push('NEW BEST!');
      drawPanel('You cleared every level!', lines, 'Press Space or click to play again');
    } else if (screen === SCREEN_PLAY && state.sparks.length > 0 && state.sparks[0].stuck) {
      text('Press Space or click to launch', FIELD.width / 2, 540, 22, PALETTE.gold, 'center', true);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToField };
}
