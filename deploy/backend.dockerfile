FROM node:26.13.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY back-end/package.json ./back-end/package.json
COPY front-end/package.json ./front-end/package.json
COPY packages/credit-plans ./packages/credit-plans
RUN npm ci --workspace @clipvelto/api --include-workspace-root=false
COPY back-end/tsconfig*.json ./back-end/
COPY back-end/src ./back-end/src
RUN npm run build --workspace @clipvelto/api

FROM node:26.13.1-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY back-end/package.json ./back-end/package.json
COPY front-end/package.json ./front-end/package.json
COPY packages/credit-plans ./packages/credit-plans
RUN npm ci --omit=dev --workspace @clipvelto/api --include-workspace-root=false \
    && npm cache clean --force

FROM node:26.13.1-bookworm-slim AS runner
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 \
    YOUTUBE_PYTHON=/opt/media/bin/python FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe TMPDIR=/var/tmp/clipvelto \
    OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates ffmpeg fonts-dejavu-core python3 python3-venv libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY back-end/media/requirements.txt /tmp/media-requirements.txt
RUN python3 -m venv /opt/media \
    && /opt/media/bin/pip install --no-cache-dir -r /tmp/media-requirements.txt \
    && rm /tmp/media-requirements.txt \
    && mkdir -p /var/tmp/clipvelto && chown node:node /var/tmp/clipvelto
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/packages ./packages
COPY --from=dependencies /app/package.json ./package.json
COPY --from=build --chown=node:node /app/back-end/dist ./back-end/dist
COPY back-end/package.json ./back-end/package.json
COPY --chown=node:node back-end/media ./back-end/media
COPY --chown=node:node back-end/reframing ./back-end/reframing
USER node
WORKDIR /app/back-end
EXPOSE 4000
CMD ["node", "dist/server.js"]
