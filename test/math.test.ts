import { describe, expect, it } from 'bun:test';
import Arel from '../src';

// This is a port of the Rails Arel tests to ensure that the ArelTS matches.
// https://github.com/rails/rails/blob/main/activerecord/test/cases/arel/attributes/math_test.rb

describe('math', () => {
  ['*', '/'].forEach((mathOperator) => {
    const methodName = mathOperator === '*' ? 'multiply' : 'divide';

    it(`average should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id').average()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`AVG("users"."id") ${mathOperator} 2`);
    });

    it(`count should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id').count()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`COUNT("users"."id") ${mathOperator} 2`);
    });

    it(`maximum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id').maximum()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MAX("users"."id") ${mathOperator} 2`);
    });

    it(`minimum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id').minimum()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MIN("users"."id") ${mathOperator} 2`);
    });

    it(`attribute node should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id')[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`"users"."id" ${mathOperator} 2`);
    });
  });

  ['+', '-', '&', '|', '^', '<<', '>>'].forEach((mathOperator) => {
    let methodName: string;
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
      const expression = table.attribute('id').average()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`AVG("users"."id") ${mathOperator} 2`);
    });

    it(`count should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id').count()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`COUNT("users"."id") ${mathOperator} 2`);
    });

    it(`maximum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id').maximum()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MAX("users"."id") ${mathOperator} 2`);
    });

    it(`minimum should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id').minimum()[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`MIN("users"."id") ${mathOperator} 2`);
    });

    it(`attribute node should be compatible with ${mathOperator}`, () => {
      const table = new Arel.Table('users');
      const expression = table.attribute('id')[methodName](2);
      expect(table.project(expression).toSql()).toMatch(`"users"."id" ${mathOperator} 2`);
    });
  });
});
