import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";


export const validateRequest = (schema: ZodType<any, any, any>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    status: 'error',
                    errors: error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
                });
                return;
            }
            console.error('Error in validate middleware', error);
            res.status(400).json({ status: 'error', message: 'Invalid payload' });
        }
    }
}