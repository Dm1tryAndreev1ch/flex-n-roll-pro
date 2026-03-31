# 1. Установить зависимости
npm install

# 2. Скопировать и заполнить .env
cp .env.example .env
nano .env

# 3. Запустить API-сервер
npm start          # production
npm run dev        # с автоперезагрузкой

# 4. Запустить ночную обработку вручную
node scheduler/dailyBatch.js

# 5. Запустить в режиме cron (02:00 каждую ночь)
node scheduler/dailyBatch.js --cron

# 6. Обработать конкретную дату
node scheduler/dailyBatch.js --date 2024-03-15