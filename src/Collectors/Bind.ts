import type { BindCallback, ProcForBinds } from './types';

export class Bind {
  public retryable?: boolean;
  public binds: Bind[] = [];

  collect = (_string: string) => {
    return this;
  };
  addBind = (bind: Bind, _callback: BindCallback) => {
    this.binds.push(bind);
    return this;
  };
  addBinds = (binds: Bind[], procForBinds: ProcForBinds, _callback: BindCallback) => {
    this.binds = this.binds.concat(procForBinds ? binds.map(procForBinds) : binds);
    return this;
  };
  value = (): Bind[] => this.binds;
}
