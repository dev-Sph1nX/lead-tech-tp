# FROM node:alpine
# COPY . /app
# WORKDIR /app
# RUN npm install
# CMD node server.js

FROM node:alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production
COPY . .

CMD ["node", "server.js"]