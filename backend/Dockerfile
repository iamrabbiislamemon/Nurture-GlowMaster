FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4000

# Wait for MySQL to be ready before starting
CMD ["sh", "-c", "sleep 10 && npm run dev"]
