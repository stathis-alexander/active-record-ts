import type { BindCallback, Bind as BindInput, Collector, ProcForBinds } from './types';

/**
 * A pair of collectors that run side-by-side. Common use: combine a
 * `SqlString` (text output) with a `Bind` collector (parameter values) to
 * emit a prepared statement in a single pass.
 */
export class Composite<L extends Collector = Collector, R extends Collector = Collector> {
  public left: L;
  public right: R;
  private _preparable?: boolean;
  private _retryable?: boolean;

  constructor(left: L, right: R) {
    this.left = left;
    this.right = right;
  }

  get retryable() {
    return this._retryable;
  }

  set retryable(value: boolean | undefined) {
    this._retryable = value;
    this.left.retryable = value;
    this.right.retryable = value;
  }

  get preparable() {
    return this._preparable;
  }

  set preparable(value: boolean | undefined) {
    this._preparable = value;
    this.left.preparable = value;
    this.right.preparable = value;
  }

  collect = (other: string) => {
    this.left.collect(other);
    this.right.collect(other);
    return this;
  };

  addBind = (bind: BindInput, callback: BindCallback) => {
    this.left.addBind(bind, callback);
    this.right.addBind(bind, callback);
    return this;
  };

  addBinds = (binds: BindInput[], procForBinds: ProcForBinds | null | undefined, callback: BindCallback) => {
    this.left.addBinds(binds, procForBinds, callback);
    this.right.addBinds(binds, procForBinds, callback);
    return this;
  };

  value = (): [ReturnType<L['value']>, ReturnType<R['value']>] => [
    this.left.value() as ReturnType<L['value']>,
    this.right.value() as ReturnType<R['value']>,
  ];
}
