FROM node:20-bookworm

WORKDIR /app

# Install required dependencies
RUN apt-get update && apt-get install -y wget unzip libzip4 zlib1g

# Download KataGo (Eigen version for broad CPU compatibility without needing GPU drivers)
RUN wget https://github.com/lightvector/KataGo/releases/download/v1.15.3/katago-v1.15.3-eigen-linux-x64.zip -O katago.zip \
    && unzip katago.zip -d /app/katago_dir \
    && rm katago.zip \
    && chmod +x /app/katago_dir/katago \
    && cd /app/katago_dir \
    && ./katago --appimage-extract \
    && mv squashfs-root/usr/bin/katago ./katago_extracted \
    && mv ./katago_extracted ./katago \
    && rm -rf squashfs-root

# Download a lightweight KataGo Neural Network model from GitHub directly to avoid CloudFlare 403 blocks
RUN mkdir -p /app/models \
    && wget https://github.com/lightvector/KataGo/releases/download/v1.12.4/b18c384nbt-uec.bin.gz -O /app/models/model.bin.gz

# Copy package info and install the backend dependencies
COPY package*.json ./
RUN npm install express cors

# Copy the server file
COPY server.js ./

EXPOSE 3001

CMD ["node", "server.js"]
