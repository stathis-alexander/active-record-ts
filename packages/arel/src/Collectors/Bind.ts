import type { BindCallback, Bind as BindInput, ProcForBinds } from './types';

/**
 * Collector that captures bind values only — used to extract the parameter
 * array for a prepared statement, without producing any SQL text.
 */
export class Bind {
  public retryable?: boolean;
  public preparable?: boolean;
  public binds: unknown[] = [];

  collect = (_string: string) => {
    return this;
  };
  addBind = (bind: BindInput, _callback: BindCallback) => {
    this.binds.push(this.extractValue(bind));
    return this;
  };
  addBinds = (binds: BindInput[], procForBinds: ProcForBinds | null | undefined, _callback: BindCallback) => {
    const mapped = procForBinds ? binds.map(procForBinds) : binds;
    this.binds = this.binds.concat(mapped.map((b) => this.extractValue(b)));
    return this;
  };
  value = (): unknown[] => this.binds;

  /** Unwrap `BindParamNode`-like wrappers, returning the primitive value. */
  private extractValue(bind: BindInput): unknown {
    if (bind == null) return bind;
    if (typeof bind === 'object' && 'value' in (bind as object)) {
      return (bind as { value: unknown }).value;
    }
    return bind;
  }
}
