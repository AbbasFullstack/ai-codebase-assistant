import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import { env } from './config/env.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/api', apiRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(env.port, () => {
  console.log(`[server] listening on :${env.port} (${env.nodeEnv})`);
});
