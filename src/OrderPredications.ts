import { Nodes } from './Nodes';
import type { ArelOperand } from './types';
import type { Constructor } from './utilities/mixins';

export const OrderPredications = <TBase extends Constructor>(Base: TBase) =>
  class OrderPredications extends Base implements ArelOperand {
    declare readonly __arelOperand?: never;
    ascending = () => new Nodes.Ascending(this);
    descending = () => new Nodes.Descending(this);
    asc = () => new Nodes.Ascending(this);
    desc = () => new Nodes.Descending(this);
  };
