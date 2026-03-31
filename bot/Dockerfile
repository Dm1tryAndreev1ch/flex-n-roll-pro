FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package files первыми — для кэширования Docker слоёв
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --omit=dev

# Копируем исходный код
COPY src/ ./src/

# Создаём директорию для логов
RUN mkdir -p logs

# Запускаем от непривилегированного пользователя
USER node

EXPOSE 3000

CMD ["node", "src/bot.js"]