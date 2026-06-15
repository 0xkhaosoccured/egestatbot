import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

let _logger: winston.Logger | null = null;

export function getLogger(): winston.Logger {
  if (!_logger) {
    _logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'egestatbot' },
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5 * 1024 * 1024, // 5MB
          maxFiles: 3,
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5 * 1024 * 1024,
          maxFiles: 3,
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 1
                ? ` ${JSON.stringify(meta)}`
                : '';
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          ),
        }),
      ],
    });
  }
  return _logger;
}