import { Migration } from '@active-record-ts/active-record';

export default class CreatePosts extends Migration {
  static override version = '20260101000002';

  override async up() {
    await this.createTable('posts', (t) => {
      t.integer('user_id', { null: false, index: true });
      t.string('title', { null: false });
      t.text('body');
      t.boolean('published', { default: false });
      t.timestamps();
    });
  }

  override async down() {
    await this.dropTable('posts');
  }
}
