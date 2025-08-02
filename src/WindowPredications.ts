import { Nodes } from './Nodes';
import type { Constructor } from './utilities/mixins';

export const WindowPredications = <TBase extends Constructor>(Base: TBase) =>
  class WindowPredications extends Base {
    over = (expression = null) => new Nodes.Over(this, expression);
  };
