FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine AS final
# Das offizielle Image ersetzt ${...} in /etc/nginx/templates/*.template beim Start.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/portal/browser /usr/share/nginx/html
ENV API_UPSTREAM=http://api:8080
EXPOSE 80
