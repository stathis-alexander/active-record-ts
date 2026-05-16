import { Nodes } from './Nodes';
import type { ArelOperand } from './types';
import type { Constructor } from './utilities/mixins';

export const AliasPredications = <TBase extends Constructor>(Base: TBase) =>
  class AliasPredications extends Base implements ArelOperand {
    declare readonly __arelOperand?: never;
    as = (alias: string) => new Nodes.As(this, new Nodes.SqlLiteral(alias, { retryable: true }));
  };
