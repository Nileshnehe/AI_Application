import { Request } from "express";
import {JwtPayload} from 'jsonwebtoken'

export interface TokenPayload extends JwtPayload {
    userId: string,
    email: string;
}

export interface AuthenticatedRequest extends Request {
    user?: TokenPayload
}
