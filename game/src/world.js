// The game's rules and state, with no drawing and no browser in it: the paddle,
// the spark (ball), the coloured prisms, the particles, the falling power-ups,
// collisions, colour matching, combo, score, lives and levels. step() advances
// one fixed step and returns what happened as bit flags, so the caller can
// react (sound, announcements, screen changes) without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.

import {
  CLEAR_BONUS,
  COLOUR_LETTER,
  COLOUR_ORDER,
  COMBO,
  FIELD,
  LEVELS,
  LIVES,
  MAX_LIVES,
  PADDLE,
  POWERUP,
  PRISM,
  SPARK,
} from './config.js';

export const EVENT_PADDLE = 1;
export const EVENT_BREAK = 2;
export const EVENT_MISMATCH = 4;
export const EVENT_STEEL = 8;
export const EVENT_LOST = 16;
export const EVENT_OVER = 32;
export const EVENT_CLEAR = 64;
export const EVENT_POWERUP = 128;

/** Left edge of the brick block, centred in the field. */
const BRICK_LEFT = (FIELD.width - (PRISM.cols * PRISM.width + (PRISM.cols - 1) * PRISM.gapX)) / 2;
const BRICK_WIDTH = PRISM.cols * PRISM.width + (PRISM.cols - 1) * PRISM.gapX;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createWorld(random) {
  const paddle = { x: 0, width: PADDLE.width, wideTimer: 0 };
  const sparks = [];
  const prisms = [];
  const particles = [];
  const powerups = [];
  const state = {
    paddle,
    sparks,
    prisms,
    particles,
    powerups,
    score: 0,
    streak: 0,
    multiplier: 1,
    lives: LIVES,
    level: 1,
    levelName: LEVELS[0].name,
    slowTimer: 0,
    shake: 0,
    clearBonus: 0,
    elapsed: 0,
    cycleCooldown: 0,
  };

  function sparkSpeed() {
    const base = Math.min(SPARK.baseSpeed + SPARK.speedPerLevel * (state.level - 1), SPARK.maxSpeed);
    return state.slowTimer > 0 ? base * SPARK.slowScale : base;
  }

  function paddleWidth() {
    return paddle.wideTimer > 0 ? PADDLE.width * PADDLE.wideScale : PADDLE.width;
  }

  function newSpark() {
    return {
      x: paddle.x + paddle.width / 2,
      y: PADDLE.y - SPARK.radius - 2,
      vx: 0,
      vy: 0,
      colour: COLOUR_ORDER[0],
      stuck: true,
      trail: [],
    };
  }

  function loadLevel(level) {
    const def = LEVELS[level - 1];
    prisms.length = 0;
    powerups.length = 0;
    particles.length = 0;
    state.level = level;
    state.levelName = def.name;
    state.slowTimer = 0;
    paddle.wideTimer = 0;
    for (let row = 0; row < def.rows.length; row += 1) {
      const line = def.rows[row];
      for (let col = 0; col < line.length; col += 1) {
        const letter = line[col];
        if (letter === '.' || letter === undefined) continue;
        const colour = COLOUR_LETTER[letter];
        prisms.push({
          x: BRICK_LEFT + col * (PRISM.width + PRISM.gapX),
          y: PRISM.top + row * (PRISM.height + PRISM.gapY),
          width: PRISM.width,
          height: PRISM.height,
          colour,
          steel: colour === 'steel',
          alive: true,
          flash: 0,
          rowSpeed: def.moving ? (row % 2 === 0 ? 1 : -1) * (22 + row * 7) : 0,
        });
      }
    }
    sparks.length = 0;
    sparks.push(newSpark());
  }

  function reset() {
    state.score = 0;
    state.streak = 0;
    state.multiplier = 1;
    state.lives = LIVES;
    state.clearBonus = 0;
    state.elapsed = 0;
    state.shake = 0;
    paddle.x = (FIELD.width - PADDLE.width) / 2;
    paddle.width = PADDLE.width;
    loadLevel(1);
  }

  function launchSpark(spark) {
    if (!spark.stuck) return;
    const speed = sparkSpeed();
    spark.vx = (random() - 0.5) * 160;
    spark.vy = -Math.sqrt(Math.max(speed * speed - spark.vx * spark.vx, 10000));
    spark.stuck = false;
  }

  function launch() {
    let launched = false;
    for (const spark of sparks) {
      if (spark.stuck) {
        launchSpark(spark);
        launched = true;
      }
    }
    return launched;
  }

  /**
   * Switch every flying spark to its next colour (the player's mid-flight
   * choice). Rate-limited so it is a timed decision, not a free re-roll.
   */
  function cycleColours() {
    if (state.cycleCooldown > 0) return false;
    let changed = false;
    for (const spark of sparks) {
      if (!spark.stuck) {
        cycleSparkColour(spark);
        changed = true;
      }
    }
    if (changed) state.cycleCooldown = 0.4;
    return changed;
  }

  function burst(x, y, colour, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 260;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.45 + random() * 0.45,
        maxLife: 0.9,
        colour,
        size: 2 + random() * 4,
      });
    }
  }

  function pickPowerupKind() {
    let total = 0;
    for (const def of POWERUP.kinds) total += def.weight;
    let roll = random() * total;
    for (const def of POWERUP.kinds) {
      roll -= def.weight;
      if (roll <= 0) return def.kind;
    }
    return 'wide';
  }

  function maybeDropPowerup(x, y) {
    if (random() > POWERUP.dropChance) return;
    let kind = pickPowerupKind();
    if (kind === 'life' && state.lives >= MAX_LIVES) kind = 'wide';
    powerups.push({ x, y, kind, vy: POWERUP.fallSpeed });
  }

  function breakPrism(prism, spark) {
    prism.alive = false;
    state.streak += 1;
    state.multiplier = Math.min(1 + Math.floor(state.streak / COMBO.perStep), COMBO.maxMultiplier);
    state.score += PRISM.points * state.multiplier;
    burst(prism.x + prism.width / 2, prism.y + prism.height / 2, prism.colour, 14);
    if (state.streak >= 6) state.shake = Math.min(7, state.shake + 3);
    maybeDropPowerup(prism.x + prism.width / 2, prism.y + prism.height / 2);
    return breakableLeft() === 0;
  }

  function breakableLeft() {
    let count = 0;
    for (const prism of prisms) if (prism.alive && !prism.steel) count += 1;
    return count;
  }

  /** Break every remaining breakable prism at once (level-clear staging). */
  function clearBoard() {
    let gained = 0;
    for (const prism of prisms) {
      if (!prism.alive || prism.steel) continue;
      prism.alive = false;
      gained += PRISM.points * state.multiplier;
      burst(prism.x + prism.width / 2, prism.y + prism.height / 2, prism.colour, 6);
    }
    state.score += gained;
    state.clearBonus = CLEAR_BONUS.perLevel * state.level + CLEAR_BONUS.perLife * state.lives;
    state.score += state.clearBonus;
  }

  /** Break one prism of the spark's colour, for staging a busy play scene. */
  function forceBreakOne() {
    const spark = sparks[0];
    if (!spark) return false;
    for (const prism of prisms) {
      if (prism.alive && !prism.steel && prism.colour === spark.colour) {
        breakPrism(prism, spark);
        return true;
      }
    }
    return false;
  }

  function applyPowerup(kind) {
    if (kind === 'wide') {
      paddle.wideTimer = PADDLE.wideSeconds;
    } else if (kind === 'slow') {
      state.slowTimer = SPARK.slowSeconds;
    } else if (kind === 'life') {
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
    } else if (kind === 'multi') {
      const existing = sparks.slice();
      for (const spark of existing) {
        if (sparks.length >= 5) break;
        for (const angle of [-0.6, 0.6]) {
          if (sparks.length >= 5) break;
          const speed = Math.hypot(spark.vx, spark.vy) || sparkSpeed();
          const base = Math.atan2(spark.vy, spark.vx);
          sparks.push({
            x: spark.x,
            y: spark.y,
            vx: Math.cos(base + angle) * speed,
            vy: Math.sin(base + angle) * speed,
            colour: spark.colour,
            stuck: false,
            trail: [],
          });
        }
      }
    }
  }

  function cycleSparkColour(spark) {
    const index = COLOUR_ORDER.indexOf(spark.colour);
    spark.colour = COLOUR_ORDER[(index + 1) % COLOUR_ORDER.length];
  }

  function collidePrisms(spark) {
    for (const prism of prisms) {
      if (!prism.alive) continue;
      const nearestX = clamp(spark.x, prism.x, prism.x + prism.width);
      const nearestY = clamp(spark.y, prism.y, prism.y + prism.height);
      const dx = spark.x - nearestX;
      const dy = spark.y - nearestY;
      if (dx * dx + dy * dy >= SPARK.radius * SPARK.radius) continue;
      // Bounce on the axis of deepest penetration.
      if (Math.abs(dx) > Math.abs(dy)) spark.vx = dx > 0 ? Math.abs(spark.vx) : -Math.abs(spark.vx);
      else spark.vy = dy > 0 ? Math.abs(spark.vy) : -Math.abs(spark.vy);
      if (prism.steel) {
        prism.flash = PRISM.flashSeconds;
        return EVENT_STEEL;
      }
      if (prism.colour === spark.colour) {
        const cleared = breakPrism(prism, spark);
        return cleared ? EVENT_BREAK | EVENT_CLEAR : EVENT_BREAK;
      }
      prism.flash = PRISM.flashSeconds;
      state.streak = 0;
      state.multiplier = 1;
      return EVENT_MISMATCH;
    }
    return 0;
  }

  function stepSpark(spark, dt) {
    let events = 0;
    if (spark.stuck) {
      spark.x = paddle.x + paddle.width / 2;
      spark.y = PADDLE.y - SPARK.radius - 2;
      return 0;
    }
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.trail.unshift({ x: spark.x, y: spark.y });
    if (spark.trail.length > SPARK.trailLength) spark.trail.pop();

    if (spark.x - SPARK.radius < 0) {
      spark.x = SPARK.radius;
      spark.vx = Math.abs(spark.vx);
    } else if (spark.x + SPARK.radius > FIELD.width) {
      spark.x = FIELD.width - SPARK.radius;
      spark.vx = -Math.abs(spark.vx);
    }
    if (spark.y - SPARK.radius < 0) {
      spark.y = SPARK.radius;
      spark.vy = Math.abs(spark.vy);
    }

    // Paddle: only when falling onto it.
    if (
      spark.vy > 0 &&
      spark.y + SPARK.radius >= PADDLE.y &&
      spark.y + SPARK.radius <= PADDLE.y + PADDLE.height + 14 &&
      spark.x >= paddle.x - SPARK.radius &&
      spark.x <= paddle.x + paddle.width + SPARK.radius
    ) {
      const offset = clamp((spark.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2), -1, 1);
      const speed = Math.hypot(spark.vx, spark.vy) || sparkSpeed();
      spark.vx = offset * speed * 0.75;
      spark.vy = -Math.sqrt(Math.max(speed * speed - spark.vx * spark.vx, 10000));
      spark.y = PADDLE.y - SPARK.radius - 1;
      cycleSparkColour(spark);
      events |= EVENT_PADDLE;
    }

    events |= collidePrisms(spark);

    if (spark.y - SPARK.radius > FIELD.height) {
      spark.dead = true;
    }
    return events;
  }

  /**
   * One fixed step. `direction` is -1, 0 or 1 from the keys; `mouseX` is the
   * paddle's mouse target in field coordinates (or null). Returns event flags.
   */
  function step(dt, direction, mouseX) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
    if (state.cycleCooldown > 0) state.cycleCooldown = Math.max(0, state.cycleCooldown - dt);
    if (paddle.wideTimer > 0) paddle.wideTimer = Math.max(0, paddle.wideTimer - dt);
    if (state.slowTimer > 0) state.slowTimer = Math.max(0, state.slowTimer - dt);

    paddle.width = paddleWidth();
    if (direction !== 0) {
      paddle.x = clamp(paddle.x + direction * PADDLE.speed * dt, 0, FIELD.width - paddle.width);
    } else if (mouseX !== null && mouseX !== undefined) {
      const target = clamp(mouseX - paddle.width / 2, 0, FIELD.width - paddle.width);
      const delta = target - paddle.x;
      const move = clamp(delta, -PADDLE.mouseSpeed * dt, PADDLE.mouseSpeed * dt);
      paddle.x += move;
    }

    for (const prism of prisms) {
      if (prism.flash > 0) prism.flash = Math.max(0, prism.flash - dt);
      if (prism.rowSpeed !== 0 && prism.alive) {
        prism.x += prism.rowSpeed * dt;
        if (prism.x < BRICK_LEFT) {
          prism.x = BRICK_LEFT;
          prism.rowSpeed = Math.abs(prism.rowSpeed);
        } else if (prism.x + prism.width > BRICK_LEFT + BRICK_WIDTH) {
          prism.x = BRICK_LEFT + BRICK_WIDTH - prism.width;
          prism.rowSpeed = -Math.abs(prism.rowSpeed);
        }
      }
    }

    for (let index = sparks.length - 1; index >= 0; index -= 1) {
      events |= stepSpark(sparks[index], dt);
      if (sparks[index].dead) sparks.splice(index, 1);
    }

    if (sparks.length === 0) {
      state.lives -= 1;
      state.streak = 0;
      state.multiplier = 1;
      if (state.lives <= 0) {
        state.lives = 0;
        return events | EVENT_OVER;
      }
      sparks.push(newSpark());
      return events | EVENT_LOST;
    }

    for (let index = powerups.length - 1; index >= 0; index -= 1) {
      const drop = powerups[index];
      drop.y += drop.vy * dt;
      if (
        drop.y + POWERUP.size / 2 >= PADDLE.y &&
        drop.y - POWERUP.size / 2 <= PADDLE.y + PADDLE.height &&
        drop.x >= paddle.x - POWERUP.size / 2 &&
        drop.x <= paddle.x + paddle.width + POWERUP.size / 2
      ) {
        applyPowerup(drop.kind);
        powerups.splice(index, 1);
        events |= EVENT_POWERUP;
        continue;
      }
      if (drop.y > FIELD.height + POWERUP.size) powerups.splice(index, 1);
    }

    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 260 * dt;
      particle.life -= dt;
      if (particle.life <= 0) particles.splice(index, 1);
    }

    return events;
  }

  /**
   * The title screen's backdrop: the paddle chases the spark on its own, a
   * lost spark is relaunched, a cleared board reloads, and nothing costs a life.
   */
  function stepDemo(dt) {
    if (sparks.length === 0) sparks.push(newSpark());
    const spark = sparks[0];
    if (spark.stuck) launchSpark(spark);
    const direction = spark.x < paddle.x + paddle.width / 2 - 6 ? -1 : spark.x > paddle.x + paddle.width / 2 + 6 ? 1 : 0;
    const events = step(dt, direction, null);
    if (events & EVENT_CLEAR) loadLevel(state.level);
    if (events & (EVENT_LOST | EVENT_OVER)) {
      state.lives = LIVES;
      sparks.length = 0;
      sparks.push(newSpark());
    }
    return events;
  }

  reset();
  return { state, reset, loadLevel, step, stepDemo, launch, cycleColours, clearBoard, forceBreakOne };
}
