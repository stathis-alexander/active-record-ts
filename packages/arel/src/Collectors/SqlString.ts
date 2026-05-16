import { PlainString } from './PlainString';
import type { BindCallback, Bind as BindInput, ProcForBinds } from './types';

/**
 * Collects SQL text and emits a placeholder (via `BindCallback`) for each bind,
 * tracking the running 1-based bind index. Used by the standard `toSql()` path.
 */
export class SqlString extends PlainString {
  public declare preparable?: boolean;
  public declare retryable?: boolean;
  private bindIndex: number = 1;

  override addBind = (_bind: BindInput, callback: BindCallback) => {
    this.collect(callback(this.bindIndex));
    this.bindIndex++;
    return this;
  };
  override addBinds = (binds: BindInput[], _procForBinds: ProcForBinds | null | undefined, callback: BindCallback) => {
    const boundValues = binds
      .map((_, i) => this.bindIndex + i)
      .map(callback)
      .join(', ');

    this.collect(boundValues);
    this.bindIndex += binds.length;

    return this;
  };
}
