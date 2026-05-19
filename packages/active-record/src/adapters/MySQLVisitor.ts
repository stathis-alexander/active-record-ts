/**
 * Subclass of arel's `MySQL` visitor that overrides identifier quoting to
 * use backticks — the dialect's actual quoting style. The arel package
 * itself keeps double-quoted identifiers across all visitors for
 * consistency with its test suite, so we adapt to the real driver here.
 */

import { MySQL as ArelMySQL } from '@active-record-ts/arel';

export class MySQLAdapterVisitor extends ArelMySQL {
  protected override quoteIdentifier(name: string): string {
    return `\`${name.replaceAll('`', '')}\``;
  }
}
