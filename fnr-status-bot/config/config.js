require('dotenv').config();

const config = {
  bot: {
    token: process.env.BOT_TOKEN,
  },

  bitrix24: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL,
    timeout: 10000, // таймаут запроса 10 секунд
  },

  manager: {
    contact: process.env.MANAGER_CONTACT || '@fnr_manager',
    phone: process.env.MANAGER_PHONE || '+7XXXXXXXXXX',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Валидация обязательных переменных
if (!config.bot.token) {
  console.error('❌ BOT_TOKEN не задан в .env');
  process.exit(1);
}

if (!config.bitrix24.webhookUrl) {
  console.error('❌ BITRIX_WEBHOOK_URL не задан в .env');
  process.exit(1);
}

module.exports = config;
