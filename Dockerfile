# Multi-stage build: Node.js for Expo Web export, Python for FastAPI + SQLite
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx expo export -p web

FROM python:3.11-slim
WORKDIR /app

# Copy python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy built frontend dist and backend code
COPY --from=frontend-builder /app/dist ./dist
COPY backend ./backend

ENV PORT=8000
EXPOSE 8000

CMD ["python", "backend/main.py"]
