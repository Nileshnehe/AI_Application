import express from 'express';
import helmet from 'helmet';
// import cors from 'cors';
import { ENV } from './config/env';
import { authLimiter } from './middlewares/rateLimiter';
import router from './routes';
import { errorHandler } from './middlewares/error.middleware';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';

const app = express();

app.use(helmet());
// app.use(
//     cors({
//         origin: ENV.CLIENT_URL,
//         credentials: true,
//     })
// );

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
    pinoHttp({
        transport: ENV.NODE_ENV !== 'production' ? { target: 'pino-pretty'} : undefined,
    })
);

// app.use('/api', authLimiter);
app.use('/api/v1', router);

app.use(errorHandler);



export default app;
