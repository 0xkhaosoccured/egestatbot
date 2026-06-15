import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { BotConfig } from './types';

export function loadConfig(): BotConfig {
  dotenv.config({ override: true });

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    throw new Error('BOT_TOKEN не указан. Получить: @BotFather в Telegram');
  }

  const adminChatIdStr = process.env.ADMIN_CHAT_ID;
  if (!adminChatIdStr) {
    throw new Error('ADMIN_CHAT_ID не указан');
  }
  const adminChatId = parseInt(adminChatIdStr, 10);
  if (isNaN(adminChatId)) {
    throw new Error('ADMIN_CHAT_ID должен быть числом');
  }

  // Поддержка нескольких групп через запятую
  const groupChatIdsRaw = process.env.GROUP_CHAT_IDS || process.env.GROUP_CHAT_ID || '';
  const groupChatIds = groupChatIdsRaw
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(id => !isNaN(id));

  const monitorSubjectsRaw = process.env.MONITOR_SUBJECTS || '';
  const monitorSubjects = monitorSubjectsRaw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const checkIntervalBase = parseInt(process.env.CHECK_INTERVAL_BASE || '120', 10);
  const maxConsecutiveErrors = parseInt(process.env.MAX_CONSECUTIVE_ERRORS || '5', 10);

  const cookieFile = process.env.COOKIE_FILE || path.join(process.cwd(), 'cookie.txt');
  const stateFile = process.env.STATE_FILE || path.join(process.cwd(), 'exams_state.json');

  return {
    botToken,
    adminChatId,
    groupChatIds,
    monitorSubjects,
    checkIntervalBase: Math.max(30, checkIntervalBase),
    cookieFile,
    stateFile,
    maxConsecutiveErrors: Math.max(1, maxConsecutiveErrors),
  };
}

export function checkCookieExists(cookieFile: string): boolean {
  try {
    if (!fs.existsSync(cookieFile)) return false;
    const content = fs.readFileSync(cookieFile, 'utf-8').trim();
    return content.length > 0;
  } catch {
    return false;
  }
}