import { Nodes } from './Nodes';
import type { Constructor } from './utilities/mixins';

export const OrderPredications = <TBase extends Constructor>(Base: TBase) =>
  class OrderPredications extends Base {
    ascending = () => new Nodes.Ascending(this);
    descending = () => new Nodes.Descending(this);
  };
