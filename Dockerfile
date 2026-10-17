FROM node:lts
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg imagemagick webp python3 python3-pip && apt-get clean
RUN pip3 install yt-dlp --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm install && npm cache clean --force
COPY . .
RUN mkdir -p session
EXPOSE 3000
ENV NODE_ENV production
CMD ["npm", "run", "start"]
