FROM node:24

WORKDIR /app

COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN cd server && npm install
RUN cd client && npm install

COPY . .

RUN cd client && npm run build

RUN npm install -g concurrently

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]