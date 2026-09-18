import { Router } from "express";
import { AuthController, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from "../controllers/auth.controller";
// import { authLimiter } from "../middlewares/rateLimiter";
import { validateRequest } from "../middlewares/validate.middleware";

const authRouter = Router();
// i will remove the authLimiter for testing purpose
authRouter.post('/register', validateRequest(registerSchema), AuthController.register);
authRouter.get('/verify-email', validateRequest(verifyEmailSchema), AuthController.verifyEmail);
authRouter.post('/login', validateRequest(loginSchema), AuthController.login);
authRouter.post('/forgot-password', validateRequest(forgotPasswordSchema), AuthController.forgotPassword);
authRouter.post('/reset-password', validateRequest(resetPasswordSchema), AuthController.resetPassword);

export default authRouter;