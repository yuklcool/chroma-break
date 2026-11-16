// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, level-clear, game over and win.
//
// ?seed=N fixes the layout. ?shot=start|play|clear|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, CLEAR_BONUS, LEVELS, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  EVENT_BREAK,
  EVENT_CLEAR,
  EVENT_LOST,
  EVENT_MISMATCH,
  EVENT_OVER,
  EVENT_PADDLE,
  EVENT_POWERUP,
  EVENT_STEEL,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import {
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds the level-clear banner stays up before the next level loads. */
const CLEAR_SECONDS = 2.6;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, seed);
  status.textContent = `Chroma Break, ${name} scene.`;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.extra);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.screenToField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let newBest = false;
  let clearTimer = 0;
  let clearExtra = null;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each big event.
  function announce(message) {
    status.textContent = message;
  }

  function bankBest() {
    if (world.state.score > best) {
      best = world.state.score;
      newBest = true;
      saveBest(best);
    }
  }

  function startGame() {
    world.reset();
    newBest = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Match the spark to the prism to break it.`);
  }

  function endGame() {
    bankBest();
    screen = SCREEN_OVER;
    audio.gameOver();
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    bankBest();
    screen = SCREEN_WIN;
    audio.win();
    announce(`You cleared every level! Final score ${world.state.score}. Best ${best}.`);
  }

  function levelCleared() {
    const bonus = CLEAR_BONUS.perLevel * world.state.level + CLEAR_BONUS.perLife * world.state.lives;
    world.state.clearBonus = bonus;
    world.state.score += bonus;
    const nextLevel = world.state.level + 1;
    clearExtra = {
      clearBonus: bonus,
      nextName: nextLevel <= LEVELS.length ? LEVELS[nextLevel - 1].name : '',
    };
    screen = SCREEN_CLEAR;
    clearTimer = CLEAR_SECONDS;
    audio.levelClear();
    announce(`Level ${world.state.level} clear! Bonus ${bonus}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_PLAY) {
        if (world.launch()) audio.launch();
        else if (world.cycleColours()) audio.cycle();
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.stepDemo(STEP);
      return;
    }
    const events = world.step(STEP, input.direction(), input.mouseTarget());
    if (events & EVENT_PADDLE) audio.paddleBounce();
    if (events & EVENT_BREAK) audio.prismBreak(world.state.streak);
    if (events & EVENT_MISMATCH) audio.mismatch();
    if (events & EVENT_STEEL) audio.steelBounce();
    if (events & EVENT_POWERUP) {
      audio.powerup();
      announce('Power-up caught.');
    }
    if (events & EVENT_LOST) {
      audio.lifeLost();
      announce(world.state.lives === 1 ? 'Spark lost. 1 life left.' : `Spark lost. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_CLEAR) levelCleared();
    else if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameSeconds = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += frameSeconds;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_CLEAR) {
      accumulator = 0;
      clearTimer -= frameSeconds;
      if (clearTimer <= 0) {
        if (world.state.level >= LEVELS.length) winGame();
        else {
          world.loadLevel(world.state.level + 1);
          screen = SCREEN_PLAY;
          announce(`Level ${world.state.level}: ${world.state.levelName}.`);
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, screen === SCREEN_CLEAR ? clearExtra : { newBest });
  }

  // Leaving the tab pauses a running game rather than letting the spark fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Chroma Break. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
