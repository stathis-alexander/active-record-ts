import type { Bind as BindCollector } from './Bind';
import type { Composite } from './Composite';
import type { SqlString } from './SqlString';
import type { SubstituteBind } from './SubstituteBind';

export type Collector = BindCollector | Composite | SqlString | SubstituteBind;

export type Quoter = {
  quote: (value: any) => string;
};

export type Bind = {
  valueForDatabase: () => string;
};

export type BindCallback = (index: number) => string;
export type ProcForBinds = (bind: Bind) => never;
