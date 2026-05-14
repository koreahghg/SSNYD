FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npm", "start"]
