FROM docker.io/library/node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node backend ./backend
COPY --chown=node:node index.html styles.css ./
COPY --chown=node:node src ./src
COPY --chown=node:node assets ./assets
COPY --chown=node:node scripts/check-ai.mjs ./scripts/check-ai.mjs
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.mjs"]
