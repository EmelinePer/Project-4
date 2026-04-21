FROM node:20-bookworm AS frontend-dev

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


FROM node:20-bookworm AS backend

WORKDIR /app

# Install required dependencies for KataGo runtime.
RUN apt-get update && apt-get install -y wget unzip libgomp1 libzip-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download KataGo (Eigen version for broad CPU compatibility without needing GPU drivers)
RUN wget https://github.com/lightvector/KataGo/releases/download/v1.15.3/katago-v1.15.3-eigen-linux-x64.zip -O katago.zip \
    && unzip katago.zip -d /app/katago_dir \
    && rm katago.zip \
    && chmod +x /app/katago_dir/katago

# Download a lightweight KataGo Neural Network model
RUN mkdir -p /app/models \
    && wget https://github.com/lightvector/KataGo/releases/download/v1.12.4/b18c384nbt-uec.bin.gz -O /app/models/model.bin.gz

# Create a minimal GTP config so KataGo can start without crashing.
RUN echo "logAllGTPCommunication = false\n\
logSearchInfo = false\n\
numSearchThreads = 4\n\
ponderingEnabled = false\n\
koRule = POSITIONAL\n\
scoringRule = AREA\n\
taxRule = NONE\n\
multiStoneSuicideLegal = false\n" > gtp_config.cfg

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 8000

CMD ["node", "server.js"]
