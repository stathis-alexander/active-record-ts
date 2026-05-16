/**
 * A bind input the visitor passes to `addBind`. Typically a `BindParamNode`,
 * or — for `SubstituteBind` / nested-array binds — any value that the active
 * `Quoter` can stringify. Treated as opaque by the collector framework.
 */
export type Bind = unknown;

export type Quoter = {
  quote: (value: unknown) => string;
};

export type BindCallback = (index: number) => string;
export type ProcForBinds = (bind: Bind) => unknown;

export type Collector = {
  retryable?: boolean;
  preparable?: boolean;
  collect: (other: string) => Collector;
  addBind: (bind: Bind, callback: BindCallback) => Collector;
  addBinds: (binds: Bind[], procForBinds: ProcForBinds | null | undefined, callback: BindCallback) => Collector;
  /**
   * Materialize the collected output. Concrete collectors define their own
   * concrete return type (`string` for `SqlString`, `Bind[]` for `Bind`, a
   * tuple for `Composite`, etc.).
   */
  value: () => unknown;
};
