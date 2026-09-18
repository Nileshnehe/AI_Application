import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from 'crypto'
import { User } from "../models/user.model";
import { generateRandomToken } from "../utils/crypto";
import { ENV } from "../config/env";
import { sendEmail } from "../utils/email";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import redisClient from "../config/redis";


export const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, 'Name must be at least 3 characters long')
        .max(50, 'Name cannot exceed 50 characters'),

    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const verifyEmailSchema = z.object({
    email: z.string().email(),
    token: z.string().min(1, 'Token is required')
});

const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 1000;

export class AuthController {
    static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { name, email, password } = req.body;

            const existingUser = await User.findOne({ email });

            const { rawToken, hashedToken } = generateRandomToken();
            const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

            if (existingUser) {
                if (existingUser.isVerified) {
                    res.status(409).json({
                        status: 'error',
                        message: 'Email Already Registered. Please login.'
                    });
                    return;
                }

                existingUser.name = name;
                existingUser.password = password;
                existingUser.emailVerificationToken = hashedToken;
                existingUser.emailVerificationExpires = tokenExpires;

                await existingUser.save();

                const verifyUrl = `${ENV.CLIENT_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(existingUser.email)}`;

                await sendEmail({
                    to: existingUser.email,
                    subject: 'Verify Your Email (Resend)',
                    html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email. Link expires in 24 hours.</p>`,
                });

                res.status(200).json({
                    status: 'success',
                    message: 'Account exists but was unverified. A new verification email has been sent.',
                });
                return;
            }

            const newUser = await User.create({
                name,
                email,
                password,
                emailVerificationToken: hashedToken,
                emailVerificationExpires: tokenExpires
            });

            const verifyUrl = `${ENV.CLIENT_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(newUser.email)}`;

            await sendEmail({
                to: newUser.email,
                subject: 'Verify Your Email',
                html: `<p>Click <a href="${verifyUrl}">VerifyEmail</a> to verify your email. Link expires in 24 hours.</p>`,
            });

            res.status(201).json({
                status: 'success',
                message: 'Account created. Verification email has been sent.',
            });

        } catch (error) {
            console.error('Error in register controller:', error);
            next(error);
        }
    }

    static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, token } = req.body;

            const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires');
            if (!user) {
                res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
                return;
            }

            if (user.isVerified) {
                res.status(400).json({
                    status: 'error',
                    message: 'User already verified'
                });
                return;
            }

            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            // console.log("1. Token received from Postman:", token);
            // console.log("2. After the hash is:", hashedToken);
            // console.log("3. Database saved Token:", user.emailVerificationToken);

            if (user.emailVerificationToken !== hashedToken) {
                res.status(400).json({
                    status: 'error',
                    message: 'Invalid or expired verification token'
                });
                return;
            }

            if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
                res.status(400).json({
                    status: 'error',
                    message: 'Verification token has been expired. Please register again'
                });
                return;
            }

            user.isVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;

            await user.save();

            res.status(200).json({
                status: 'success',
                message: 'Email verified successfully. You can login now'
            });

        } catch (error) {
            console.error('Error in verifyEmail controller:', error);
            next(error);
        }
    }

    static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email }).select('+password');
            if (!user) {
                res.status(401).json({
                    success: 'error',
                    message: 'Invalid credentials'
                });
                return;
            }

            const accessToken = signAccessToken({ userId: user._id.toString(), email: user.email });
            const refreshToken = signRefreshToken({ userId: user._id.toString(), email: user.email })

            redisClient.set(
                `refresh_session:${user._id.toString()}:${refreshToken}`,
                '1',
                'EX',
                7 * 24 * 60 * 60
            );

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: REFRESH_TOKEN_MAX_AGE_MS
            });

            res.status(200).json({
                status: 'success',
                message: 'Login successfully',
                data: {
                    accessToken,
                    user: { id: user._id, email: user.email },
                },
            });
        } catch (error) {
           console.error('Error in login controller', error);
           next(error);
        }
    }
}


