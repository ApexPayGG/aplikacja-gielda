FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy Prisma schema (wymagane do runtime)
COPY apps/api/prisma ./prisma

COPY --from=deps /app/node_modules ./node_modules
COPY apps/api ./

EXPOSE 3000
CMD ["npm", "run", "start"]
