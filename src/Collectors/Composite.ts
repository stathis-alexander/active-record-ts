import type { Bind, BindCallback, Collector, ProcForBinds } from './types';

type NonComposite = Exclude<Collector, Composite>;

export class Composite {
  public left: NonComposite;
  public right: NonComposite;
  public preparable?: boolean;
  public retryable?: boolean;

  constructor(left: NonComposite, right: NonComposite) {
    this.left = left;
    this.right = right;
  }

  collect = (other: string) => {
    this.left.collect(other);
    this.right.collect(other);
    return this;
  };

  addBind = (bind: Bind, callback: BindCallback) => {
    this.left.addBind(bind, callback);
    this.right.addBind(bind, callback);
    return this;
  };

  addBinds = (binds: Bind[], procForBinds: ProcForBinds, callback: BindCallback) => {
    this.left.addBinds(binds, procForBinds, callback);
    this.right.addBinds(binds, procForBinds, callback);
    return this;
  };

  value = (): (string | Bind[])[] => [this.left.value(), this.right.value()];
}
