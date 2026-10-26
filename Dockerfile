# ===============================
# Stage 1 — Build Vue Application
# ===============================
FROM node:20.20.2-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_APP_KEY
ARG VITE_ENCRYPTION_SECRET_KEY
ARG VITE_BASE_URL
ARG VITE_PUBLIC_APP_URL=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_KEY=$VITE_APP_KEY \
    VITE_ENCRYPTION_SECRET_KEY=$VITE_ENCRYPTION_SECRET_KEY \
    VITE_BASE_URL=$VITE_BASE_URL \
    VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN rm -f .env .env.*
RUN npm run build

# ===============================
# Stage 2 — Nginx
# ===============================
FROM nginx:1.30.2-alpine

RUN apk update \
    && apk upgrade --no-cache --available \
    && apk add --no-cache --upgrade curl \
    && rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
