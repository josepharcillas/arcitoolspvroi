# Public ROI tracker. No dependencies, no database, no secrets - the whole
# calculator runs in the visitor's browser.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production PORT=3005
USER node
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3005)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
