# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем манифесты отдельно для кэширования слоя зависимостей
COPY package*.json ./
RUN npm ci

# Копируем исходники и компилируем TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Устанавливаем только prod-зависимости
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Копируем скомпилированный код из builder
COPY --from=builder /app/dist ./dist

# Создаём директорию для логов и постоянных данных
RUN mkdir -p logs

# Переменные окружения (значения передаются через --env-file или docker compose)
ENV NODE_ENV=production

# cookie.txt и exams_state.json хранятся в volumes снаружи
# COOKIE_FILE и STATE_FILE можно переопределить через .env

CMD ["node", "dist/index.js"]
