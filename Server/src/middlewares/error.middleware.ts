import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env";

export const errorHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        status: 'error',
        message,
        ...(ENV.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};