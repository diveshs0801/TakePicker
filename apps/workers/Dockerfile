# Build context is the repo root (see docker-compose.yml)
FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/workers/package.json ./apps/workers/package.json
RUN cd apps/workers && npm install
COPY packages ./packages
COPY apps/workers ./apps/workers
RUN cd apps/workers && npx tsc
WORKDIR /app/apps/workers
