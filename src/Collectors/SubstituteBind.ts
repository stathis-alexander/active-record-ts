import type { Composite } from './Composite';
import type { Bind, BindCallback, Collector, ProcForBinds, Quoter } from './types';

type NonSubstitueCollector = Exclude<Collector, SubstituteBind | Composite>;

export class SubstituteBind {
  public quoter: Quoter;
  public delegate: NonSubstitueCollector;
  public preparable?: boolean;
  public retryable?: boolean;

  constructor(quoter: Quoter, delegateCollector: NonSubstitueCollector) {
    this.quoter = quoter;
    this.delegate = delegateCollector;
  }

  collect = (other: string) => {
    this.delegate.collect(other);
    return this;
  };

  addBind = (bind: Bind, _callback: BindCallback) => {
    let valueForDatabase = null;
    if ('valueForDatabase' in bind) {
      valueForDatabase = bind.valueForDatabase();
    }
    this.collect(this.quoter.quote(valueForDatabase ?? bind));
  };

  addBinds = (binds: Bind[], _procForBinds: ProcForBinds, _callback: BindCallback) => {
    this.collect(binds.map((bind) => this.quoter.quote(bind)).join(', '));
  };

  value = () => this.delegate.value();
}
