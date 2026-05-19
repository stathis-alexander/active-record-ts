import { Migration } from '@arelts/active-record';

export default class CreateUsers extends Migration {
  static override version = '20260101000001';

  override async up() {
    await this.createTable('users', (t) => {
      t.string('name', { null: false });
      t.string('email', { null: false, index: { unique: true } });
      t.timestamps();
    });
  }

  override async down() {
    await this.dropTable('users');
  }
}
