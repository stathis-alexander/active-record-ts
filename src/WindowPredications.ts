import { Nodes } from './Nodes';
import type { SqlLiteralNode } from './Nodes/SqlLiteral';
import type { WindowNode } from './Nodes/Window';
import type { ArelOperand } from './types';
import type { Constructor } from './utilities/mixins';

export const WindowPredications = <TBase extends Constructor>(Base: TBase) =>
  class WindowPredications extends Base implements ArelOperand {
    declare readonly __arelOperand?: never;
    over = (expression: WindowNode | SqlLiteralNode | string | null = null) => new Nodes.Over(this, expression);
  };
