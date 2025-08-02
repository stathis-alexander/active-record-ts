// https://www.typescriptlang.org/docs/handbook/mixins.html#how-does-a-mixin-work

// biome-ignore lint/complexity/noBannedTypes: This is a generic type that can be used for anything.
export type Constructor<T = Object> = new (...args: any[]) => T;
