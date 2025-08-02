import { BindError } from '../errors';
import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';

const POSITIONAL_PLACEHOLDER = new RegExp(/\?/g);
const NAMED_PLACEHOLDERS = new RegExp(/:(?<!::)([a-zA-Z]\w*)/g);

type PositionalBindsType = any[] | null;
type NamedBindsType = Record<string, any> | null;

export class BoundSqlLiteralNode extends NodeExpression {
  public sqlWithPlaceHolders: string;
  public positionalBinds: PositionalBindsType;
  public namedBinds: NamedBindsType;

  constructor(sqlWithPlaceHolders: string, positionalBinds: PositionalBindsType = [], namedBinds: NamedBindsType = {}) {
    super();

    const hasPositional = positionalBinds != null && positionalBinds.length > 0;
    const hasNamed = namedBinds != null && Object.keys(namedBinds).length > 0;

    if (hasPositional) {
      if (hasNamed) throw new BindError('cannot mix positional and named binds', sqlWithPlaceHolders);

      const expectedPositionalBinds = (sqlWithPlaceHolders.match(POSITIONAL_PLACEHOLDER) ?? []).length;
      if (positionalBinds.length !== expectedPositionalBinds) {
        throw new BindError(
          `wrong number of bind variables (${positionalBinds.length} for ${expectedPositionalBinds})"`,
          sqlWithPlaceHolders,
        );
      }
    } else if (hasNamed) {
      const tokensInString = (sqlWithPlaceHolders.match(NAMED_PLACEHOLDERS) ?? []).map((match) => match.slice(1));

      const tokensInHash = Object.keys(namedBinds);

      const matchingTokens = tokensInString.filter((token) => tokensInHash.includes(token));
      if (matchingTokens.length !== tokensInHash.length) {
        throw new BindError(
          `missing named bind variables (${tokensInHash.filter((token) => !matchingTokens.includes(token)).join(', ')})`,
          sqlWithPlaceHolders,
        );
      }
    }

    this.sqlWithPlaceHolders = sqlWithPlaceHolders;
    this.positionalBinds = hasPositional ? positionalBinds : null;
    this.namedBinds = !hasPositional ? namedBinds : null;
  }

  override hash() {
    return hash([this.constructor.name, this.sqlWithPlaceHolders, this.positionalBinds, this.namedBinds]);
  }
}
