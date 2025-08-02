import { PlainString } from './PlainString';
import type { Bind, BindCallback, ProcForBinds } from './types';

export class SqlString extends PlainString {
  public preparable?: boolean;
  public retryable?: boolean;
  private bindIndex: number = 1;

  addBind = (_bind: Bind, callback: BindCallback) => {
    this.collect(callback(this.bindIndex));
    this.bindIndex++;
    return this;
  };
  addBinds = (binds: Bind[], _procForBinds: ProcForBinds, callback: BindCallback) => {
    const boundValues = binds
      .map((_, i) => this.bindIndex + i)
      .map(callback)
      .join(', ');

    this.collect(boundValues);
    this.bindIndex += binds.length;

    return this;
  };
}
