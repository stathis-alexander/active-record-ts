# `@arelts/active-model`

Typed attributes, dirty tracking, validations, and callbacks for plain TypeScript classes — no database. A port of Rails' [`ActiveModel`](https://github.com/rails/rails/tree/main/activemodel).

Used by [`@arelts/active-record`](../active-record) for persistence; usable on its own for form objects, API payloads, etc.

## Usage

```ts
import { Model } from '@arelts/active-model';

class Signup extends Model {
  declare email: string;
  declare age: number;
}

Signup.attribute('email', 'string');
Signup.attribute('age', 'integer');
Signup.validates('email', { presence: true, format: { with: /@/ } });
Signup.validates('age', { numericality: { greaterThanOrEqualTo: 13 } });

const s = new Signup({ email: 'a@b.c', age: 12 });
await s.validate();          // false
s.errors.fullMessages;       // ["Age must be greater than or equal to 13"]
```

## Features

- **Typed attributes** — `attribute(name, type)`. Built-ins: `string`, `integer`, `bigint`, `float`, `decimal`, `boolean`, `date`, `datetime`, `binary`, `json`. Register your own with `registerType`.
- **Dirty tracking** — `record.changed()`, `record.changes()`, `record.wasChanged(attr)`, `record.savedChanges()`.
- **Validations** — `presence`, `absence`, `format`, `length`, `numericality`, `inclusion`, `exclusion`, `acceptance`, `confirmation`.
- **Callbacks** — `beforeValidation`, `afterValidation`, `beforeSave`, `afterSave`, `aroundSave`. Throw `HaltError` (or call `throwAbort()`) inside a `before*` callback to halt the chain.
- **Errors** — `record.errors` exposes Rails-style `add`, `on`, `fullMessages`, etc.
- **Inflector** — `camelize`, `underscore`, `pluralize`, `tableize`.

## Test

```bash
bun run test:active-model
```
