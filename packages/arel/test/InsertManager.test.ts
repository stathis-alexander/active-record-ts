import { describe, expect, it } from 'bun:test';
import Arel from '../src';

describe('InsertManager', () => {
  describe('insert', () => {
    it('can create a ValuesList node', () => {
      const manager = new Arel.InsertManager();
      const values = manager.createValuesList([
        ['a', 'b'],
        ['c', 'd'],
      ]);

      expect(values).toBeInstanceOf(Arel.Nodes.ValuesList);
      expect(values.rows).toEqual([
        ['a', 'b'],
        ['c', 'd'],
      ]);
    });

    it('allows sql literals', () => {
      const manager = new Arel.InsertManager();
      const table = new Arel.Table('users');
      manager.into(table);
      const values = manager.createValues([Arel.sql('*')]);
      manager.values(values);
      expect(manager.toSql()).toContain('INSERT INTO "users" VALUES (*)');
    });

    it('works with multiple values', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);

      const columns = manager.columns();
      columns.push(table.attribute('id'));
      columns.push(table.attribute('name'));

      const values = manager.createValuesList([
        ['1', 'david'],
        ['2', 'kir'],
        ['3', Arel.sql('DEFAULT')],
      ]);
      manager.values(values);

      expect(manager.toSql()).toContain(
        "INSERT INTO \"users\" (\"id\", \"name\") VALUES ('1', 'david'), ('2', 'kir'), ('3', DEFAULT)",
      );
    });

    it('literals in multiple values are not escaped', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);

      const columns = manager.columns();
      columns.push(table.attribute('name'));

      const values = manager.createValuesList([[Arel.sql('*')], [Arel.sql('DEFAULT')]]);
      manager.values(values);

      expect(manager.toSql()).toContain('INSERT INTO "users" ("name") VALUES (*), (DEFAULT)');
    });

    it('works with multiple single values', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);

      const columns = manager.columns();
      columns.push(table.attribute('name'));

      const values = manager.createValuesList([['david'], ['kir'], [Arel.sql('DEFAULT')]]);
      manager.values(values);

      expect(manager.toSql()).toContain('INSERT INTO "users" ("name") VALUES (\'david\'), (\'kir\'), (DEFAULT)');
    });

    it('inserts false', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();

      manager.insert([[table.attribute('bool'), false]]);
      expect(manager.toSql()).toContain('INSERT INTO "users" ("bool") VALUES (\'f\')');
    });

    it('inserts null', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.insert([[table.attribute('id'), null]]);
      expect(manager.toSql()).toContain('INSERT INTO "users" ("id") VALUES (NULL)');
    });

    it('inserts time', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();

      const time = new Date();
      const attribute = table.attribute('created_at');

      manager.insert([[attribute, time]]);
      expect(manager.toSql()).toContain('INSERT INTO "users" ("created_at") VALUES');
    });

    it('takes a list of lists', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);
      manager.insert([
        [table.attribute('id'), 1],
        [table.attribute('name'), 'aaron'],
      ]);
      expect(manager.toSql()).toContain('INSERT INTO "users" ("id", "name") VALUES (1, \'aaron\')');
    });

    it('defaults the table', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.insert([
        [table.attribute('id'), 1],
        [table.attribute('name'), 'aaron'],
      ]);
      expect(manager.toSql()).toContain('INSERT INTO "users" ("id", "name") VALUES (1, \'aaron\')');
    });

    it('noop for empty list', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.insert([[table.attribute('id'), 1]]);
      manager.insert([]);
      expect(manager.toSql()).toContain('INSERT INTO "users" ("id") VALUES (1)');
    });

    it('is chainable', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      const insertResult = manager.insert([[table.attribute('id'), 1]]);
      expect(insertResult).toBe(manager);
    });
  });

  describe('into', () => {
    it('takes a Arel.Table and chains', () => {
      const manager = new Arel.InsertManager();
      const table = new Arel.Table('users');
      expect(manager.into(table)).toBe(manager);
    });

    it('converts to sql', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);
      expect(manager.toSql()).toContain('INSERT INTO "users"');
    });
  });

  describe('columns', () => {
    it('converts to sql', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);
      const columns = manager.columns();
      columns.push(table.attribute('id'));
      expect(manager.toSql()).toContain('INSERT INTO "users" ("id")');
    });
  });

  describe('values', () => {
    it('converts to sql', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);

      manager.values(new Arel.Nodes.ValuesList([[1], [2]]));
      expect(manager.toSql()).toContain('INSERT INTO "users" VALUES (1), (2)');
    });

    it('accepts sql literals', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);

      manager.values(Arel.sql('DEFAULT VALUES'));
      expect(manager.toSql()).toContain('INSERT INTO "users" DEFAULT VALUES');
    });
  });

  describe('combo', () => {
    it('combines columns and values list in order', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(table);

      manager.values(
        new Arel.Nodes.ValuesList([
          [1, 'aaron'],
          [2, 'david'],
        ]),
      );
      const columns = manager.columns();
      columns.push(table.attribute('id'));
      columns.push(table.attribute('name'));
      expect(manager.toSql()).toContain('INSERT INTO "users" ("id", "name") VALUES (1, \'aaron\'), (2, \'david\')');
    });
  });

  describe('select', () => {
    it('accepts a select query in place of a VALUES clause', () => {
      const table = new Arel.Table('users');

      const manager = new Arel.InsertManager();
      manager.into(table);

      const select = new Arel.SelectManager(table);
      select.project(Arel.sql('1'));
      select.project(Arel.sql('"aaron"'));

      manager.select(select);
      const columns = manager.columns();
      columns.push(table.attribute('id'));
      columns.push(table.attribute('name'));
      expect(manager.toSql()).toContain('INSERT INTO "users" ("id", "name") (SELECT 1, "aaron")');
    });
  });

  describe('returning', () => {
    it('accepts a returning clause', () => {
      const users = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(users);
      manager.returning(Arel.star);

      expect(manager.toSql()).toContain('INSERT INTO "users" RETURNING *');
    });

    it('accepts multiple values as returning clause', () => {
      const users = new Arel.Table('users');
      const manager = new Arel.InsertManager();
      manager.into(users);
      manager.returning(Arel.star);
      manager.returning([users.attribute('id'), users.attribute('name')]);

      expect(manager.toSql()).toContain('INSERT INTO "users" RETURNING *, "users"."id", "users"."name"');
    });

    it('chains', () => {
      const manager = new Arel.InsertManager();
      expect(manager.returning(Arel.star)).toBe(manager);
    });
  });
});
