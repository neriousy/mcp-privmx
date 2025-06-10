import winston from 'winston';
import { config } from './config.js';

const { combine, timestamp, printf, colorize, align } = winston.format;

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(
    colorize({ all: true }),
    timestamp({
      format: 'YYYY-MM-DD hh:mm:ss.SSS A',
    }),
    align(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
