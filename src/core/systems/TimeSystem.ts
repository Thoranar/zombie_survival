/**
 * Responsibility: Track day/night/eclipse cycles and remaining time.
 * Publishes: none (future: TimePhaseChanged)
 * Subscribes: none
 * Config: game.dayNight.{daySec,nightSec,eclipseSec,eclipseEvery}
 * Notes: Pure logic, testable with manual ticks.
 */
export type TimePhase = 'day' | 'night' | 'eclipse';

export interface TimeConfig {
  daySec: number;
  nightSec: number;
  eclipseSec: number;
  eclipseEvery: number; // every N cycles, night becomes eclipse
}

export class TimeSystem {
  private readonly cfg: TimeConfig;
  private accumulator = 0;
  private phase: TimePhase = 'day';
  private timeLeftSec: number;
  private dayNumber = 1; // starts at Day 1
  private cycleCount = 1; // counts day/night pairs; eclipse applies to night of cycleCount

  constructor(cfg: TimeConfig) {
    this.cfg = cfg;
    this.timeLeftSec = cfg.daySec;
  }

  /** advance by dt (seconds) */
  public tick(dtSec: number): void {
    this.accumulator += dtSec;
    while (this.accumulator > 0) {
      const step = Math.min(this.accumulator, dtSec);
      this.timeLeftSec -= step;
      this.accumulator -= step;
      if (this.timeLeftSec <= 0) this.advancePhase();
    }
  }

  private advancePhase(): void {
    if (this.phase === 'day') {
      // Transition to night or eclipse
      const isEclipse = this.cfg.eclipseEvery > 0 && this.cycleCount % this.cfg.eclipseEvery === 0;
      this.phase = isEclipse ? 'eclipse' : 'night';
      this.timeLeftSec = isEclipse ? this.cfg.eclipseSec : this.cfg.nightSec;
    } else {
      // Transition to next day
      this.phase = 'day';
      this.timeLeftSec = this.cfg.daySec;
      this.dayNumber += 1;
      this.cycleCount += 1;
    }
  }

  public getPhase(): TimePhase {
    return this.phase;
  }

  public getDayNumber(): number {
    return this.dayNumber;
  }

  public getTimeLeftSec(): number {
    return Math.max(0, this.timeLeftSec);
  }

  public isNightLike(): boolean {
    return this.phase === 'night' || this.phase === 'eclipse';
  }
}

