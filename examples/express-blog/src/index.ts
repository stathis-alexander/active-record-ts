import path from 'node:path';
import { RecordInvalid, RecordNotFound } from '@active-record-ts/active-record';
import express, { type NextFunction, type Request, type Response } from 'express';
import { setupDatabase } from './db';
import { Post, User } from './models';

const app = express();
app.use(express.json());
app.use(express.static(path.join(import.meta.dir, '..', 'public')));

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

// --- Users ----------------------------------------------------------------

app.get(
  '/users/find',
  asyncHandler(async (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!name || !email) {
      res.status(400).json({ error: 'name and email are required' });
      return;
    }
    const existing = await User.findBy({ name, email });
    if (existing) {
      res.json({ ...existing.attributes(), created: false });
      return;
    }
    const user = new User({ name, email });
    if (!(await user.save())) {
      res.status(422).json({ errors: user.errors.fullMessages });
      return;
    }
    res.status(201).json({ ...user.attributes(), created: true });
  }),
);

app.post(
  '/users',
  asyncHandler(async (req, res) => {
    const user = new User(req.body);
    if (!(await user.save())) {
      res.status(422).json({ errors: user.errors.fullMessages });
      return;
    }
    res.status(201).json(user.attributes());
  }),
);

app.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await User.find(Number(req.params.id));
    res.json(user.attributes());
  }),
);

app.get(
  '/users/:id/posts',
  asyncHandler(async (req, res) => {
    const user = await User.find(Number(req.params.id));
    const posts = await user.posts.order({ created_at: 'desc' });
    res.json(posts.map((p: Post) => p.attributes()));
  }),
);

// --- Posts ----------------------------------------------------------------

app.get(
  '/posts',
  asyncHandler(async (req, res) => {
    let rel = Post.order({ created_at: 'desc' });
    if (req.query.published === 'true') rel = rel.where({ published: true });
    const limit = Number(req.query.limit ?? 20);
    res.json((await rel.limit(limit)).map((p) => p.attributes()));
  }),
);

app.post(
  '/posts',
  asyncHandler(async (req, res) => {
    await Post.transaction(async () => {
      const post = new Post(req.body);
      if (!(await post.save())) {
        res.status(422).json({ errors: post.errors.fullMessages });
        return;
      }
      res.status(201).json(post.attributes());
    });
  }),
);

app.patch(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const post = await Post.find(Number(req.params.id));
    if (!(await post.update(req.body))) {
      res.status(422).json({ errors: post.errors.fullMessages });
      return;
    }
    res.json({ ...post.attributes(), changed: post.savedChanges() });
  }),
);

app.delete(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const post = await Post.find(Number(req.params.id));
    await post.destroy();
    res.status(204).end();
  }),
);

// --- Errors ---------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof RecordNotFound) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof RecordInvalid) {
    res.status(422).json({ errors: err.record.errors.fullMessages });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

// --- Boot -----------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3000);

await setupDatabase();
app.listen(PORT, () => {
  console.log(`express-blog listening on http://localhost:${PORT}`);
});
