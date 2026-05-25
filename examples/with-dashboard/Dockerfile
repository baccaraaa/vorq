FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install --omit=dev
CMD ["node", "--experimental-strip-types", "server.ts"]
EXPOSE 3001
