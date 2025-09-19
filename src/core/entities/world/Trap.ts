import { Structure, StructureInitParams } from './Structure';

export interface TrapInitParams extends StructureInitParams {
  damageOnTrigger: number;
  selfDamageOnTrigger: number;
  triggerIntervalSec?: number;
  icon?: string;
}

/**
 * Responsibility: Offensive structure that damages zombies stepping through it.
 */
export class Trap extends Structure {
  public readonly damageOnTrigger: number;
  public readonly selfDamageOnTrigger: number;
  public readonly triggerIntervalSec: number;
  public readonly icon: string;
  private readonly contacts = new Map<string, { elapsed: number }>();

  constructor(params: TrapInitParams) {
    super(params);
    this.damageOnTrigger = Math.max(0, Number(params.damageOnTrigger ?? 0));
    this.selfDamageOnTrigger = Math.max(0, Number(params.selfDamageOnTrigger ?? 0));
    this.triggerIntervalSec = Math.max(0, Number(params.triggerIntervalSec ?? 1));
    this.icon = params.icon ?? 'spike';
  }

  public processContacts(currentIds: Iterable<string>, dtSec: number, onTrigger: (id: string) => void): void {
    const nextIds = new Set<string>();
    const interval = this.triggerIntervalSec;
    const step = Math.max(0, dtSec);
    for (const id of currentIds) {
      nextIds.add(id);
      let contact = this.contacts.get(id);
      if (!contact) {
        contact = { elapsed: 0 };
        this.contacts.set(id, contact);
        onTrigger(id);
        continue;
      }
      contact.elapsed += step;
      if (interval <= 0) {
        onTrigger(id);
        contact.elapsed = 0;
        continue;
      }
      while (contact.elapsed >= interval) {
        contact.elapsed -= interval;
        onTrigger(id);
      }
    }
    for (const id of Array.from(this.contacts.keys())) {
      if (!nextIds.has(id)) this.contacts.delete(id);
    }
  }

  public resetContacts(): void {
    this.contacts.clear();
  }
}