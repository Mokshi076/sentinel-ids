FROM node:20-alpine
WORKDIR /app
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
COPY package.json .
RUN npm install
COPY . .
RUN npm run build
CMD ["npm","start"]
