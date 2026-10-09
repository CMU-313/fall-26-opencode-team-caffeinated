FROM oven/bun:latest

# Install Python, build tools for native modules, and Git for Husky
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*