import { describe, expect, it } from 'bun:test';
import Arel from '../src';

describe('attribute', () => {
  // expressions
  describe('average', () => {
    it('should create an Average node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').average()).toBeInstanceOf(Arel.Nodes.Average);
    });

    it('should generate the proper SQL', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id').average());
      expect(mgr.toSql()).toEqual('SELECT AVG("users"."id") FROM "users"');
    });
  });

  describe('maximum', () => {
    it('should create a Maximum node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').maximum()).toBeInstanceOf(Arel.Nodes.Max);
    });

    it('should generate the proper SQL', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id').maximum());
      expect(mgr.toSql()).toEqual('SELECT MAX("users"."id") FROM "users"');
    });
  });

  describe('minimum', () => {
    it('should create a Minimum node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').minimum()).toBeInstanceOf(Arel.Nodes.Min);
    });

    it('should generate the proper SQL', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id').minimum());
      expect(mgr.toSql()).toEqual('SELECT MIN("users"."id") FROM "users"');
    });
  });

  describe('sum', () => {
    it('should create a Sum node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').sum()).toBeInstanceOf(Arel.Nodes.Sum);
    });

    it('should generate the proper SQL', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id').sum());
      expect(mgr.toSql()).toEqual('SELECT SUM("users"."id") FROM "users"');
    });
  });

  describe('count', () => {
    it('should create a Count node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').count()).toBeInstanceOf(Arel.Nodes.Count);
    });

    it('should generate the proper SQL', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id').count());
      expect(mgr.toSql()).toEqual('SELECT COUNT("users"."id") FROM "users"');
    });

    it('should handle distinct', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id').count(true));
      expect(mgr.toSql()).toEqual('SELECT COUNT(DISTINCT "users"."id") FROM "users"');
    });
  });

  // not equal

  describe('notEqual', () => {
    it('should create a NotEqual node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').notEqual(10)).toBeInstanceOf(Arel.Nodes.Inequality);
    });

    it('should generate != in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').notEqual(10));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" != 10');
    });

    it('should handle null and undefined', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').notEqual(null));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" IS NOT NULL');
    });
  });

  describe('notEqualAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      const node = relation.attribute('id').notEqualAny([1, 2]);
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').notEqualAny([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" != 1 OR "users"."id" != 2)');
    });
  });

  describe('notEqualAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      const node = relation.attribute('id').notEqualAll([1, 2]);
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').notEqualAll([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" != 1 AND "users"."id" != 2)');
    });
  });

  // equal
  describe('equal', () => {
    it('should create an Equal node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').equal(10)).toBeInstanceOf(Arel.Nodes.Equality);
    });

    it('should generate = in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').equal(10));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" = 10');
    });

    it('should handle null and undefined', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').equal(null));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" IS NULL');
    });
  });

  describe('equalAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      const node = relation.attribute('id').equalAny([1, 2]);
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').equalAny([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" = 1 OR "users"."id" = 2)');
    });
  });

  describe('equalAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      const node = relation.attribute('id').equalAll([1, 2]);
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').equalAll([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" = 1 AND "users"."id" = 2)');
    });
  });

  // greater than
  describe('greaterThan', () => {
    it('should create a GreaterThan node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').greaterThan(10)).toBeInstanceOf(Arel.Nodes.GreaterThan);
    });

    it('should generate > in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').greaterThan(10));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" > 10');
    });

    it('should handle comparing with a subquery', () => {
      const users = new Arel.Table('users');
      const avg = users.project(users.attribute('karma').average());
      const mgr = users.project(Arel.star).where(users.attribute('karma').greaterThan(avg));
      expect(mgr.toSql()).toEqual(
        'SELECT * FROM "users" WHERE "users"."karma" > (SELECT AVG("users"."karma") FROM "users")',
      );
    });

    it('should accept various data types', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').greaterThan('fake_name'));
      expect(mgr.toSql()).toMatch('"users"."name" > \'fake_name\'');
      const currentTime = new Date();
      mgr.where(relation.attribute('created_at').greaterThan(currentTime));
      expect(mgr.toSql()).toMatch(`"users"."created_at" > '${currentTime.toISOString()}'`);
    });
  });

  describe('greaterThanAny', () => {
    it('should create a grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').greaterThanAny([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').greaterThanAny([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" > 1 OR "users"."id" > 2)');
    });
  });

  describe('greaterThanAll', () => {
    it('should create a grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').greaterThanAll([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').greaterThanAll([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" > 1 AND "users"."id" > 2)');
    });
  });

  // greater than or equal
  describe('greaterThanOrEqual', () => {
    it('should create a greaerThanOrEqual node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').greaterThanOrEqual(10)).toBeInstanceOf(Arel.Nodes.GreaterThanOrEqual);
    });

    it('should generate >= in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').greaterThanOrEqual(10));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" >= 10');
    });

    it('should accept various data types', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').greaterThanOrEqual('fake_name'));
      expect(mgr.toSql()).toMatch('"users"."name" >= \'fake_name\'');
      const currentTime = new Date();
      mgr.where(relation.attribute('created_at').greaterThanOrEqual(currentTime));
      expect(mgr.toSql()).toMatch(`"users"."created_at" >= '${currentTime.toISOString()}'`);
    });
  });

  describe('greaterThanOrEqualAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').greaterThanOrEqualAny([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').greaterThanOrEqualAny([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" >= 1 OR "users"."id" >= 2)');
    });
  });

  describe('greaterThanOrEqualAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').greaterThanOrEqualAll([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').greaterThanOrEqualAll([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" >= 1 AND "users"."id" >= 2)');
    });
  });

  // less than
  describe('lessThan', () => {
    it('should create a LessThan node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').lessThan(10)).toBeInstanceOf(Arel.Nodes.LessThan);
    });

    it('should generate < in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').lessThan(10));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" < 10');
    });

    it('should accept various data types', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').lessThan('fake_name'));
      expect(mgr.toSql()).toMatch('"users"."name" < \'fake_name\'');
      const currentTime = new Date();
      mgr.where(relation.attribute('created_at').lessThan(currentTime));
      expect(mgr.toSql()).toMatch(`"users"."created_at" < '${currentTime.toISOString()}'`);
    });
  });

  describe('lessThanAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').lessThanAny([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').lessThanAny([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" < 1 OR "users"."id" < 2)');
    });
  });

  describe('lessThanAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').lessThanAll([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').lessThanAll([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" < 1 AND "users"."id" < 2)');
    });
  });

  // less than or equal
  describe('lessThanOrEqual', () => {
    it('should create a LessThanOrEqual node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').lessThanOrEqual(10)).toBeInstanceOf(Arel.Nodes.LessThanOrEqual);
    });

    it('should generate <= in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').lessThanOrEqual(10));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" <= 10');
    });

    it('should accept various data types', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').lessThanOrEqual('fake_name'));
      expect(mgr.toSql()).toMatch('"users"."name" <= \'fake_name\'');
      const currentTime = new Date();
      mgr.where(relation.attribute('created_at').lessThanOrEqual(currentTime));
      expect(mgr.toSql()).toMatch(`"users"."created_at" <= '${currentTime.toISOString()}'`);
    });
  });

  describe('lessThanOrEqualAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').lessThanOrEqualAny([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').lessThanOrEqualAny([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" <= 1 OR "users"."id" <= 2)');
    });
  });

  describe('lessThanOrEqualAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').lessThanOrEqualAll([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').lessThanOrEqualAll([1, 2]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE ("users"."id" <= 1 AND "users"."id" <= 2)');
    });
  });

  // matches
  describe('matches', () => {
    it('should create a Matches node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('name').matches('%bacon%')).toBeInstanceOf(Arel.Nodes.Matches);
    });

    it('should generate LIKE in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').matches('%bacon%'));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."name" LIKE \'%bacon%\'');
    });
  });

  describe('matchesAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('name').matchesAny(['%chunky%', '%bacon%'])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').matchesAny(['%chunky%', '%bacon%']));
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."name" LIKE \'%chunky%\' OR "users"."name" LIKE \'%bacon%\')',
      );
    });
  });

  describe('matchesAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('name').matchesAll(['%chunky%', '%bacon%'])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').matchesAll(['%chunky%', '%bacon%']));
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."name" LIKE \'%chunky%\' AND "users"."name" LIKE \'%bacon%\')',
      );
    });
  });

  // does not match
  describe('doesNotMatch', () => {
    it('should create a DoesNotMatch node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('name').doesNotMatch('%bacon%')).toBeInstanceOf(Arel.Nodes.DoesNotMatch);
    });

    it('should generate NOT LIKE in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').doesNotMatch('%bacon%'));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."name" NOT LIKE \'%bacon%\'');
    });
  });

  describe('doesNotMatchAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('name').doesNotMatchAny(['%chunky%', '%bacon%'])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').doesNotMatchAny(['%chunky%', '%bacon%']));
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."name" NOT LIKE \'%chunky%\' OR "users"."name" NOT LIKE \'%bacon%\')',
      );
    });
  });

  describe('doesNotMatchAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('name').doesNotMatchAll(['%chunky%', '%bacon%'])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').doesNotMatchAll(['%chunky%', '%bacon%']));
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."name" NOT LIKE \'%chunky%\' AND "users"."name" NOT LIKE \'%bacon%\')',
      );
    });
  });

  // between
  describe('between', () => {
    it('can be constructed with a standard range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(1, 3);
      expect(node).toBeInstanceOf(Arel.Nodes.Between);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.And);
      expect(node.right.children[0]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.children[1]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.children[0].value).toBe(1);
      expect(node.right.children[1].value).toBe(3);
    });

    it('can be constructed with a range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(-Infinity, 3);
      expect(node).toBeInstanceOf(Arel.Nodes.LessThanOrEqual);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with a quoted range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(new Arel.Nodes.Quoted(-Infinity), new Arel.Nodes.Quoted(3));
      expect(node).toBeInstanceOf(Arel.Nodes.LessThanOrEqual);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Quoted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with an exclusive range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(-Infinity, 3, { excludeEnd: true });
      expect(node).toBeInstanceOf(Arel.Nodes.LessThan);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with a quoted exclusive range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(new Arel.Nodes.Quoted(-Infinity), new Arel.Nodes.Quoted(3), { excludeEnd: true });
      expect(node).toBeInstanceOf(Arel.Nodes.LessThan);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Quoted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with an infinite range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(-Infinity, Infinity);
      expect(node).toBeInstanceOf(Arel.Nodes.NotIn);
      expect(node.left).toBe(attribute);
      expect(node.right).toEqual([]);
    });

    it('can be constructed with a quoted infinite range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(new Arel.Nodes.Quoted(-Infinity), new Arel.Nodes.Quoted(Infinity));
      expect(node).toBeInstanceOf(Arel.Nodes.NotIn);
      expect(node.left).toBe(attribute);
      expect(node.right).toEqual([]);
    });

    it('can be constructed with a range ending at Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(0, Infinity);
      expect(node).toBeInstanceOf(Arel.Nodes.GreaterThanOrEqual);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(0);
    });

    it('can be constructed with a quoted range ending at Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(new Arel.Nodes.Quoted(0), new Arel.Nodes.Quoted(Infinity));
      expect(node).toBeInstanceOf(Arel.Nodes.GreaterThanOrEqual);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Quoted);
      expect(node.right.value).toBe(0);
    });

    it('can be constructed with an exclusive range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(0, 3, { excludeEnd: true });
      expect(node).toBeInstanceOf(Arel.Nodes.And);
      expect(node.children[0]).toBeInstanceOf(Arel.Nodes.GreaterThanOrEqual);
      expect(node.children[1]).toBeInstanceOf(Arel.Nodes.LessThan);
      expect(node.children[0].left).toBe(attribute);
      expect(node.children[0].right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.children[0].right.value).toBe(0);
      expect(node.children[1].left).toBe(attribute);
      expect(node.children[1].right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.children[1].right.value).toBe(3);
    });

    it('can be constructed with a range where the begin and end are equal', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.between(1, 1);
      expect(node).toBeInstanceOf(Arel.Nodes.Equality);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(1);
    });
  });

  describe('notBetween', () => {
    it('can be constructed with a standard range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(1, 3);
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
      const orNode = node.expression;
      expect(orNode).toBeInstanceOf(Arel.Nodes.Or);
      expect(orNode.children[0]).toBeInstanceOf(Arel.Nodes.LessThan);
      expect(orNode.children[0].left).toBe(attribute);
      expect(orNode.children[0].right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(orNode.children[0].right.value).toBe(1);
      expect(orNode.children[1]).toBeInstanceOf(Arel.Nodes.GreaterThan);
      expect(orNode.children[1].left).toBe(attribute);
      expect(orNode.children[1].right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(orNode.children[1].right.value).toBe(3);
    });

    it('can be constructed with a range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(-Infinity, 3);
      expect(node).toBeInstanceOf(Arel.Nodes.GreaterThan);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with a quoted range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(new Arel.Nodes.Quoted(-Infinity), new Arel.Nodes.Quoted(3));
      expect(node).toBeInstanceOf(Arel.Nodes.GreaterThan);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Quoted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with an exclusive range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(-Infinity, 3, { excludeEnd: true });
      expect(node).toBeInstanceOf(Arel.Nodes.GreaterThanOrEqual);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with a quoted exclusive range starting from -Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(new Arel.Nodes.Quoted(-Infinity), new Arel.Nodes.Quoted(3), {
        excludeEnd: true,
      });
      expect(node).toBeInstanceOf(Arel.Nodes.GreaterThanOrEqual);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Quoted);
      expect(node.right.value).toBe(3);
    });

    it('can be constructed with an infinite range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(-Infinity, Infinity);
      expect(node).toBeInstanceOf(Arel.Nodes.In);
      expect(node.left).toBe(attribute);
      expect(node.right).toEqual([]);
    });

    it('can be constructed with a quoted infinite range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(new Arel.Nodes.Quoted(-Infinity), new Arel.Nodes.Quoted(Infinity));
      expect(node).toBeInstanceOf(Arel.Nodes.In);
      expect(node.left).toBe(attribute);
      expect(node.right).toEqual([]);
    });

    it('can be constructed with a range ending at Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(0, Infinity);
      expect(node).toBeInstanceOf(Arel.Nodes.LessThan);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(0);
    });

    it('can be constructed with a quoted range ending at Infinity', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(new Arel.Nodes.Quoted(0), new Arel.Nodes.Quoted(Infinity));
      expect(node).toBeInstanceOf(Arel.Nodes.LessThan);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Quoted);
      expect(node.right.value).toBe(0);
    });

    it('can be constructed with an exclusive range', () => {
      const attribute = new Arel.Table('users').attribute('createdAt');
      const node = attribute.notBetween(0, 3, { excludeEnd: true });
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
      const orNode = node.expression;
      expect(orNode).toBeInstanceOf(Arel.Nodes.Or);
      expect(orNode.children[0]).toBeInstanceOf(Arel.Nodes.LessThan);
      expect(orNode.children[0].left).toBe(attribute);
      expect(orNode.children[0].right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(orNode.children[0].right.value).toBe(0);
      expect(orNode.children[1]).toBeInstanceOf(Arel.Nodes.GreaterThanOrEqual);
      expect(orNode.children[1].left).toBe(attribute);
      expect(orNode.children[1].right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(orNode.children[1].right.value).toBe(3);
    });
  });

  // in
  describe('in', () => {
    it('can be constructed with a subquery', () => {
      const relation = new Arel.Table('users');
      const mgr = relation
        .project(relation.attribute('id'))
        .where(relation.attribute('name').doesNotMatchAll(['%chunky%', '%bacon%']));
      const attribute = relation.attribute('name');
      const node = attribute.in(mgr);
      expect(node).toBeInstanceOf(Arel.Nodes.In);
      expect(node.left).toBe(attribute);
      expect(node.right).toEqual(mgr.ast);
    });

    it('can be constructed with a union', () => {
      const relation = new Arel.Table('users');
      const mgr1 = relation.project(relation.attribute('id'));
      const mgr2 = relation.project(relation.attribute('id'));
      const union = mgr1.union(mgr2);
      const mgr = relation.project(relation.attribute('id').in(union));
      expect(mgr.toSql()).toMatch(
        '"users"."id" IN (( SELECT "users"."id" FROM "users" UNION SELECT "users"."id" FROM "users" ))',
      );
    });

    it('can be constructed with a list', () => {
      const attribute = new Arel.Table('users').attribute('id');
      const node = attribute.in([1, 2, 3]);
      expect(node).toBeInstanceOf(Arel.Nodes.In);
      expect(node.left).toBe(attribute);
      expect(node.right.length).toBe(3);
      expect(node.right[0]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right[0].value).toBe(1);
      expect(node.right[1]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right[1].value).toBe(2);
      expect(node.right[2]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right[2].value).toBe(3);
    });

    it('can be constructed with a random object', () => {
      const attribute = new Arel.Table('users').attribute('id');
      const randomObject = {};
      const node = attribute.in(randomObject);
      expect(node).toBeInstanceOf(Arel.Nodes.In);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(randomObject);
    });

    it('should generate IN in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').in([1, 2, 3]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" IN (1, 2, 3)');
    });
  });

  describe('inAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      const node = relation.attribute('id').inAny([1, 2]);
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(
        relation.attribute('id').inAny([
          [1, 2],
          [3, 4],
        ]),
      );
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."id" IN (1, 2) OR "users"."id" IN (3, 4))',
      );
    });
  });

  describe('inAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      const node = relation.attribute('id').inAll([1, 2]);
      expect(node).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(
        relation.attribute('id').inAll([
          [1, 2],
          [3, 4],
        ]),
      );
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."id" IN (1, 2) AND "users"."id" IN (3, 4))',
      );
    });
  });

  // not in
  describe('notIn', () => {
    it('can be constructed with a subquery', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('name').doesNotMatchAll(['%chunky%', '%bacon%']));
      const attribute = relation.attribute('name');
      const node = attribute.notIn(mgr);
      expect(node).toBeInstanceOf(Arel.Nodes.NotIn);
      expect(node.left).toBe(attribute);
      expect(node.right).toEqual(mgr.ast);
    });

    it('can be constructed with a union', () => {
      const relation = new Arel.Table('users');
      const mgr1 = relation.project(relation.attribute('id'));
      const mgr2 = relation.project(relation.attribute('id'));
      const union = mgr1.union(mgr2);
      const mgr = relation.project(relation.attribute('id').notIn(union));
      expect(mgr.toSql()).toMatch(
        '"users"."id" NOT IN (( SELECT "users"."id" FROM "users" UNION SELECT "users"."id" FROM "users" ))',
      );
    });

    it('can be constructed with a list', () => {
      const attribute = new Arel.Table('users').attribute('id');
      const node = attribute.notIn([1, 2, 3]);
      expect(node).toBeInstanceOf(Arel.Nodes.NotIn);
      expect(node.left).toBe(attribute);
      expect(node.right.length).toBe(3);
      expect(node.right[0]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right[0].value).toBe(1);
      expect(node.right[1]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right[1].value).toBe(2);
      expect(node.right[2]).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right[2].value).toBe(3);
    });

    it('can be constructed with a random object', () => {
      const attribute = new Arel.Table('users').attribute('id');
      const randomObject = {};
      const node = attribute.notIn(randomObject);
      expect(node).toBeInstanceOf(Arel.Nodes.NotIn);
      expect(node.left).toBe(attribute);
      expect(node.right).toBeInstanceOf(Arel.Nodes.Casted);
      expect(node.right.value).toBe(randomObject);
    });

    it('should generate NOT IN in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(relation.attribute('id').notIn([1, 2, 3]));
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" WHERE "users"."id" NOT IN (1, 2, 3)');
    });
  });

  describe('notInAny', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').notInAny([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ORs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(
        relation.attribute('id').notInAny([
          [1, 2],
          [3, 4],
        ]),
      );
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."id" NOT IN (1, 2) OR "users"."id" NOT IN (3, 4))',
      );
    });
  });

  describe('notInAll', () => {
    it('should create a Grouping node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').notInAll([1, 2])).toBeInstanceOf(Arel.Nodes.Grouping);
    });

    it('should generate ANDs in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.where(
        relation.attribute('id').notInAll([
          [1, 2],
          [3, 4],
        ]),
      );
      expect(mgr.toSql()).toEqual(
        'SELECT "users"."id" FROM "users" WHERE ("users"."id" NOT IN (1, 2) AND "users"."id" NOT IN (3, 4))',
      );
    });
  });

  // ordering

  describe('ascending', () => {
    it('should generate an ascending node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').ascending()).toBeInstanceOf(Arel.Nodes.Ascending);
    });

    it('should generate ASC in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.order(relation.attribute('id').ascending());
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" ORDER BY "users"."id" ASC');
    });
  });

  describe('descending', () => {
    it('should create a Descending node', () => {
      const relation = new Arel.Table('users');
      expect(relation.attribute('id').descending()).toBeInstanceOf(Arel.Nodes.Descending);
    });

    it('should generate DESC in sql', () => {
      const relation = new Arel.Table('users');
      const mgr = relation.project(relation.attribute('id'));
      mgr.order(relation.attribute('id').descending());
      expect(mgr.toSql()).toEqual('SELECT "users"."id" FROM "users" ORDER BY "users"."id" DESC');
    });
  });

  // containment
  describe('contains', () => {
    it('should create a Contains node', () => {
      const relation = new Arel.Table('products');
      const node = relation.attribute('tags').contains(['foo', 'bar']);
      expect(node).toBeInstanceOf(Arel.Nodes.Contains);
      expect(node.operator).toBe('@>');
    });

    // it('should generate @> in sql', () => {
    //   const relation = new Arel.Table('products', typeCaster: pgTextDecoderArrayCaster);
    //   const mgr = relation.project(relation.attribute('id'));
    //   mgr.where(relation.attribute('tags').contains(['foo', 'bar']));
    //   expect(mgr.toSql()).toEqual(
    //     'SELECT "products"."id" FROM "products" WHERE "products"."tags" @> \'{"foo","bar"}\'',
    //   );
    // });
  });

  describe('overlaps', () => {
    it('should create an Overlaps node', () => {
      const relation = new Arel.Table('products');
      const node = relation.attribute('tags').overlaps(['foo', 'bar']);
      expect(node).toBeInstanceOf(Arel.Nodes.Overlaps);
      expect(node.operator).toBe('&&');
    });

    // it('should generate && in sql', () => {
    //   const relation = new Arel.Table('products', typeCaster: pgTextDecoderArrayCaster);
    //   const mgr = relation.project(relation.attribute('id'));
    //   mgr.where(relation.attribute('tags').overlaps(['foo', 'bar']));
    //   expect(mgr.toSql()).toEqual('SELECT "products"."id" FROM "products" WHERE "products"."tags" && \'{foo,bar}\'');
    // });
  });

  // # Mimic PG::TextDecoder::Array casting
  // def fake_pg_caster
  //   Object.new.tap do |caster|
  //     def caster.type_cast_for_database(attr_name, value)
  //       if attr_name == "tags"
  //         "{#{value.join(",")}}"
  //       else
  //         value
  //       end
  //     end
  //   end
  // end
  describe('type casting', () => {
    it('does not type cast by default', () => {
      const relation = new Arel.Table('foo');
      const condition = relation.project(relation.attribute('id').equal('1'));
      expect(relation.ableToTypeCast()).toBe(false);
      expect(condition.toSql()).toMatch('"foo"."id" = \'1\'');
    });

    // it "type casts when given an explicit caster" do
    //   fake_caster = Object.new
    //   def fake_caster.type_cast_for_database(attr_name, value)
    //     if attr_name == "id"
    //       value.to_i
    //     else
    //       value
    //     end
    //   end
    //   table = Table.new(:foo, type_caster: fake_caster)
    //   condition = table["id"].eq("1").and(table["other_id"].eq("2"))
    //   assert_predicate table, :able_to_type_cast?
    //   _(condition.to_sql).must_equal %("foo"."id" = 1 AND "foo"."other_id" = '2')
    // end
    // it "does not type cast SqlLiteral Arel.Nodes" do
    //   fake_caster = Object.new
    //   def fake_caster.type_cast_for_database(attr_name, value)
    //     value.to_i
    //   end
    //   table = Table.new(:foo, type_caster: fake_caster)
    //   condition = table["id"].eq(Arel.sql("(select 1)"))
    //   assert_predicate table, :able_to_type_cast?
    //   _(condition.to_sql).must_equal %("foo"."id" = (select 1))
    // end
  });
});
