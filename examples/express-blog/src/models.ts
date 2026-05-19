import { Base, type Relation } from '@active-record-ts/active-record';

export class User extends Base {
  static override tableName = 'users';
  declare name: string;
  declare email: string;
  declare posts: Relation<Post>;
}

export class Post extends Base {
  static override tableName = 'posts';
  declare user_id: number;
  declare title: string;
  declare body: string | null;
  declare published: boolean;
  declare created_at: Date;
  declare user: Promise<User | null>;
}

User.validates('name', { presence: true });
User.validates('email', { presence: true, format: { with: /@/ } });

Post.validates('title', { presence: true, length: { minimum: 3 } });
Post.validates('user_id', { presence: true });

Post.belongsTo('user', { class: () => User });
User.hasMany('posts', { class: () => Post, dependent: 'destroy' });

Post.beforeSave((p) => {
  p.title = p.title.trim();
});
