import { describe, it, expect } from 'vitest';
import {
  detectChanges,
  hasValidResult,
  getRandomizedInterval,
  readCookieFromFile,
  extractSubjects,
} from '../src/parser';
import { ExamResult, ExamChange } from '../src/types';

describe('detectChanges', () => {
  const monitors = ['Русский язык', 'Математика профильная', 'Информатика (КЕГЭ)'];

  const createExam = (overrides: Partial<ExamResult> = {}): ExamResult => ({
    ExamId: 21,
    OralExamId: null,
    ExamDate: '2026-06-04',
    OralExamDate: null,
    Subject: 'Русский язык',
    OralSubject: null,
    TestMark: 0,
    Mark5: 0,
    MinMark: 24,
    Status: 0,
    OralStatus: null,
    HasAppeal: false,
    IsHidden: false,
    HasResult: false,
    HasOralResult: false,
    IsHiddenForRegion: false,
    AppealStatus: null,
    IsComposition: false,
    IsBasicMath: false,
    IsForeignLanguage: false,
    StatusName: '',
    IsKegeAnswers: false,
    IsHideDetail: false,
    ...overrides,
  });

  it('returns empty array when no changes', () => {
    const old = [createExam({ ExamId: 21 })];
    const updated = [createExam({ ExamId: 21 })];
    expect(detectChanges(old, updated, monitors)).toEqual([]);
  });

  it('detects TestMark change', () => {
    const old = [createExam({ ExamId: 21, TestMark: 0 })];
    const updated = [createExam({ ExamId: 21, TestMark: 72 })];
    const changes = detectChanges(old, updated, monitors);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('update');
    expect(changes[0].subject).toBe('Русский язык');
    expect(changes[0].diff).toHaveProperty('TestMark');
    expect(changes[0].diff!['TestMark'].old).toBe(0);
    expect(changes[0].diff!['TestMark'].new).toBe(72);
  });

  it('detects HasResult change', () => {
    const old = [createExam({ ExamId: 21, HasResult: false })];
    const updated = [createExam({ ExamId: 21, HasResult: true })];
    const changes = detectChanges(old, updated, monitors);
    expect(changes).toHaveLength(1);
    expect(changes[0].diff).toHaveProperty('HasResult');
  });

  it('detects multiple field changes', () => {
    const old = [createExam({ ExamId: 21, TestMark: 0, HasResult: false, Status: 0 })];
    const updated = [createExam({ ExamId: 21, TestMark: 68, HasResult: true, Status: 6 })];
    const changes = detectChanges(old, updated, monitors);
    expect(changes).toHaveLength(1);
    expect(Object.keys(changes[0].diff!)).toEqual(['TestMark', 'HasResult', 'Status']);
  });

  it('ignores subjects not in monitor list', () => {
    const old = [createExam({ ExamId: 502, Subject: 'Информатика (КЕГЭ)', TestMark: 0 })];
    const updated = [createExam({ ExamId: 502, Subject: 'Информатика (КЕГЭ)', TestMark: 80 })];
    // Pass only Russian language as monitor
    const changes = detectChanges(old, updated, ['Русский язык']);
    expect(changes).toHaveLength(0);
  });

  it('detects new exam appearing', () => {
    const old: ExamResult[] = [];
    const updated = [createExam({ ExamId: 178, Subject: 'Сочинение' })];
    const changes = detectChanges(old, updated, ['Сочинение']);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('new');
  });
});

describe('hasValidResult', () => {
  const createExam = (overrides: Partial<ExamResult> = {}): ExamResult => ({
    ExamId: 21,
    OralExamId: null,
    ExamDate: '2026-06-04',
    OralExamDate: null,
    Subject: 'Русский язык',
    OralSubject: null,
    TestMark: 0,
    Mark5: 0,
    MinMark: 24,
    Status: 0,
    OralStatus: null,
    HasAppeal: false,
    IsHidden: false,
    HasResult: false,
    HasOralResult: false,
    IsHiddenForRegion: false,
    AppealStatus: null,
    IsComposition: false,
    IsBasicMath: false,
    IsForeignLanguage: false,
    StatusName: '',
    IsKegeAnswers: false,
    IsHideDetail: false,
    ...overrides,
  });

  it('returns true for a valid result', () => {
    const exam = createExam({
      HasResult: true,
      Status: 6,
      TestMark: 72,
    });
    expect(hasValidResult(exam)).toBe(true);
  });

  it('returns false when HasResult is false', () => {
    const exam = createExam({ HasResult: false, Status: 6, TestMark: 72 });
    expect(hasValidResult(exam)).toBe(false);
  });

  it('returns false when Status is not 6', () => {
    const exam = createExam({ HasResult: true, Status: 0, TestMark: 72 });
    expect(hasValidResult(exam)).toBe(false);
  });

  it('returns false when TestMark is 0', () => {
    const exam = createExam({ HasResult: true, Status: 6, TestMark: 0 });
    expect(hasValidResult(exam)).toBe(false);
  });

  it('returns false for composition', () => {
    const exam = createExam({
      HasResult: true,
      Status: 6,
      TestMark: 5,
      IsComposition: true,
    });
    expect(hasValidResult(exam)).toBe(false);
  });

  it('returns false for basic math', () => {
    const exam = createExam({
      HasResult: true,
      Status: 6,
      TestMark: 5,
      IsBasicMath: true,
    });
    expect(hasValidResult(exam)).toBe(false);
  });
});

describe('getRandomizedInterval', () => {
  it('returns a number within ±30% of base', () => {
    const base = 120;
    for (let i = 0; i < 100; i++) {
      const result = getRandomizedInterval(base);
      expect(result).toBeGreaterThanOrEqual(Math.round(base * 0.7));
      expect(result).toBeLessThanOrEqual(Math.round(base * 1.3));
    }
  });

  it('returns an integer', () => {
    const result = getRandomizedInterval(120);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('readCookieFromFile', () => {
  it('кидает ParserError когда файл не существует', () => {
    expect(() => readCookieFromFile('/nonexistent/file.txt')).toThrow('Файл куки не найден');
  });
});

describe('extractSubjects', () => {
  it('извлекает уникальные предметы из списка', () => {
    const exams: ExamResult[] = [
      { Subject: 'Русский язык' } as ExamResult,
      { Subject: 'Математика профильная' } as ExamResult,
      { Subject: 'Русский язык' } as ExamResult,
    ];
    const subjects = extractSubjects(exams);
    expect(subjects).toEqual(['Русский язык', 'Математика профильная']);
  });

  it('возвращает пустой массив для пустого списка', () => {
    expect(extractSubjects([])).toEqual([]);
  });
});
