import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/auth.types";
import redisClient from "../config/redis";
import { verifyAccessToken } from "../utils/jwt";

export const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer')) {
            res.status(401).json({ status: 'error', message: 'Authentication required' });
            return;
        }

        const token = authHeader.split(' ')[1];

        const isBlackListed = await redisClient.get(`blacklist:${token}`);
        if (isBlackListed) {
            res.status(401).json({ status: 'error', message: 'Token revoked' });
            return;
        }

        const payload = verifyAccessToken(token);
        req.user = payload;
        next();
    } catch (error) {
        console.error('Error in auth middleware:', error);
        res.status(401).json({ status: 'error', message: 'Invalid or expired access token' });
    }
}