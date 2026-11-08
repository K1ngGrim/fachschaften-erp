# Basisimages per Digest festgenagelt, damit ein neuer Tag nicht unbemerkt den
# Build-Cache verwirft. Auffrischen (holt auch Sicherheitsupdates):
#   docker buildx imagetools inspect node:22-alpine | grep Digest
#   docker buildx imagetools inspect nginx:1.27-alpine | grep Digest
# Stand: 2026-11-08
FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS final
# Das offizielle Image ersetzt ${...} in /etc/nginx/templates/*.template beim Start.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/portal/browser /usr/share/nginx/html
ENV API_UPSTREAM=http://api:8080
EXPOSE 80
