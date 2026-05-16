/**
 * Shared fixtures for ported Rails ActiveRecord tests. The Rails test
 * suite leans on a sprawling set of models (Topic, Post, Author, Comment,
 * Reply, Person, Developer, etc.) with intertwined associations. We
 * stand up a focused subset — just the columns the ported tests touch —
 * against an in-memory SQLite database.
 *
 * Each `setupFixtures()` call returns a `{ adapter, classes }` pair the
 * tests can use directly. Tests that require associations or other
 * unimplemented surface should `test.skip` rather than depend on these
 * fixtures.
 */

import { Base, Migration, Migrator, SQLiteAdapter, type MigrationConstructor } from '../../src';

export class Topic extends Base {
  static override tableName = 'topics';
  declare title: string;
  declare author_name: string;
  declare author_email_address: string;
  declare content: string;
  declare approved: boolean;
  declare replies_count: number;
  declare type: string;
}

export class Post extends Base {
  static override tableName = 'posts';
  declare title: string;
  declare body: string;
  declare type: string;
}

export class Developer extends Base {
  static override tableName = 'developers';
  declare name: string;
  declare salary: number;
}

export class Author extends Base {
  static override tableName = 'authors';
  declare name: string;
}

export class Comment extends Base {
  static override tableName = 'comments';
  declare body: string;
  declare post_id: number;
}

export class Person extends Base {
  static override tableName = 'people';
  declare first_name: string;
  declare last_name: string;
}

class CreateTopics extends Migration {
  static override version = '001-topics';
  override async up() {
    await this.createTable('topics', (t) => {
      t.string('title');
      t.string('author_name');
      t.string('author_email_address');
      t.text('content');
      t.boolean('approved', { default: true });
      t.integer('replies_count', { default: 0 });
      t.string('type');
      t.timestamps({ null: true });
    });
  }
}
class CreatePosts extends Migration {
  static override version = '002-posts';
  override async up() {
    await this.createTable('posts', (t) => {
      t.string('title');
      t.text('body');
      t.string('type');
    });
  }
}
class CreateDevelopers extends Migration {
  static override version = '003-developers';
  override async up() {
    await this.createTable('developers', (t) => {
      t.string('name');
      t.integer('salary', { default: 70000 });
    });
  }
}
class CreateAuthors extends Migration {
  static override version = '004-authors';
  override async up() {
    await this.createTable('authors', (t) => {
      t.string('name');
    });
  }
}
class CreateComments extends Migration {
  static override version = '005-comments';
  override async up() {
    await this.createTable('comments', (t) => {
      t.text('body');
      t.integer('post_id');
    });
  }
}
class CreatePeople extends Migration {
  static override version = '006-people';
  override async up() {
    await this.createTable('people', (t) => {
      t.string('first_name');
      t.string('last_name');
    });
  }
}

const MIGRATIONS: MigrationConstructor[] = [
  CreateTopics,
  CreatePosts,
  CreateDevelopers,
  CreateAuthors,
  CreateComments,
  CreatePeople,
];

const KLASSES = [Topic, Post, Developer, Author, Comment, Person];

export type Fixtures = {
  adapter: SQLiteAdapter;
  classes: typeof KLASSES;
  reset(): Promise<void>;
  teardown(): Promise<void>;
};

export const setupFixtures = async (): Promise<Fixtures> => {
  const adapter = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
  await adapter.connect();
  await new Migrator(adapter, MIGRATIONS).up();
  for (const K of KLASSES) {
    K.useConnection(adapter);
    await K.loadSchema();
  }
  return {
    adapter,
    classes: KLASSES,
    async reset() {
      for (const K of KLASSES) {
        await adapter.exec(`DELETE FROM ${adapter.quoteIdentifier(K.effectiveTableName())}`);
      }
    },
    async teardown() {
      await adapter.disconnect();
    },
  };
};
