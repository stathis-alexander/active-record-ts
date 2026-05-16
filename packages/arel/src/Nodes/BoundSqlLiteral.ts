import { BindError } from '../errors';
import { NodeExpression } from '../NodeExpression';
import type { BindValue, NamedBinds } from '../types';
import { hash } from '../utilities/hash';

const POSITIONAL_PLACEHOLDER = /\?/g;
const NAMED_PLACEHOLDERS = /(?<!::):([a-zA-Z]\w*)/g;

export class BoundSqlLiteralNode extends NodeExpression {
  public sqlWithPlaceHolders: string;
  public positionalBinds: BindValue[] | null;
  public namedBinds: NamedBinds | null;

  constructor(
    sqlWithPlaceHolders: string,
    positionalBinds: BindValue[] | null = [],
    namedBinds: NamedBinds | null = {},
  ) {
    super();

    const hasPositional = positionalBinds != null && positionalBinds.length > 0;
    const hasNamed = namedBinds != null && Object.keys(namedBinds).length > 0;

    if (hasPositional) {
      if (hasNamed) throw new BindError('cannot mix positional and named binds', sqlWithPlaceHolders);

      const expectedPositionalBinds = (sqlWithPlaceHolders.match(POSITIONAL_PLACEHOLDER) ?? []).length;
      if (positionalBinds.length !== expectedPositionalBinds) {
        throw new BindError(
          `wrong number of bind variables (${positionalBinds.length} for ${expectedPositionalBinds})`,
          sqlWithPlaceHolders,
        );
      }
    }

    // For named binds: validate that all named placeholders in SQL have a corresponding bind
    const tokensInString = Array.from(sqlWithPlaceHolders.matchAll(NAMED_PLACEHOLDERS), (m) => m[1] as string);
    const requestedTokens = new Set(tokensInString);
    if (requestedTokens.size > 0) {
      const providedKeys = new Set(namedBinds ? Object.keys(namedBinds) : []);
      const missing: string[] = [];
      for (const tok of requestedTokens) {
        if (!providedKeys.has(tok)) missing.push(tok);
      }
      if (missing.length > 0) {
        throw new BindError(`missing named bind variables (${missing.join(', ')})`, sqlWithPlaceHolders);
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
