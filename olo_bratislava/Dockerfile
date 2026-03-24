FROM node:25-alpine

ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache tzdata

COPY package.json ./package.json
COPY src ./src

CMD ["node", "--experimental-strip-types", "/app/src/index.ts"]
