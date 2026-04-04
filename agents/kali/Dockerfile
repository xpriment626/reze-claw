FROM node:24-slim

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

# Coral passes these env vars when launching via DockerRuntime
# ENV CORAL_AGENT_SECRET=
# ENV CORAL_CONNECTION_URL=
# ENV CORAL_AGENT_ID=kali
# ENV REPLICATE_API_TOKEN=

CMD ["pnpm", "dev"]
