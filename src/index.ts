import { loadConfig, checkCookieExists } from './config';
import { TelegramNotifier } from './bot';
import {
  readCookieFromFile,
  fetchExams,
  detectChanges,
  hasValidResult,
  getRandomizedInterval,
  extractSubjects,
  ParserError,
} from './parser';
import { generateLotteryCode, buildAdminLotteryMessages } from './lottery';
import { loadState, saveState } from './state';
import { openBrowser, LOGIN_URL } from './cookie-grabber';
import { getLogger } from './logger';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

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

class App {
  private config = loadConfig();
  private notifier = new TelegramNotifier(this.config);
  private logger = getLogger();

  private consecutiveErrors = 0;
  private isFirstRun = true;
  private cookieWarningSent = false;
  private networkWarningSent = false;
  private hasInitialResults: Set<string> = new Set();

  async start(): Promise<void> {
    this.logger.info('Бот мониторинга ЕГЭ запущен');

    // При первом запуске проверяем куку
    if (!checkCookieExists(this.config.cookieFile)) {
      this.logger.warn('Cookie-файл не найден');
      openBrowser(LOGIN_URL);
      await this.notifier.sendAdminLog(
        '\u26A0\uFE0F <b>Cookie не найдена</b>\n\n' +
        '1. Открой https://checkege.rustest.ru/exams (браузер открыт)\n' +
        '2. Авторизуйся на сайте\n' +
        '3. Скопируй значение Participant из куки\n' +
        '4. Вставь в файл ' + this.config.cookieFile + '\n\n' +
        'Потом просто подожди — бот подхватит куку автоматически.'
      );
    }

    await this.notifier.sendAdminStartup();

    while (true) {
      try {
        await this.runCheckCycle();
      } catch (err) {
        this.logger.error(`Ошибка в основном цикле: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof Error && err.stack) {
          this.logger.error(err.stack);
        }
      }

      const waitMs = getRandomizedInterval(this.config.checkIntervalBase) * 1000;
      this.logger.debug(`Ожидание ${Math.round(waitMs / 1000)}с до следующей проверки...`);
      await this.sleep(waitMs);
    }
  }

  private async runCheckCycle(): Promise<void> {
    // Читаем куку
    let cookieValue: string;
    try {
      cookieValue = readCookieFromFile(this.config.cookieFile);
    } catch (err) {
      if (err instanceof ParserError && err.code === 'COOKIE_ERROR') {
        this.logger.warn(`Ошибка куки: ${err.message}`);
        if (!this.cookieWarningSent) {
          await this.notifier.sendAdminLog(
            '\u26A0\uFE0F <b>Ошибка куки:</b>\n<code>' + escapeHtmlSimple(err.message) + '</code>'
          );
          this.cookieWarningSent = true;
        }
      }
      return;
    }

    // Запрашиваем данные
    let currentExams;
    try {
      currentExams = await fetchExams(cookieValue);
    } catch (err) {
      if (err instanceof ParserError) {
        await this.handleParserError(err);
      } else {
        this.logger.error(`Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    // Сброс предупреждений
    if (this.cookieWarningSent) {
      this.cookieWarningSent = false;
      await this.notifier.sendAdminRecovery('cookie');
    }
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = 0;
      if (this.networkWarningSent) {
        this.networkWarningSent = false;
        await this.notifier.sendAdminRecovery('network');
      }
    }

    // Загружаем предыдущее состояние
    const saved = loadState(this.config.stateFile);
    const savedExams = saved.exams;
    for (const subject of saved.notifiedSubjects) {
      this.hasInitialResults.add(subject);
    }

    // Первый запуск — сохраняем состояние
    if (this.isFirstRun || savedExams.length === 0) {
      this.logger.info('Первый запуск: сохраняю начальное состояние');

      // Если предметы не указаны — авто-определение из API
      if (this.config.monitorSubjects.length === 0) {
        const available = extractSubjects(currentExams);
        console.log('\n📚 Найдены предметы в твоём личном кабинете:');
        available.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
        console.log('');
        const answer = await ask('Введи номера предметов для отслеживания (через запятую, или Enter = все): ');
        let selected: string[];
        if (answer.trim()) {
          const indices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < available.length);
          selected = indices.map(i => available[i]);
        } else {
          selected = [...available];
        }
        this.config.monitorSubjects.push(...selected);
        this.logger.info(`Авто-определение предметов: ${selected.join(', ')}`);
      }

      for (const exam of currentExams) {
        if (hasValidResult(exam) && this.config.monitorSubjects.includes(exam.Subject)) {
          if (!this.hasInitialResults.has(exam.Subject)) {
            this.hasInitialResults.add(exam.Subject);
            this.logger.info(`Предмет "${exam.Subject}" уже имеет результаты при старте`);
          }
        }
      }
      saveState(this.config.stateFile, currentExams, Array.from(this.hasInitialResults));
      this.isFirstRun = false;
      this.logger.info('Начальное состояние сохранено');
      return;
    }

    // Ищем изменения
    const changes = detectChanges(savedExams, currentExams, this.config.monitorSubjects);
    if (changes.length === 0) {
      this.logger.debug('Изменений нет');
      return;
    }

    this.logger.info(`Найдено ${changes.length} изменений`);

    for (const change of changes) {
      const exam = change.fullNew;

      // Просто уведомление об изменении без цифр
      await this.notifier.sendAdminLog(
        '\uD83D\uDCCB <b>Изменение:</b> ' + change.subject
      );

      if (hasValidResult(exam)) {
        const subject = exam.Subject;

        if (this.hasInitialResults.has(subject)) {
          this.logger.info(`Предмет "${subject}" уже имел результат, пропускаю`);
          continue;
        }

        this.logger.info(`НОВЫЙ РЕЗУЛЬТАТ для "${subject}": ${exam.TestMark} баллов`);

        // Генерируем лотерейный код
        const lotteryCode = generateLotteryCode(exam.TestMark);

        // Отправляем лотерейное сообщение в группы
        await this.notifier.sendResultToAllGroups(exam);

        // Отправляем админу + лотерейный код (каждый символ отдельным сообщением)
        const lotteryMessages = buildAdminLotteryMessages(subject, exam.TestMark, lotteryCode);
        for (const msg of lotteryMessages) {
          await this.notifier.sendAdminLog(msg);
          await this.sleep(300);
        }

        this.hasInitialResults.add(subject);

        // Странные данные
      } else if (exam.HasResult && exam.TestMark === 0 && !exam.IsComposition && !exam.IsBasicMath) {
        await this.notifier.sendAdminLog(
          '\u26A0\uFE0F <b>Странные данные:</b> ' + change.subject +
          '\nHasResult=true, но TestMark=0. Возможно ошибка на сервере.'
        );
      }
    }

    // Сохраняем состояние
    saveState(this.config.stateFile, currentExams);
  }

  private async handleParserError(err: ParserError): Promise<void> {
    this.consecutiveErrors++;

    switch (err.code) {
      case 'AUTH_ERROR':
        this.logger.error(`Ошибка авторизации: ${err.message}`);
        if (!this.cookieWarningSent) {
          await this.notifier.sendAdminCookieExpired(this.config.cookieFile);
          this.cookieWarningSent = true;
        }
        break;

      case 'NETWORK_ERROR':
        this.logger.warn(`Сетевая ошибка (${this.consecutiveErrors}/${this.config.maxConsecutiveErrors}): ${err.message}`);
        if (this.consecutiveErrors >= this.config.maxConsecutiveErrors && !this.networkWarningSent) {
          await this.notifier.sendAdminNetworkError(this.consecutiveErrors);
          this.networkWarningSent = true;
        }
        break;

      case 'PARSE_ERROR':
        this.logger.error(`Ошибка парсинга: ${err.message}`);
        await this.notifier.sendAdminParseError(err.message);
        break;

      case 'COOKIE_ERROR':
        this.logger.warn(`Проблема с кукой: ${err.message}`);
        if (!this.cookieWarningSent) {
          await this.notifier.sendAdminLog(
            '\u26A0\uFE0F <b>Проблема с файлом куки:</b>\n<code>' + escapeHtmlSimple(err.message) + '</code>'
          );
          this.cookieWarningSent = true;
        }
        break;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

function escapeHtmlSimple(text: string): string {
  const am = '&' + 'amp;';
  const lt = '&' + 'lt;';
  const gt = '&' + 'gt;';
  const qt = '&' + 'quot;';
  return text
    .replace(/&/g, am)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, qt);
}

// Запуск
(async () => {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    const { runSetup } = await import('./setup');
    await runSetup();
  }

  const app = new App();
  app.start().catch(err => {
    const logger = getLogger();
    logger.error(`Фатальная ошибка: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      logger.error(err.stack);
    }
    process.exit(1);
  });
})();
