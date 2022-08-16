# Use LTS Node.js slim image
FROM node:18-bullseye-slim

# Video support dependency
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg=7:4.4.2-0ubuntu0.22.04.1 wget=1.21.2-2ubuntu1 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Install NPM dependencies and copy the project
WORKDIR /teddit
COPY . ./
RUN npm install --no-optional
COPY config.js.template ./config.js

RUN find ./static/ -type d -exec chmod -R 777 {} \;

HEALTHCHECK --interval=30s --timeout=3s --retries=5 --start-period=10s  \
  CMD wget --no-verbose --spider http://localhost:8080/about

CMD npm start
