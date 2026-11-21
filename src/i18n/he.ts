/**
 * All end-user text. Hebrew only. Developer identifiers stay in English in code.
 */
import type {
  CueDelivery,
  CueType,
  DeviceClass,
  EndReason,
  ExerciseId,
  PhysicalSide,
  Readiness,
  ResponseClass,
  StimulusSize,
  StimulusTheme,
  VisionPreviewResponse,
} from '../domain/types';

export const APP_NAME = 'שמאלה';

export const EXERCISE_NAME: Record<ExerciseId, string> = {
  guided_orienting: 'הפניה מודרכת לשמאל',
  visual_scanning: 'סריקה של כמה חפצים',
  target_search: 'חיפוש חפץ אחד',
  saccadic_exploration: 'מעקב אחרי מטרה שעוברת מקום',
  focus_initiation: 'מיקוד ויוזמה',
};

export const EXERCISE_SENTENCE: Record<ExerciseId, string> = {
  guided_orienting: 'חפץ אחד גדול מופיע בצד שמאל. עוזרים לו להבחין בו רק אם צריך.',
  visual_scanning: 'כמה חפצים גדולים מפוזרים על המסך. מעודדים להסתכל על כולם, כולל זה שבשמאל.',
  target_search: 'חפץ אחד שונה מופיע בין מעטים אחרים. רואים אם הוא מבחין בו.',
  saccadic_exploration: 'מטרה גדולה עוברת ממקום למקום רק כשלוחצים. בלי מהירות ובלי הבהובים.',
  focus_initiation: 'מטרה אחת ברורה. רואים אם הוא מסתכל עליה בעצמו, או רק אחרי בקשה.',
};

export const READINESS_LABEL: Record<Readiness, string> = {
  alert: 'ערני ומגיב',
  tired: 'עייף אבל מגיב',
  not_fit: 'לא מתאים עכשיו',
};

export const VISION_LABEL: Record<VisionPreviewResponse, string> = {
  noticed: 'נראה שמבחין',
  unclear: 'לא ברור',
  not_noticed: 'לא נראה שמבחין',
  skipped: 'דילגנו',
};

export const CUE_LABEL: Record<CueType, string> = {
  visual: 'רמז חזותי',
  neutral_tone: 'צליל ניטרלי',
  verbal_left: 'בקשה להביט שמאלה',
  first_name: 'שם פרטי',
  nickname: 'כינוי',
  name_plus_left: 'שם/כינוי עם בקשה להביט שמאלה',
  other: 'רמז אחר',
};

export const CUE_DELIVERY_LABEL: Record<CueDelivery, string> = {
  on_screen: 'על המסך',
  caregiver_spoken: 'המלווה אמר בקול',
  local_tts: 'הקראה במכשיר',
  imported_audio: 'קובץ קול של בן משפחה',
  device_tone: 'צליל מהמכשיר',
  caregiver_other: 'המלווה, בדרך אחרת',
  unknown: 'לא ידוע',
};

export const RESPONSE_CLASS_LABEL: Record<ResponseClass, string> = {
  spontaneous: 'הפניה בלי רמז',
  after_spatial_cue: 'הפניה אחרי רמז כיווני',
  after_nonspatial_cue: 'הפניה אחרי פנייה/צליל בלי כיוון',
  other_direction: 'הסתכל לכיוון אחר',
  no_response_observed: 'לא נצפתה תגובה',
  cannot_determine: 'לא ניתן לקבוע',
};

export const SIDE_WORD: Record<PhysicalSide, string> = { left: 'שמאלה', center: 'למרכז', right: 'ימינה' };
export const SIDE_NAME: Record<PhysicalSide, string> = { left: 'שמאל', center: 'מרכז', right: 'ימין' };

export const THEME_LABEL: Record<StimulusTheme, string> = {
  shapes: 'צורות פשוטות',
  cars: 'מכוניות ותיקות',
  watches: 'שעונים',
  photos: 'תמונות מהמשפחה',
};

export const SIZE_LABEL: Record<StimulusSize, string> = { large: 'גדול', xlarge: 'גדול מאוד', huge: 'ענק' };

export const DEVICE_LABEL: Record<DeviceClass, string> = {
  desktop: 'מחשב',
  'tablet-landscape': 'טאבלט לרוחב',
  'tablet-portrait': 'טאבלט לאורך',
  phone: 'טלפון',
  unknown: 'מכשיר לא ידוע',
};

export const END_REASON_LABEL: Record<EndReason, string> = {
  completed: 'סיימנו כמתוכנן',
  fatigue: 'עייפות',
  discomfort: 'אי־נוחות',
  not_fit: 'לא מתאים היום',
  caregiver_choice: 'החלטת המלווה',
  other: 'סיבה אחרת',
};

export const DISCLAIMER_SHORT =
  'כלי תרגול בליווי משפחה. אינו בדיקה רפואית, אינו מאבחן ואינו מחליף ריפוי בעיסוק או צוות שיקום.';

export const ACUTE_CHANGE_NOTE =
  'אם יש שינוי חדש או בולט בערנות, בדיבור, בתנועה או במצב הכללי — זה לא זמן לתרגול. פנו מיד לצוות הרפואי.';

export function formatDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString();
  }
}

/** "3 מתוך 7" — always show denominators. */
export function ofN(k: number, n: number): string {
  return `${k} מתוך ${n}`;
}
