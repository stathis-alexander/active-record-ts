import { Nodes } from './Nodes';
import type { Constructor } from './utilities/mixins';

export const Expressions = <TBase extends Constructor>(Base: TBase) =>
  class Expressions extends Base {
    average = () => new Nodes.Average([this]);
    count = (distinct: boolean = false) => new Nodes.Count([this], distinct);
    extract = (field: string) => new Nodes.Extract([this], field);
    maximum = () => new Nodes.Max([this]);
    minimum = () => new Nodes.Min([this]);
    sum = () => new Nodes.Sum([this]);
  };
