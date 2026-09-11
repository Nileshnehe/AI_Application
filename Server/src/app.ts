import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { ENV } from './config/env';

const app=express();

app.use(helmet());
app.use(
    cors({
        origin: 'ENV_CLIENT_URL',
        credentials: true,
    })
);



export default app;
