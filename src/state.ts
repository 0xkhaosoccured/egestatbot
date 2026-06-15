import fs from 'fs';
import path from 'path';
import { ExamResult, PersistedState } from './types';
import { getLogger } from './logger';

export function loadState(stateFile: string): { exams: ExamResult[]; notifiedSubjects: string[] } {
  const logger = getLogger();

  if (!fs.existsSync(stateFile)) {
    logger.info(`Файл состояния ${stateFile} не найден, начинаю с нуля`);
    return { exams: [], notifiedSubjects: [] };
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    const parsed: PersistedState = JSON.parse(raw);

    if (!parsed.exams || !Array.isArray(parsed.exams)) {
      logger.warn(`Файл состояния ${stateFile} повреждён, сбрасываю`);
      return { exams: [], notifiedSubjects: [] };
    }

    const notified = Array.isArray(parsed.notifiedSubjects) ? parsed.notifiedSubjects : [];
    logger.info(`Загружено состояние из ${stateFile}: ${parsed.exams.length} экзаменов, ${notified.length} уведомленных (сохранено ${parsed.updatedAt})`);
    return { exams: parsed.exams, notifiedSubjects: notified };
  } catch (err) {
    logger.error(`Не удалось загрузить состояние из ${stateFile}: ${err instanceof Error ? err.message : String(err)}`);
    return { exams: [], notifiedSubjects: [] };
  }
}

export function saveState(stateFile: string, exams: ExamResult[], notifiedSubjects?: string[]): void {
  const logger = getLogger();

  try {
    const dir = path.dirname(stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const state: PersistedState = {
      exams,
      notifiedSubjects: notifiedSubjects || [],
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
    logger.info(`Сохранено состояние в ${stateFile}: ${exams.length} экзаменов, ${state.notifiedSubjects.length} уведомленных`);
  } catch (err) {
    logger.error(`Не удалось сохранить состояние в ${stateFile}: ${err instanceof Error ? err.message : String(err)}`);
  }
}