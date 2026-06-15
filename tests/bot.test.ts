import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { TelegramNotifier } from '../src/bot';
import { BotConfig } from '../src/types';

vi.mock('axios');
const mockedPost = vi.mocked(axios.post);

const defaultConfig: BotConfig = {
  botToken: 'test:token',
  adminChatId: 12345,
  groupChatIds: [67890, 67891],
  monitorSubjects: ['Русский язык'],
  checkIntervalBase: 120,
  cookieFile: 'cookie.txt',
  stateFile: 'state.json',
  maxConsecutiveErrors: 5,
};

describe('TelegramNotifier', () => {
  let notifier: TelegramNotifier;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedPost.mockResolvedValue({ data: { ok: true } });
    notifier = new TelegramNotifier(defaultConfig);
  });

  describe('sendMessage', () => {
    it('отправляет POST запрос с корректными параметрами', async () => {
      const result = await notifier.sendMessage(12345, 'Тест');

      expect(mockedPost).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest:token/sendMessage',
        expect.objectContaining({
          chat_id: 12345,
          text: 'Тест',
          parse_mode: 'HTML',
        }),
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it('возвращает false при ошибке Telegram API', async () => {
      mockedPost.mockResolvedValue({ data: { ok: false } });

      const result = await notifier.sendMessage(12345, 'Тест');
      expect(result).toBe(false);
    });

    it('возвращает false при сетевой ошибке', async () => {
      mockedPost.mockRejectedValue(new Error('Network error'));

      const result = await notifier.sendMessage(12345, 'Тест');
      expect(result).toBe(false);
    });
  });

  describe('notifyAdmin', () => {
    it('отправляет сообщение в adminChatId', async () => {
      await notifier.notifyAdmin('Привет');
      expect(mockedPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ chat_id: 12345 }),
        expect.any(Object)
      );
    });
  });

  describe('notifyAllGroups', () => {
    it('отправляет сообщение во все группы', async () => {
      const results = await notifier.notifyAllGroups('Всем привет');
      expect(results).toHaveLength(2);
      expect(mockedPost).toHaveBeenCalledTimes(2);

      const calls = mockedPost.mock.calls;
      const chatIds = calls.map(c => (c[1] as any).chat_id);
      expect(chatIds).toContain(67890);
      expect(chatIds).toContain(67891);
    });

    it('возвращает массив результатов', async () => {
      mockedPost
        .mockResolvedValueOnce({ data: { ok: true } })
        .mockRejectedValueOnce(new Error('Fail'));

      const results = await notifier.notifyAllGroups('Тест');
      expect(results).toEqual([true, false]);
    });
  });

  describe('sendResultToAllGroups', () => {
    it('отправляет уведомление без баллов', async () => {
      await notifier.sendResultToAllGroups({ Subject: 'Русский язык', ExamDate: '2026-06-04' });

      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toContain('Результаты по Русский язык');
      expect(sentText).toContain('checkege.rustest.ru');
      expect(sentText).not.toContain('TestMark');
      expect(sentText).not.toContain('tg-spoiler');
    });
  });

  describe('sendAdminStartup', () => {
    it('отправляет сообщение о запуске', async () => {
      await notifier.sendAdminStartup();
      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toContain('Мониторинг');
    });
  });

  describe('sendAdminCookieExpired', () => {
    it('отправляет сообщение об истечении куки', async () => {
      await notifier.sendAdminCookieExpired('cookie.txt');
      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toContain('истекла');
      expect(sentText).toContain('cookie.txt');
    });

    it('не дублирует сообщение', async () => {
      await notifier.sendAdminCookieExpired('cookie.txt');
      await notifier.sendAdminCookieExpired('cookie.txt');
      expect(mockedPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendAdminNetworkError', () => {
    it('отправляет сообщение о сетевой ошибке', async () => {
      await notifier.sendAdminNetworkError(5);
      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toContain('Проблема');
      expect(sentText).toContain('5');
    });
  });

  describe('sendAdminRecovery', () => {
    it('отправляет сообщение о восстановлении куки', async () => {
      await notifier.sendAdminRecovery('cookie');
      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toContain('Кука обновлена');
    });

    it('отправляет сообщение о восстановлении сети', async () => {
      await notifier.sendAdminRecovery('network');
      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toContain('восстановлена');
    });
  });

  describe('sendAdminParseError', () => {
    it('отправляет сообщение об ошибке парсинга', async () => {
      await notifier.sendAdminParseError('Странный JSON');
      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toContain('Неожиданный ответ');
      expect(sentText).toContain('Странный JSON');
    });
  });

  describe('sendAdminLog', () => {
    it('отправляет произвольное сообщение', async () => {
      await notifier.sendAdminLog('Просто лог');
      const sentText = (mockedPost.mock.calls[0][1] as any).text;
      expect(sentText).toBe('Просто лог');
    });
  });
});