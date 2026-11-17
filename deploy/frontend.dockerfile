FROM node:26.13.1-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY back-end/package.json ./back-end/package.json
COPY front-end/package.json ./front-end/package.json
COPY packages/credit-plans ./packages/credit-plans
RUN npm ci --workspace @clipvelto/web --include-workspace-root=false
COPY front-end ./front-end
ARG API_INTERNAL_URL=http://api:4000
ARG GOOGLE_SITE_VERIFICATION
ENV API_INTERNAL_URL=$API_INTERNAL_URL GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION
RUN npm run build --workspace @clipvelto/web

FROM node:26.13.1-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/front-end/.next/standalone ./
COPY --from=build --chown=node:node /app/front-end/.next/static ./front-end/.next/static
COPY --from=build --chown=node:node /app/front-end/public ./front-end/public
RUN mkdir -p /app/front-end/.next/cache && chown -R node:node /app/front-end/.next
USER node
EXPOSE 3000
CMD ["node", "front-end/server.js"]
