import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadState, saveState } from '../src/state';
import { ExamResult } from '../src/types';

describe('state persistence', () => {
  const tmpDir = path.join(os.tmpdir(), 'egestatbot-test-' + Date.now());
  const stateFile = path.join(tmpDir, 'state.json');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns empty arrays when file does not exist', () => {
    const state = loadState(path.join(tmpDir, 'nonexistent.json'));
    expect(state.exams).toEqual([]);
    expect(state.notifiedSubjects).toEqual([]);
  });

  it('saves and loads exams correctly', () => {
    const exams: ExamResult[] = [
      {
        ExamId: 21, OralExamId: null, ExamDate: '2026-06-04', OralExamDate: null,
        Subject: 'Русский язык', OralSubject: null, TestMark: 0, Mark5: 0,
        MinMark: 24, Status: 0, OralStatus: null, HasAppeal: false,
        IsHidden: false, HasResult: false, HasOralResult: false,
        IsHiddenForRegion: false, AppealStatus: null, IsComposition: false,
        IsBasicMath: false, IsForeignLanguage: false, StatusName: '',
        IsKegeAnswers: false, IsHideDetail: false,
      },
    ];

    saveState(stateFile, exams, ['Русский язык']);
    const loaded = loadState(stateFile);
    expect(loaded.exams).toHaveLength(1);
    expect(loaded.exams[0].Subject).toBe('Русский язык');
    expect(loaded.exams[0].ExamId).toBe(21);
    expect(loaded.notifiedSubjects).toEqual(['Русский язык']);
  });

  it('returns empty arrays for invalid state file', () => {
    fs.writeFileSync(stateFile, '{{invalid json}}', 'utf-8');
    const loaded = loadState(stateFile);
    expect(loaded.exams).toEqual([]);
    expect(loaded.notifiedSubjects).toEqual([]);
  });

  it('returns empty arrays when exams field is missing', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ updatedAt: '2026-06-14T00:00:00Z' }), 'utf-8');
    const loaded = loadState(stateFile);
    expect(loaded.exams).toEqual([]);
    expect(loaded.notifiedSubjects).toEqual([]);
  });

  it('saves and loads notifiedSubjects', () => {
    saveState(stateFile, [], ['Русский язык', 'Математика профильная']);
    const loaded = loadState(stateFile);
    expect(loaded.notifiedSubjects).toEqual(['Русский язык', 'Математика профильная']);
  });
});