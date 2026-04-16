FROM node:20-bookworm

WORKDIR /app

# Install required dependencies
RUN apt-get update && apt-get install -y wget curl unzip libzip-dev zlib1g libgomp1 \
    && wget -q http://mirrors.kernel.org/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb \
    && apt-get update \
    && apt-get install -y ./libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb \
    && rm libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb \
    && wget -q http://mirrors.kernel.org/ubuntu/pool/universe/libz/libzip/libzip5_1.5.1-0ubuntu1_amd64.deb \
    && apt-get update \
    && apt-get install -y ./libzip5_1.5.1-0ubuntu1_amd64.deb \
    && rm libzip5_1.5.1-0ubuntu1_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# Download KataGo (Eigen version for broad CPU compatibility without needing GPU drivers)
RUN wget https://github.com/lightvector/KataGo/releases/download/v1.15.3/katago-v1.15.3-eigen-linux-x64.zip -O katago.zip \
    && unzip katago.zip -d /app/katago_dir \
    && rm katago.zip \
    && chmod +x /app/katago_dir/katago

# Download a lightweight KataGo Neural Network model from GitHub directly to avoid CloudFlare 403 blocks
RUN mkdir -p /app/models \
    && wget https://github.com/lightvector/KataGo/releases/download/v1.12.4/b18c384nbt-uec.bin.gz -O /app/models/model.bin.gz

# Create a minimal GTP config so KataGo can start without crashing.
# All unset parameters use KataGo's built-in defaults.
RUN echo "logAllGTPCommunication = false\n\
logSearchInfo = false\n\
numSearchThreads = 4\n\
ponderingEnabled = false\n\
koRule = POSITIONAL\n\
scoringRule = AREA\n\
taxRule = NONE\n\
multiStoneSuicideLegal = false\n" > gtp_config.cfg

# Copy package info and install the backend dependencies
COPY package*.json ./
RUN npm install express cors

# Copy the server file
COPY server.js ./

EXPOSE 8000

CMD ["node", "server.js"]
