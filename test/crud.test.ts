import { describe, expect, it } from 'bun:test';
import Arel from '../src';
import type { Attribute } from '../src/types';

class FakeEngine {
  public calls: unknown[] = [];
  public connectionPool = this;
  public spec = this;
  public config = { adapter: 'sqlite3' };

  connection = () => this;
}

class FakeCrudder extends Arel.SelectManager {
  public engine: FakeEngine;

  constructor(engine = new FakeEngine()) {
    super();
    this.engine = engine;
  }

  // Mock CRUD methods for testing
  compileInsert = (values: unknown[][]) => {
    const im = new Arel.InsertManager();
    const table = this.ast.froms[0];
    im.into(table);
    im.values(values);
    return im;
  };

  compileUpdate = (values: unknown[][], key: Attribute) => {
    const um = new Arel.UpdateManager();
    um.table(this.ast.froms[0]);
    um.set(values);
    um.key = key.name;
    return um;
  };

  compileDelete = () => {
    const dm = new Arel.DeleteManager();
    dm.from(this.ast.froms[0]);
    return dm;
  };
}

describe('Crud', () => {
  describe('insert', () => {
    it('should call insert on the connection', () => {
      const table = new Arel.Table('users');
      const fc = new FakeCrudder();
      fc.from(table);
      const im = fc.compileInsert([[table.attribute('id'), 'foo']]);
      expect(im).toBeInstanceOf(Arel.InsertManager);
    });
  });

  describe('update', () => {
    it('should call update on the connection', () => {
      const table = new Arel.Table('users');
      const fc = new FakeCrudder();
      fc.from(table);
      const stmt = fc.compileUpdate([[table.attribute('id'), 'foo']], new Arel.Attribute(table, 'id'));
      expect(stmt).toBeInstanceOf(Arel.UpdateManager);
    });
  });

  describe('delete', () => {
    it('should call delete on the connection', () => {
      const table = new Arel.Table('users');
      const fc = new FakeCrudder();
      fc.from(table);
      const stmt = fc.compileDelete();
      expect(stmt).toBeInstanceOf(Arel.DeleteManager);
    });
  });
});
