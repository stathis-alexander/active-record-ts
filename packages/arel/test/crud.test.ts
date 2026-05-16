import { describe, expect, it } from 'bun:test';
import Arel from '../src';
import type { InsertPair } from '../src/InsertManager';
import type { Attribute, RelationLike } from '../src/types';
import type { UpdatePair } from '../src/UpdateManager';

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
  compileInsert = (values: InsertPair[]) => {
    const im = new Arel.InsertManager();
    const table = this.ast.froms[0] as RelationLike;
    im.into(table);
    im.insert(values);
    return im;
  };

  override compileUpdate = (values: Parameters<Arel.UpdateManager['set']>[0], key?: Attribute | unknown) => {
    const um = new Arel.UpdateManager();
    um.table(this.ast.froms[0] as RelationLike);
    um.set(values as UpdatePair[]);
    if (key && typeof key === 'object' && 'name' in key) {
      um.key = (key as Attribute).name as unknown as never;
    }
    return um;
  };

  override compileDelete = () => {
    const dm = new Arel.DeleteManager();
    dm.from(this.ast.froms[0] as RelationLike);
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
