import { getLogger } from './logger';
import { exec } from 'child_process';

export function openBrowser(url: string): void {
  const logger = getLogger();
  const platform = process.platform;

  let cmd: string;
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, err => {
    if (err) {
      logger.warn(`Не удалось открыть браузер: ${err.message}`);
      logger.info(`Открой вручную: ${url}`);
    }
  });
}

export const LOGIN_URL = 'https://checkege.rustest.ru/exams';