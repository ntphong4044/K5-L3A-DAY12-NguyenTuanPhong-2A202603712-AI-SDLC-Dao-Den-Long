# Bản phát hành v1.0.0 trong container:
#   docker build -t dao-den-long .
#   docker run --rm -p 5173:5173 dao-den-long     ->  http://localhost:5173
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY game.contract.json LICENSE ./
COPY src ./src
COPY web ./web
COPY scripts/serve.js ./scripts/serve.js
ENV PORT=5173
EXPOSE 5173
CMD ["node", "scripts/serve.js"]
