import { describe, it, expect } from 'vitest';
import { generateLotteryCode, buildLotteryMessage, buildAdminLotteryMessages } from '../src/lottery';

describe('generateLotteryCode', () => {
  it('возвращает строку из 10 символов', () => {
    const code = generateLotteryCode(87);
    expect(code).toHaveLength(10);
  });

  it('содержит все цифры результата', () => {
    const code = generateLotteryCode(87);
    expect(code).toContain('8');
    expect(code).toContain('7');
  });

  it('содержит только буквы (A-Z без I,O) + цифры', () => {
    const code = generateLotteryCode(100);
    for (const ch of code) {
      const isValid = /^[A-HJ-NP-Z0-9]$/.test(ch);
      expect(isValid).toBe(true);
    }
  });

  it('работает с 3-значным результатом', () => {
    const code = generateLotteryCode(100);
    expect(code).toContain('1');
    expect(code).toContain('0');
    expect(code).toContain('0');
  });

  it('генерирует разные коды при повторных вызовах', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      codes.add(generateLotteryCode(87));
    }
    // Хотя бы 2 разных за 10 попыток (95%+ вероятность)
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('buildLotteryMessage', () => {
  it('содержит название предмета', () => {
    const message = buildLotteryMessage('Русский язык', 'AB8C7DEFGH');
    expect(message).toContain('Русский язык');
  });

  it('содержит теги <tg-spoiler> для каждого символа', () => {
    const message = buildLotteryMessage('Русский язык', 'AB8C7DEFGH');
    const spoilerCount = (message.match(/<tg-spoiler>/g) || []).length;
    expect(spoilerCount).toBe(10);
  });

  it('содержит приглашение нажать на символы', () => {
    const message = buildLotteryMessage('Русский язык', 'AB8C7DEFGH');
    expect(message).toContain('Нажимай');
  });
});

describe('buildAdminLotteryMessages', () => {
  it('возвращает массив из 11 сообщений (1 название + 10 символов)', () => {
    const messages = buildAdminLotteryMessages('Русский язык', 87, 'AB8C7DEFGH');
    expect(messages).toHaveLength(11);
  });

  it('первое сообщение — название предмета', () => {
    const messages = buildAdminLotteryMessages('Русский язык', 87, 'AB8C7DEFGH');
    expect(messages[0]).toBe('\u2705 <b>Новый результат:</b> Русский язык');
  });

  it('каждый символ кода — отдельное сообщение с одним спойлером', () => {
    const messages = buildAdminLotteryMessages('Русский язык', 87, 'AB8C7DEFGH');
    for (let i = 1; i < messages.length; i++) {
      expect(messages[i]).toMatch(/^<tg-spoiler>.[\s\S]*<\/tg-spoiler>$/);
      const spoilerCount = (messages[i].match(/<tg-spoiler>/g) || []).length;
      expect(spoilerCount).toBe(1);
    }
  });
});
