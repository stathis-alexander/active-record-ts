// https://www.typescriptlang.org/docs/handbook/mixins.html#how-does-a-mixin-work

/**
 * Generic constructor type used as the upper bound for mixin functions
 * (`<T extends Constructor>(Base: T) => class extends Base { ... }`). Must
 * accept `any[]` args because mixin chains compose classes whose constructors
 * have wildly different signatures.
 */
// biome-ignore lint/complexity/noBannedTypes: generic mixin base — Object is the widest concrete instance type
// biome-ignore lint/suspicious/noExplicitAny: standard "any constructor" pattern; constructor signatures vary across mixins
export type Constructor<T = Object> = new (...args: any[]) => T;
