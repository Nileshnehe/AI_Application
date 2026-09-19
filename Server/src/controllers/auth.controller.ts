import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { User } from "../models/user.model";
import { generateRandomToken, hashToken } from "../utils/crypto";
import { ENV } from "../config/env";
import { sendEmail } from "../utils/email";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
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
      const { token, email } = req.query;

      if (!token || !email || typeof token !== 'string' || typeof email !== 'string') {
        res.status(400).json({ status: 'error', message: 'Invalid verification query parameters' });
        return;
      }

      const hashedToken = hashToken(token);

      const user = await User.findOne({
        email,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date() },
      }).select('+emailVerificationToken +emailVerificationExpires');

      if (!user) {
        res.status(400).json({ status: 'error', message: 'Invalid or expired verification token' });
        return;
      }

      user.isVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      res.status(200).json({ status: 'success', message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
      console.error('Error in verifyEmail controller:', error)
      next(error);
    }
  }

    static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email }).select('+password');
            if (!user || !(await user.comparePassword(password))) {
                res.status(401).json({
                    success: 'error',
                    message: 'Invalid credentials'
                });
                return;
            }

            const accessToken = signAccessToken({ userId: user._id.toString(), email: user.email });
            const refreshToken = signRefreshToken({ userId: user._id.toString(), email: user.email })

            await redisClient.set(
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

    static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email } = req.body;
            const user = await User.findOne({ email });

            if (!user) {
                res.status(200).json({
                    status: 'success',
                    message: 'If an account exists with this email, a password reset link has been dispatched.',
                });
                return;
            }

            const { rawToken, hashedToken } = generateRandomToken();
            user.passwordResetToken = hashedToken;
            user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
            await user.save();

            const resetUrl = `${ENV.CLIENT_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

            await sendEmail({
                to: user.email,
                subject: 'Password Reset Request',
                html: `<p>Reset your password by visiting <a href="${resetUrl}">this link</a>. Valid for 15 minutes.</p>`,
            });

            res.status(200).json({
                status: 'success',
                message: 'If an account with this email, a password link has been dispatched.',
            });

        } catch (error) {
            console.error('Error in forgotPassword controller:', error);
            next(error);
        }
    }

    static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { token, password } = req.body;
            const hashed = hashToken(token);

            const user = await User.findOne({
                passwordResetToken: hashed,
                passwordResetExpires: { $gt: new Date() },
            }).select('+passwordResetToken +passwordResetExpires');

            if (!user) {
                res.status(400).json({
                    success: 'error',
                    message: 'Token is invalid or expired'
                });
                return;
            }

            user.password = password;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            const stream = redisClient.scanStream({ match: `refresh_session:${user._id.toString()}:*` });
            stream.on('data', (keys: string[]) => {
                if (keys.length) redisClient.del(...keys);
            });

            res.status(200).json({
                status: 'success',
                message: 'Password updated. Please log in with new credentials.'
            });
        } catch (error) {
            console.error('Error in resetPassword controller:', error);
            next(error);
        }
    }

    static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const token = req.cookies.refreshToken;
            if (!token) {
                res.status(401).json({ status: 'error', message: 'Missing refresh token' });
                return;
            }

            const payload = verifyRefreshToken(token);
            const sessionKey = `refresh_session:${payload.userId}:${token}`;
            const sessionExists = await redisClient.get(sessionKey);

            if (!sessionExists) {
                res.status(401).json({ status: 'error', message: 'Invalid or revoked refresh session' });
                return;
            }

            // Rotate Refresh Token
            await redisClient.del(sessionKey);
            const newAccessToken = signAccessToken({ userId: payload.userId, email: payload.email });
            const newRefreshToken = signRefreshToken({ userId: payload.userId, email: payload.email });

            await redisClient.set(
                `refresh_session:${payload.userId}:${newRefreshToken}`,
                '1',
                'EX',
                7 * 24 * 60 * 60
            );

            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: REFRESH_TOKEN_MAX_AGE_MS,
            });

            res.status(200).json({
                status: 'success',
                data: { accessToken: newAccessToken },
            });
        } catch {
            res.status(401).json({
                status: 'error',
                message: 'Expired or malformed refresh token'
            });
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const token = req.cookies.refreshToken;

            if (token) {
                try {
                    const payload = verifyRefreshToken(token);
                    await redisClient.del(`refresh_session:${payload.userId}:${token}`);
                } catch (error) {
                    console.warn('Ignored error during logout token verification:', error);
                }
            }

            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict',
            });

            res.status(200).json({
                status: 'success',
                message: 'Logged out successfully'
            });
        } catch (error) {
            console.error('Error in logout controller:', error);
            next(error);
        }
    }
}



