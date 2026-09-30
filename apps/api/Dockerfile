FROM node:20-slim
WORKDIR /app
COPY apps/api/package.json ./apps/api/package.json
RUN cd apps/api && npm install
COPY packages ./packages
COPY apps/api ./apps/api
RUN cd apps/api && npx tsc
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "node dist/apps/api/src/main.js 2>/dev/null || node dist/src/main.js"]
