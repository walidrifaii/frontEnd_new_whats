FROM node:18-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV CI=false
ENV GENERATE_SOURCEMAP=false
RUN node ./node_modules/react-scripts/bin/react-scripts.js build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve@14.2.1
COPY --from=build /app/build ./build
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "serve -s build -l tcp://0.0.0.0:${PORT:-3000}"]
