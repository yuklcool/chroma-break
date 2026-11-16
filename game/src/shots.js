// The screenshot scenes behind ?shot=start|play|clear|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (chase the spark with the paddle, launch when stuck), so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. The end scene's pilot wanders instead of chasing, so
// it loses its lives the way a hurried player does.

import { LEVELS, STEP } from './config.js';
import { createRandom } from './random.js';
import { EVENT_CLEAR, EVENT_OVER } from './world.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 22;
const CLEAR_SECONDS = 10;
const END_LIMIT_SECONDS = 600;

/** Paddle direction that chases the spark (-1, 0, 1). */
function chaseDirection(state) {
  const spark = state.sparks[0];
  if (!spark) return 0;
  const centre = state.paddle.x + state.paddle.width / 2;
  if (spark.x < centre - 6) return -1;
  if (spark.x > centre + 6) return 1;
  return 0;
}

function playSteps(world, seconds, pilot) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (world.state.sparks.length > 0 && world.state.sparks[0].stuck) world.launch();
    events = world.step(STEP, pilot(world.state, index), null);
    if (events & EVENT_CLEAR) world.loadLevel(world.state.level);
    if (events & EVENT_OVER) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, clear or end; any other name is
 * start) and return the screen to draw over it, the best score to show, and
 * any extra panel data.
 */
export function stageShot(name, world, seed) {
  world.reset();
  if (name !== 'play' && name !== 'clear' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.stepDemo(STEP);
    // The title shows a full board: restore any prisms the demo broke.
    for (const prism of world.state.prisms) prism.alive = true;
    return { screen: SCREEN_TITLE, best: 0, extra: null };
  }

  if (name === 'clear') {
    world.loadLevel(4);
    playSteps(world, CLEAR_SECONDS, () => chaseDirection(world.state));
    world.clearBoard();
    return {
      screen: SCREEN_CLEAR,
      best: world.state.score,
      extra: { clearBonus: world.state.clearBonus, nextName: LEVELS[4].name },
    };
  }

  if (name === 'end') {
    // Score first, then lose: a game-over screen reads better with a real score.
    playSteps(world, 15, () => chaseDirection(world.state));
    const random = createRandom((seed || 1) + 999);
    let wander = 0;
    let changeAt = 0;
    playSteps(world, END_LIMIT_SECONDS, (state, index) => {
      if (index >= changeAt) {
        wander = Math.floor(random() * 3) - 1;
        changeAt = index + 30;
      }
      return wander;
    });
    if (world.state.lives > 0) world.state.lives = 0;
    return { screen: SCREEN_OVER, best: world.state.score, extra: null };
  }

  // play: a busy mid-game, part of the board cleared, the spark in flight,
  // a non-zero score and combo, a couple of particles and a falling power-up.
  playSteps(world, PLAY_SECONDS, () => chaseDirection(world.state));
  for (let index = 0; index < 3 && (world.state.score === 0 || world.state.streak < 2); index += 1) {
    world.forceBreakOne();
  }
  const spark = world.state.sparks[0];
  if (spark) {
    if (spark.stuck) world.launch();
    for (let index = 0; index < 8; index += 1) {
      world.state.particles.push({
        x: spark.x + (index - 4) * 8,
        y: spark.y - 20,
        vx: (index - 4) * 30,
        vy: -80,
        life: 0.7,
        maxLife: 0.9,
        colour: spark.colour,
        size: 3,
      });
    }
  }
  if (world.state.powerups.length === 0) {
    world.state.powerups.push({ x: 480, y: 220, kind: 'wide', vy: 150 });
  }
  return { screen: SCREEN_PLAY, best: world.state.score, extra: null };
}
