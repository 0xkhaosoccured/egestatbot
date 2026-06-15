/**
 * Тестовый скрипт для проверки всех сообщений бота.
 * Запуск: npx tsx tests/send-test-messages.ts
 * 
 * Отправляет в ЛС админу все типы сообщений, включая те, что с баллами в спойлере.
 */
import { loadConfig } from '../src/config';
import { TelegramNotifier } from '../src/bot';
import { ExamResult } from '../src/types';

async function main() {
  const config = loadConfig();
  const notifier = new TelegramNotifier(config);

  console.log('Отправка тестовых сообщений в ЛС админа...');
  console.log(`Admin chat ID: ${config.adminChatId}`);
  console.log('\n1. Отправка: Мониторинг запущен');
  await notifier.sendAdminStartup();
  await sleep(2000);
  console.log('\n2. Отправка: Изменение с баллами в спойлере');
  await notifier.sendAdminLog(
    '\uD83D\uDCCB <b>Изменение:</b> Русский язык\n<b>HasResult:</b> true\n<b>TestMark:</b> <tg-spoiler>87</tg-spoiler>\n<b>Status:</b> <tg-spoiler>3</tg-spoiler>'
  );
  await sleep(2000);
  console.log('\n3. Отправка: Изменение без результата');
  await notifier.sendAdminLog(
    '\uD83D\uDCCB <b>Изменение:</b> Математика профильная\n<b>HasResult:</b> false\n<b>TestMark:</b> <tg-spoiler>0</tg-spoiler>\n<b>Status:</b> <tg-spoiler>0</tg-spoiler>'
  );
  await sleep(2000);
  console.log('\n4. Отправка: Новый результат (баллы в спойлере)');
  await notifier.sendAdminLog(
    '\u2705 <b>Новый результат:</b> Русский язык - <tg-spoiler>87 баллов</tg-spoiler>'
  );
  await sleep(2000);
  console.log('\n5. Отправка: Странные данные (HasResult=true, TestMark=0)');
  await notifier.sendAdminLog(
    '\u26A0\uFE0F <b>Странные данные:</b> Математика профильная\nHasResult=true, но TestMark=0. Возможно ошибка на сервере.'
  );
  await sleep(2000);
  console.log('\n6. Отправка: Сессия истекла');
  await notifier.sendAdminCookieExpired('cookie.txt');
  await sleep(2000);
  console.log('\n7. Отправка: Проблема со связью');
  await notifier.sendAdminNetworkError(5);
  await sleep(2000);
  console.log('\n8. Отправка: Кука обновлена');
  await notifier.sendAdminRecovery('cookie');
  await sleep(2000);
  console.log('\n9. Отправка: Связь восстановлена');
  await notifier.sendAdminRecovery('network');
  await sleep(2000);
  console.log('\n10. Отправка: Ошибка парсинга');
  await notifier.sendAdminParseError('Неожиданный формат ответа сервера: поле "Result" отсутствует');
  await sleep(2000);
  console.log('\n11. Отправка: Ошибка куки');
  await notifier.sendAdminLog(
    '\u26A0\uFE0F <b>Ошибка куки:</b>\n<code>Файл cookie.txt не найден</code>'
  );
  await sleep(2000);

  console.log('\n12. Отправка: Проблема с файлом куки');
  await notifier.sendAdminLog(
    '\u26A0\uFE0F <b>Проблема с файлом куки:</b>\n<code>Не удалось прочитать файл cookie.txt</code>'
  );

  console.log('\n✅ Все тестовые сообщения отправлены! Проверьте ЛС бота.');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});