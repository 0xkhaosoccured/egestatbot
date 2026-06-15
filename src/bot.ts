import axios from 'axios';
import { BotConfig } from './types';
import { getLogger } from './logger';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export class TelegramNotifier {
  private config: BotConfig;
  private lastAdminAlertCookie: string | null = null;
  private lastAdminAlertNetwork: string | null = null;

  constructor(config: BotConfig) {
    this.config = config;
  }

  async sendMessage(chatId: number, text: string): Promise<boolean> {
    const logger = getLogger();

    try {
      const url = `${TELEGRAM_API_BASE}/bot${this.config.botToken}/sendMessage`;
      const response = await axios.post(
        url,
        {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
        { timeout: 10000 }
      );

      if (response.data?.ok !== true) {
        logger.error(`Telegram API error: ${JSON.stringify(response.data)}`);
        return false;
      }

      return true;
    } catch (err) {
      logger.error(
        `Не удалось отправить сообщение в чат ${chatId}: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }

  async notifyAdmin(message: string): Promise<boolean> {
    return this.sendMessage(this.config.adminChatId, message);
  }

  async notifyAllGroups(message: string): Promise<boolean[]> {
    const results = await Promise.allSettled(
      this.config.groupChatIds.map(id => this.sendMessage(id, message))
    );
    return results.map(r => r.status === 'fulfilled' ? r.value : false);
  }

  async sendAdminStartup(): Promise<void> {
    await this.notifyAdmin('\u2705 <b>Мониторинг ЕГЭ запущен.</b>\nБот начал проверку результатов.');
  }

  async sendAdminCookieExpired(cookieFile: string): Promise<void> {
    const alertKey = `cookie_${Date.now()}`;
    if (this.lastAdminAlertCookie === alertKey) return;
    this.lastAdminAlertCookie = alertKey;

    await this.notifyAdmin(
      '\u26A0\uFE0F <b>Сессия авторизации истекла!</b>\n\n' +
      `Обнови куку в файле <code>${cookieFile}</code>:\n` +
      '1. Открой https://checkege.rustest.ru/exams\n' +
      '2. Войди заново\n' +
      '3. Скопируй значение Participant из куки\n' +
      '4. Вставь в файл cookie.txt\n\n' +
      'Бот сам подхватит новую куку.'
    );
  }

  async sendAdminNetworkError(consecutiveErrors: number): Promise<void> {
    const alertKey = `network_${Math.floor(Date.now() / 300000)}`;
    if (this.lastAdminAlertNetwork === alertKey) return;
    this.lastAdminAlertNetwork = alertKey;

    await this.notifyAdmin(
      '\u26A0\uFE0F <b>Проблема со связью!</b>\n\n' +
      `Сервер молчит ${consecutiveErrors} раз(а) подряд.\n` +
      'Сайт может быть временно недоступен.\n' +
      'Бот продолжает попытки.'
    );
  }

  async sendAdminRecovery(recoveryType: 'cookie' | 'network'): Promise<void> {
    if (recoveryType === 'cookie') {
      this.lastAdminAlertCookie = null;
      await this.notifyAdmin(
        '\u2705 <b>Кука обновлена.</b> Продолжаю мониторинг.\n' +
        'Если ещё не выбрал предметы — они определятся автоматически при следующем запросе.'
      );
    } else {
      this.lastAdminAlertNetwork = null;
      await this.notifyAdmin('\u2705 <b>Связь с сервером восстановлена.</b> Продолжаю проверку.');
    }
  }

  async sendAdminLog(message: string): Promise<void> {
    await this.notifyAdmin(message);
  }

  async sendAdminParseError(details: string): Promise<void> {
    await this.notifyAdmin(
      '\u26A0\uFE0F <b>Неожиданный ответ сервера</b>\n\n<code>' + escapeHtml(details) + '</code>'
    );
  }

  async sendResultToAllGroups(exam: { Subject: string; ExamDate: string }): Promise<void> {
    const subject = exam.Subject;
    const message = '\uD83C\uDF89 <b>Результаты по ' + subject + '!!!</b>\n\n' +
      'Заходи проверить: https://checkege.rustest.ru/exams';

    const results = await this.notifyAllGroups(message);
    const successCount = results.filter(Boolean).length;
    this.logger.info(`Разослано уведомление о "${subject}" в ${successCount}/${results.length} групп`);
  }

  private get logger() {
    return getLogger();
  }
}

function escapeHtml(text: string): string {
  const am = '&' + 'amp;';
  const lt = '&' + 'lt;';
  const gt = '&' + 'gt;';
  return text
    .replace(/&/g, am)
    .replace(/</g, lt)
    .replace(/>/g, gt);
}