import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ENV_PATH = path.join(process.cwd(), '.env');

function ask(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function formatEnv(raw: Record<string, string>): string {
  return Object.entries(raw)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n') + '\n';
}

function validateToken(token: string): boolean {
  // Токен выглядит как 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
  return /^\d+:[\w-]+$/.test(token);
}

function validateChatId(id: string): boolean {
  return /^-?\d{5,}$/.test(id.trim());
}

export async function runSetup(): Promise<void> {
  console.log('');
  console.log('========================================');
  console.log('  Настройка бота мониторинга ЕГЭ');
  console.log('========================================');
  console.log('');
  console.log('Шаг 1: Токен Telegram бота');
  console.log('  - Открой @BotFather в Telegram');
  console.log('  - Создай нового бота командой /newbot');
  console.log('  - Скопируй токен (выглядит как 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)');
  console.log('');
  let botToken = '';
  while (!botToken) {
    botToken = await ask('  Токен: ');
    if (!botToken) {
      console.log('  ❌ Токен обязателен.');
    } else if (!validateToken(botToken)) {
      console.log('  ❌ Токен выглядит неверно. Должен быть формата: число:буквы_и_цифры');
      console.log('    Пример: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
      botToken = '';
    }
  }

  console.log('');
  console.log('Шаг 2: Твой Telegram ID');
  console.log('  - Напиши @userinfobot в Telegram');
  console.log('  - Отправь ему /start — он покажет твой ID');
  console.log('');
  let adminChatId = 0;
  while (!adminChatId) {
    const adminIdRaw = await ask('  Твой ID (число): ');
    if (!adminIdRaw) {
      console.log('  ❌ ID обязателен.');
      continue;
    }
    if (!validateChatId(adminIdRaw)) {
      console.log('  ❌ ID должен быть числом (минимум 5 цифр).');
      continue;
    }
    adminChatId = parseInt(adminIdRaw, 10);
    if (isNaN(adminChatId)) {
      console.log('  ❌ ID должен быть числом.');
    }
  }

  console.log('');
  console.log('Шаг 3: ID групп для оповещений (необязательно)');
  console.log('  - Добавь бота в группу');
  console.log('  - Напиши /id в группе — бот ответит ID');
  console.log('  - Можно указать несколько через запятую');
  console.log('');
  let groupChatIds = '';
  while (true) {
    const groupsRaw = await ask('  ID групп (через запятую, или Enter чтобы пропустить): ');
    if (!groupsRaw) break;
    const ids = groupsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const valid = ids.every(id => validateChatId(id));
    if (!valid) {
      console.log('  ❌ Один из ID неверный. Каждый ID должен быть числом.');
      continue;
    }
    groupChatIds = ids.join(',');
    break;
  }

  console.log('');
  console.log('Шаг 4: Предметы для отслеживания');
  console.log('  Например: Русский язык,Математика профильная,Информатика (КЕГЭ)');
  console.log('  Если ввести неправильно — бот сам определит предметы из личного кабинета');
  console.log('');
  const subjects = await ask('  Предметы (через запятую, или Enter = авто-определение): ') || '';

  console.log('');
  console.log('Шаг 5: Интервал проверки в секундах');
  console.log('  По умолчанию 120 сек (2 минуты). Минимум 30 сек.');
  console.log('');
  let checkIntervalBase = 120;
  while (true) {
    const intervalRaw = await ask('  Интервал (Enter = 120): ');
    if (!intervalRaw) break;
    const interval = parseInt(intervalRaw, 10);
    if (isNaN(interval) || interval < 30) {
      console.log('  ❌ Минимум 30 секунд.');
      continue;
    }
    checkIntervalBase = interval;
    break;
  }

  const envData: Record<string, string> = {
    BOT_TOKEN: botToken,
    ADMIN_CHAT_ID: String(adminChatId),
    CHECK_INTERVAL_BASE: String(checkIntervalBase),
  };
  if (groupChatIds) {
    envData.GROUP_CHAT_IDS = groupChatIds;
  }
  if (subjects) {
    envData.MONITOR_SUBJECTS = subjects;
  }

  const envContent = formatEnv(envData);
  fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
  console.log('');
  console.log('✅ Файл .env создан! Запускаю бота...');
  console.log('');
}