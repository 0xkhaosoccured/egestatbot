const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // без I и O чтобы не путать с 1 и 0
const CODE_LENGTH = 10;

export function generateLotteryCode(mark: number): string {
  const markStr = String(mark);
  const positions: number[] = [];
  while (positions.length < markStr.length) {
    const pos = Math.floor(Math.random() * CODE_LENGTH);
    if (!positions.includes(pos)) {
      positions.push(pos);
    }
  }

  const code: string[] = new Array(CODE_LENGTH).fill('');
  let digitIdx = 0;

  for (let i = 0; i < CODE_LENGTH; i++) {
    if (positions.includes(i)) {
      code[i] = markStr[digitIdx];
      digitIdx++;
    } else {
      code[i] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
  }

  return code.join('');
}

export function buildLotteryMessage(subject: string, code: string): string {
  const spoilerChars = code
    .split('')
    .map(ch => `<tg-spoiler>${ch}</tg-spoiler>`)
    .join('');

  return (
    '\uD83C\uDFB2 <b>У тебя новый результат!</b>\n\n' +
    `\uD83D\uDCDA <b>${subject}</b>\n\n` +
    spoilerChars + '\n\n' +
    'Нажимай на символы по одному, чтобы открыть свой результат\uD83D\uDE0A'
  );
}

export function buildAdminLotteryMessages(subject: string, mark: number, code: string): string[] {
  const messages: string[] = [];

  messages.push('\u2705 <b>Новый результат:</b> ' + subject);
  for (const ch of code) {
    messages.push(`<tg-spoiler>${ch}</tg-spoiler>`);
  }

  return messages;
}
