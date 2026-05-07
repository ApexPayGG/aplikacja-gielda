FROM node:20-alpine AS deps
WORKDIR /repo/apps/api
COPY packages/data /repo/packages/data
COPY apps/api/package*.json ./
RUN npm ci

FROM node:20-alpine AS runtime
WORKDIR /repo/apps/api
ENV NODE_ENV=production

COPY packages/data /repo/packages/data
COPY --from=deps /repo/apps/api/node_modules ./node_modules
COPY apps/api ./

EXPOSE 3000
CMD ["npm", "run", "start"]
