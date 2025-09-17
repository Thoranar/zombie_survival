/**
 * Responsibility: Deterministic fixed-step simulation loop with accumulator.
 * Publishes: none
 * Subscribes: none
 * Config: game.loop.tickHz (converted to fixed dt seconds)
 * Notes: Independent, testable; rendering occurs outside via a separate raf.
 */
export class FixedStepLoop {
  private accumulator = 0;
  private lastTime = 0;
  private readonly stepSec: number;
  private readonly onStep: (_dtSec: number) => void;
  private running = false;

  constructor(stepSec: number, onStep: (_dtSec: number) => void) {
    this.stepSec = stepSec;
    this.onStep = onStep;
  }

  public start(nowSec: number): void {
    this.running = true;
    this.lastTime = nowSec;
  }

  public stop(): void {
    this.running = false;
  }

  public tick(nowSec: number): number {
    if (!this.running) {
      this.lastTime = nowSec;
      return 0;
    }
    const frameDelta = nowSec - this.lastTime;
    this.lastTime = nowSec;
    this.accumulator += frameDelta;
    let steps = 0;
    // clamp to avoid spiral of death
    const maxAccum = this.stepSec * 5;
    if (this.accumulator > maxAccum) this.accumulator = maxAccum;
    while (this.accumulator >= this.stepSec) {
      this.onStep(this.stepSec);
      this.accumulator -= this.stepSec;
      steps += 1;
    }
    return steps;
  }

  public getAccumulatorSec(): number {
    return this.accumulator;
  }
}
