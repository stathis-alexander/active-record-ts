import { describe, expect, it } from 'bun:test';
import Arel from '../src';
import type { Expression } from '../src/types';

type MathDispatcher = {
  add: (n: number) => Expression;
  subtract: (n: number) => Expression;
  multiply: (n: number) => Expression;
  divide: (n: number) => Expression;
  bitwiseAnd: (n: number) => Expression;
  bitwiseOr: (n: number) => Expression;
  bitwiseXor: (n: number) => Expression;
  bitwiseShiftLeft: (n: number) => Expression;
  bitwiseShiftRight: (n: number) => Expression;
};

describe('math', () => {
  (['*', '/'] as const).forEach((mathOperator) => {
    const methodName: keyof MathDispatcher = mathOperator === '*' ? 'multiply' : 'divide';

    it(`average should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').average() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`AVG("users"."id") ${mathOperator} 2`);
    });

    it(`count should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').count() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`COUNT("users"."id") ${mathOperator} 2`);
    });

    it(`maximum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').maximum() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MAX("users"."id") ${mathOperator} 2`);
    });

    it(`minimum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').minimum() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MIN("users"."id") ${mathOperator} 2`);
    });

    it(`attribute node should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id') as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`"users"."id" ${mathOperator} 2`);
    });
  });

  (['+', '-', '&', '|', '^', '<<', '>>'] as const).forEach((mathOperator) => {
    let methodName: keyof MathDispatcher;
    switch (mathOperator) {
      case '+':
        methodName = 'add';
        break;
      case '-':
        methodName = 'subtract';
        break;
      case '&':
        methodName = 'bitwiseAnd';
        break;
      case '|':
        methodName = 'bitwiseOr';
        break;
      case '^':
        methodName = 'bitwiseXor';
        break;
      case '<<':
        methodName = 'bitwiseShiftLeft';
        break;
      case '>>':
        methodName = 'bitwiseShiftRight';
        break;
      default:
        throw new Error(`Unknown math operator: ${mathOperator}`);
    }

    it(`average should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').average() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`AVG("users"."id") ${mathOperator} 2`);
    });

    it(`count should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').count() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`COUNT("users"."id") ${mathOperator} 2`);
    });

    it(`maximum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').maximum() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MAX("users"."id") ${mathOperator} 2`);
    });

    it(`minimum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id').minimum() as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MIN("users"."id") ${mathOperator} 2`);
    });

    it(`attribute node should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = (table.attribute('id') as unknown as MathDispatcher)[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`"users"."id" ${mathOperator} 2`);
    });
  });
});
