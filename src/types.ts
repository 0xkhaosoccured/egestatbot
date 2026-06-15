export interface ExamInfo {
  HotlinePhone: string;
  Info: string;
}

export interface ExamResult {
  ExamId: number;
  OralExamId: number | null;
  ExamDate: string;
  OralExamDate: string | null;
  Subject: string;
  OralSubject: string | null;
  TestMark: number;
  Mark5: number;
  MinMark: number;
  Status: number;
  OralStatus: number | null;
  HasAppeal: boolean;
  IsHidden: boolean;
  HasResult: boolean;
  HasOralResult: boolean;
  IsHiddenForRegion: boolean;
  AppealStatus: string | null;
  IsComposition: boolean;
  IsBasicMath: boolean;
  IsForeignLanguage: boolean;
  StatusName: string;
  IsKegeAnswers: boolean;
  IsHideDetail: boolean;
}

export interface ExamApiResponse {
  Info: ExamInfo;
  Result: {
    Exams: ExamResult[];
  };
}

export interface ExamChange {
  type: 'update' | 'new';
  subject: string;
  examId: number;
  diff?: Record<string, { old: unknown; new: unknown }>;
  fullNew: ExamResult;
}

export interface BotConfig {
  botToken: string;
  adminChatId: number;
  groupChatIds: number[];
  monitorSubjects: string[];
  checkIntervalBase: number;
  cookieFile: string;
  stateFile: string;
  maxConsecutiveErrors: number;
}

export interface PersistedState {
  exams: ExamResult[];
  updatedAt: string;
  notifiedSubjects: string[];
}
