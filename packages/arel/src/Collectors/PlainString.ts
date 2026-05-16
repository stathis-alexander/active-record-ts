import type { BindCallback, Bind as BindInput, ProcForBinds } from './types';

/**
 * Plain string collector — concatenates collected strings and ignores binds.
 * Used by the `Dot` visitor and any caller that wants the rendered output
 * without any bind-parameter handling.
 */
export class PlainString {
  public strings: string[] = [];
  public retryable?: boolean;
  public preparable?: boolean;

  collect = (other: string) => {
    this.strings.push(other);
    return this;
  };
  value = (): string => this.strings.join('');
  addBind = (_bind: BindInput, _callback: BindCallback) => this;
  addBinds = (_binds: BindInput[], _procForBinds: ProcForBinds | null | undefined, _callback: BindCallback) => this;
}
