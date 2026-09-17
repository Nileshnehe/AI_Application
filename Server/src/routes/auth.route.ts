import { Router } from "express";
import { AuthController, registerSchema, verifyEmailSchema } from "../controllers/auth.controller";
// import { authLimiter } from "../middlewares/rateLimiter";
import { validateRequest } from "../middlewares/validate.middleware";

const authRouter = Router();
// i will remove the authLimiter for testing purpose
authRouter.post('/register', validateRequest(registerSchema), AuthController.register);
authRouter.post('/verify-email', validateRequest(verifyEmailSchema), AuthController.verifyEmail);


export default authRouter;