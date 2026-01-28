# ---- Base image ----
FROM node:20-alpine

# ---- Set working directory ----
WORKDIR /app

# ---- Install dependencies first (better caching) ----
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ---- Copy source code ----
COPY . .

# ---- Build TypeScript ----
RUN yarn build

# ---- Expose app port ----
EXPOSE 3000

# ---- Start app ----
CMD ["node", "dist/index.js"]
