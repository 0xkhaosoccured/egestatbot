import fs from 'fs';
import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { ExamResult, ExamChange, ExamApiResponse } from './types';

const BASE_URL = 'https://checkege.rustest.ru';
const DEFAULT_HEADERS = {
  'Accept': '*/*',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Connection': 'keep-alive',
  'Referer': 'https://checkege.rustest.ru/exams',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
  'X-Requested-With': 'XMLHttpRequest',
};

export class ParserError extends Error {
  public readonly code: 'AUTH_ERROR' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'COOKIE_ERROR';

  constructor(message: string, code: 'AUTH_ERROR' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'COOKIE_ERROR') {
    super(message);
    this.name = 'ParserError';
    this.code = code;
  }
}

export function readCookieFromFile(cookieFile: string): string {
  if (!fs.existsSync(cookieFile)) {
    throw new ParserError(
      `Файл куки не найден: ${cookieFile}. Создай его и вставь значение Participant.`,
      'COOKIE_ERROR'
    );
  }

  try {
    const raw = fs.readFileSync(cookieFile, 'utf-8').trim();

    if (!raw) {
      throw new ParserError(
        `Файл куки ${cookieFile} пустой. Вставь значение Participant.`,
        'COOKIE_ERROR'
      );
    }

    let cookieValue = raw;
    if (cookieValue.startsWith('Participant=')) {
      cookieValue = cookieValue.slice('Participant='.length);
    }

    cookieValue = cookieValue.replace(/^["']|["']$/g, '').trim();

    if (!cookieValue) {
      throw new ParserError(
        `Файл куки ${cookieFile} содержит пустое значение после обработки.`,
        'COOKIE_ERROR'
      );
    }

    return cookieValue;
  } catch (err) {
    if (err instanceof ParserError) throw err;
    throw new ParserError(
      `Не удалось прочитать куку: ${err instanceof Error ? err.message : String(err)}`,
      'COOKIE_ERROR'
    );
  }
}

function createApiClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      ...DEFAULT_HEADERS,
      'Host': 'checkege.rustest.ru',
    },
    withCredentials: true,
    timeout: 15000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });
}

export async function fetchExams(cookieValue: string): Promise<ExamResult[]> {
  if (!cookieValue) {
    throw new ParserError('Значение куки пустое', 'COOKIE_ERROR');
  }

  const client = createApiClient();

  try {
    const response = await client.get<ExamApiResponse>('/api/exam', {
      headers: {
        'Cookie': `Participant=${cookieValue}`,
      },
    });

    const data = response.data;

    if (!data || !data.Result || !Array.isArray(data.Result.Exams)) {
      throw new ParserError(
        'Неожиданный формат ответа API: отсутствует Result.Exams',
        'PARSE_ERROR'
      );
    }

    return data.Result.Exams;
  } catch (err) {
    if (err instanceof ParserError) throw err;

    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;

      if (axiosErr.response?.status === 401 || axiosErr.response?.status === 403) {
        throw new ParserError(
          'Авторизация не пройдена: кука недействительна или истекла',
          'AUTH_ERROR'
        );
      }

      if (axiosErr.code === 'ECONNABORTED') {
        throw new ParserError('Таймаут запроса: сервер не ответил вовремя', 'NETWORK_ERROR');
      }

      throw new ParserError(
        `HTTP запрос не удался: ${axiosErr.message}`,
        'NETWORK_ERROR'
      );
    }

    if (err instanceof SyntaxError) {
      throw new ParserError(
        'Невалидный JSON в ответе сервера',
        'PARSE_ERROR'
      );
    }

    throw new ParserError(
      `Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`,
      'NETWORK_ERROR'
    );
  }
}

export function extractSubjects(exams: ExamResult[]): string[] {
  const subjects = new Set<string>();
  for (const exam of exams) {
    if (exam.Subject) {
      subjects.add(exam.Subject);
    }
  }
  return Array.from(subjects);
}

export function detectChanges(
  oldExams: ExamResult[],
  newExams: ExamResult[],
  monitorSubjects: string[]
): ExamChange[] {
  const changes: ExamChange[] = [];

  for (const newExam of newExams) {
    if (!monitorSubjects.includes(newExam.Subject)) {
      continue;
    }

    const oldExam = oldExams.find(e => e.ExamId === newExam.ExamId);

    if (!oldExam) {
      changes.push({
        type: 'new',
        subject: newExam.Subject,
        examId: newExam.ExamId,
        fullNew: { ...newExam },
      });
      continue;
    }

    const diff: Record<string, { old: unknown; new: unknown }> = {};
    const criticalFields: (keyof ExamResult)[] = [
      'TestMark', 'Mark5', 'HasResult', 'StatusName', 'Status'
    ];

    for (const field of criticalFields) {
      const oldVal = oldExam[field];
      const newVal = newExam[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[field] = { old: oldVal, new: newVal };
      }
    }

    if (Object.keys(diff).length > 0) {
      changes.push({
        type: 'update',
        subject: newExam.Subject,
        examId: newExam.ExamId,
        diff,
        fullNew: { ...newExam },
      });
    }
  }

  return changes;
}

export function hasValidResult(exam: ExamResult): boolean {
  return (
    exam.HasResult === true &&
    exam.Status === 6 &&
    exam.TestMark > 0 &&
    !exam.IsComposition &&
    !exam.IsBasicMath
  );
}

export function shouldNotifyGroup(exam: ExamResult): boolean {
  return (
    exam.HasResult === true &&
    exam.TestMark > 0 &&
    !exam.IsComposition &&
    !exam.IsBasicMath
  );
}

export function getRandomizedInterval(baseSeconds: number): number {
  const jitter = 0.3;
  const min = Math.round(baseSeconds * (1 - jitter));
  const max = Math.round(baseSeconds * (1 + jitter));
  return Math.floor(Math.random() * (max - min + 1)) + min;
}