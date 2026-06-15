import { loadConfig } from '../src/config';
import { TelegramNotifier } from '../src/bot';
import { readCookieFromFile, fetchExams, extractSubjects } from '../src/parser';
import { generateLotteryCode, buildAdminLotteryMessages } from '../src/lottery';
import { getLogger } from '../src/logger';

const logger = getLogger();

async function main() {

  const config = loadConfig();
  const notifier = new TelegramNotifier(config);

  console.log(`👤 Admin chat ID: ${config.adminChatId}`);
  console.log(`👥 Groups (НЕ БУДЕМ ТРОГАТЬ): ${config.groupChatIds.join(', ') || 'нет'}`);
  console.log(`📋 Предметы: ${config.monitorSubjects.join(', ') || 'авто-определение'}`);
  console.log('');

  console.log('📁 Шаг 1: Чтение куки...');
  let cookieValue: string;
  try {
    cookieValue = readCookieFromFile(config.cookieFile);
    console.log(`   ✅ Кука прочитана: ${cookieValue.substring(0, 20)}...${cookieValue.substring(cookieValue.length - 10)}`);
  } catch (err) {
    console.error('   ❌ Ошибка чтения куки:', err);
    process.exit(1);
  }

  console.log('\n🌐 Шаг 2: Запрос к checkege.rustest.ru...');
  let exams;
  try {
    exams = await fetchExams(cookieValue);
    console.log(`   ✅ Успешно! Получено ${exams.length} экзаменов`);
  } catch (err) {
    console.error('   ❌ Ошибка запроса:', err);
    process.exit(1);
  }

  console.log('\n📊 Шаг 3: Структура ответа:');
  for (const exam of exams) {
    console.log(`   - ${exam.Subject} (ID: ${exam.ExamId})`);
    console.log(`     Дата: ${exam.ExamDate}`);
    console.log(`     HasResult: ${exam.HasResult}, TestMark: ${exam.TestMark}, Status: ${exam.Status}`);
    console.log(`     IsComposition: ${exam.IsComposition}, IsBasicMath: ${exam.IsBasicMath}`);
    console.log('');
  }
  const subjects = extractSubjects(exams);
  console.log(`📚 Доступные предметы: ${subjects.join(', ')}`);

  console.log('\n📨 Шаг 4: Отправка тестовых сообщений в ЛС...');
  console.log('   (Группы НЕ ТРОГАЕМ)');
  console.log('');

  console.log('   [1/8] Отправка: Мониторинг запущен...');
  await notifier.sendAdminStartup();
  await sleep(1500);

  console.log('   [2/8] Отправка: Изменение (только предмет)...');
  await notifier.sendAdminLog(
    '\uD83D\uDCCB <b>Изменение:</b> Русский язык'
  );
  await sleep(1500);

  console.log('   [3/8] Отправка: Лотерейный код для 87 баллов (11 сообщений)...');
  const lotteryCode = generateLotteryCode(87);
  console.log(`       Сгенерирован код: ${lotteryCode.split('').join(' ')}`);
  const msgs87 = buildAdminLotteryMessages('Русский язык', 87, lotteryCode);
  for (const msg of msgs87) {
    await notifier.sendAdminLog(msg);
    await sleep(300);
  }
  await sleep(1500);
  console.log('   [4/8] Отправка: Лотерейный код для 100 баллов (11 сообщений)...');
  const lotteryCode2 = generateLotteryCode(100);
  console.log(`       Сгенерирован код: ${lotteryCode2.split('').join(' ')}`);
  const msgs100 = buildAdminLotteryMessages('Математика профильная', 100, lotteryCode2);
  for (const msg of msgs100) {
    await notifier.sendAdminLog(msg);
    await sleep(300);
  }
  await sleep(1500);

  console.log('   [5/8] Отправка: Странные данные (HasResult=true, TestMark=0)...');
  await notifier.sendAdminLog(
    '\u26A0\uFE0F <b>Странные данные:</b> Математика профильная\nHasResult=true, но TestMark=0. Возможно ошибка на сервере.'
  );
  await sleep(1500);

  console.log('   [6/8] Отправка: Сессия истекла...');
  await notifier.sendAdminCookieExpired('cookie.txt');
  await sleep(1500);
  console.log('   [7/8] Отправка: Проблема со связью...');
  await notifier.sendAdminNetworkError(5);
  await sleep(1500);

  console.log('   [8/8] Отправка: Восстановление...');
  await notifier.sendAdminRecovery('cookie');
  await sleep(1000);
  await notifier.sendAdminRecovery('network');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});