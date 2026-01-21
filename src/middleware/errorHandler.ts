import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error("ERROR ", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong!",
    });
  }
};

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    if (err instanceof AppError) {
      error = err;
    }

    sendErrorProd(error, res);
  }
};
