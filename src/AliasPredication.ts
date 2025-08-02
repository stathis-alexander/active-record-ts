import { Nodes } from './Nodes';
import type { Constructor } from './utilities/mixins';

export const AliasPredications = <TBase extends Constructor>(Base: TBase) =>
  class AliasPredications extends Base {
    as = (alias: string) => new Nodes.As(this, new Nodes.SqlLiteral(alias, { retryable: true }));
  };
