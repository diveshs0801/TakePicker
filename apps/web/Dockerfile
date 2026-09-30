FROM node:20-slim
WORKDIR /app
COPY apps/web/package.json ./apps/web/package.json
RUN cd apps/web && npm install
COPY packages ./packages
COPY apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 3001
CMD ["npm", "run", "dev"]
