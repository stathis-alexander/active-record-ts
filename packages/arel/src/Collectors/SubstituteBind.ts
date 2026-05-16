import type { BindCallback, Bind as BindInput, Collector, ProcForBinds, Quoter } from './types';

/**
 * Substitution collector — instead of emitting placeholders, it quotes each
 * bind value via the supplied `Quoter` and inlines the result into the SQL
 * text. Used to produce a "fully resolved" SQL string (e.g. for logging).
 */
export class SubstituteBind {
  public quoter: Quoter;
  public delegate: Collector;
  public preparable?: boolean;
  public retryable?: boolean;

  constructor(quoter: Quoter, delegateCollector: Collector) {
    this.quoter = quoter;
    this.delegate = delegateCollector;
  }

  collect = (other: string) => {
    this.delegate.collect(other);
    return this;
  };

  addBind = (bind: BindInput, _callback: BindCallback) => {
    this.collect(this.quoter.quote(this.unwrap(bind)));
    return this;
  };

  addBinds = (binds: BindInput[], _procForBinds: ProcForBinds | null | undefined, _callback: BindCallback) => {
    this.collect(binds.map((bind) => this.quoter.quote(this.unwrap(bind))).join(', '));
    return this;
  };

  /**
   * Resolve a bind to the raw value the `Quoter` should stringify. Recognized
   * shapes: nodes exposing `valueForDatabase()` (e.g. `CastedNode`), nodes
   * exposing `.value` (e.g. `BindParamNode`), or any other bind passed
   * through verbatim.
   */
  private unwrap(bind: BindInput): unknown {
    if (bind != null && typeof bind === 'object') {
      const obj = bind as { valueForDatabase?: () => unknown; value?: unknown };
      if (typeof obj.valueForDatabase === 'function') return obj.valueForDatabase();
      if ('value' in obj) return obj.value;
    }
    return bind;
  }

  value = (): unknown => this.delegate.value();
}
