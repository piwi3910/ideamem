# IdeaMem Deployment Guide

This guide covers various deployment strategies for IdeaMem, from development to production environments.

## Table of Contents

- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)

## Development Deployment

### Prerequisites

1. **Node.js 18+** and **pnpm**
2. **Qdrant Vector Database**
3. **Ollama with embedding models**

### Quick Setup

```bash
# 1. Start Qdrant
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# 2. Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve &
ollama pull nomic-embed-text

# 3. Clone and setup IdeaMem
git clone https://github.com/your-username/ideamem.git
cd ideamem
pnpm install
pnpm dev
```

### Environment Configuration

Create `.env.local`:

```env
# Optional: Override service URLs
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434

# Optional: Data directory
DATA_DIR=./data

# Optional: Custom port
PORT=3000
```

## Production Deployment

### System Requirements

- **CPU**: 4+ cores (for embedding generation)
- **Memory**: 8GB+ RAM (4GB for Qdrant, 2GB for Ollama, 2GB for app)
- **Storage**: 100GB+ SSD (for vector data growth)
- **Network**: High bandwidth for Git cloning and embedding operations

### Production Build

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Type check
pnpm run tsc --noEmit --skipLibCheck

# Lint code
pnpm run lint

# Build application
pnpm run build

# Start production server
pnpm start
```

### Process Management with PM2

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ideamem',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Reverse Proxy with Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for long-running operations
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Docker Deployment

### Multi-Service Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # IdeaMem Application
  ideamem:
    build: .
    ports:
      - '3000:3000'
    environment:
      - QDRANT_URL=http://qdrant:6333
      - OLLAMA_URL=http://ollama:11434
    volumes:
      - ./data:/app/data
    depends_on:
      - qdrant
      - ollama
    restart: unless-stopped

  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - '6333:6333'
    volumes:
      - qdrant_data:/qdrant/storage
    restart: unless-stopped

  # Ollama LLM Service
  ollama:
    image: ollama/ollama:latest
    ports:
      - '11434:11434'
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    # Post-startup model pull
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:11434/api/tags']
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  qdrant_data:
  ollama_data:
```

### Application Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create data directory
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
```

### Docker Deployment Commands

```bash
# Build and start services
docker-compose up -d

# Pull Ollama models
docker-compose exec ollama ollama pull nomic-embed-text

# Check service status
docker-compose ps

# View logs
docker-compose logs -f ideamem

# Scale application instances
docker-compose up -d --scale ideamem=3
```

## Cloud Deployment

### AWS Deployment

#### EC2 Instance Setup

```bash
#!/bin/bash
# User data script for EC2 instance

# Update system
yum update -y

# Install Docker
amazon-linux-extras install docker
systemctl start docker
systemctl enable docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Clone and deploy
cd /opt
git clone https://github.com/your-username/ideamem.git
cd ideamem

# Start services
docker-compose up -d

# Pull Ollama models
docker-compose exec -d ollama ollama pull nomic-embed-text
```

#### ECS Deployment

Create `task-definition.json`:

```json
{
  "family": "ideamem",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "ideamem",
      "image": "your-account.dkr.ecr.region.amazonaws.com/ideamem:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "QDRANT_URL",
          "value": "http://qdrant-service:6333"
        },
        {
          "name": "OLLAMA_URL",
          "value": "http://ollama-service:11434"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ideamem",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Platform

#### Cloud Run Deployment

```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/ideamem

# Deploy to Cloud Run
gcloud run deploy ideamem \
  --image gcr.io/PROJECT_ID/ideamem \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --set-env-vars QDRANT_URL=http://qdrant-service,OLLAMA_URL=http://ollama-service
```

#### Kubernetes Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ideamem
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ideamem
  template:
    metadata:
      labels:
        app: ideamem
    spec:
      containers:
        - name: ideamem
          image: gcr.io/PROJECT_ID/ideamem:latest
          ports:
            - containerPort: 3000
          env:
            - name: QDRANT_URL
              value: 'http://qdrant-service:6333'
            - name: OLLAMA_URL
              value: 'http://ollama-service:11434'
          resources:
            requests:
              memory: '2Gi'
              cpu: '1'
            limits:
              memory: '4Gi'
              cpu: '2'
---
apiVersion: v1
kind: Service
metadata:
  name: ideamem-service
spec:
  selector:
    app: ideamem
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

### Azure Deployment

#### Container Instances

```bash
# Create resource group
az group create --name ideamem-rg --location eastus

# Deploy container
az container create \
  --resource-group ideamem-rg \
  --name ideamem \
  --image your-registry/ideamem:latest \
  --cpu 2 \
  --memory 4 \
  --ports 3000 \
  --environment-variables QDRANT_URL=http://qdrant OLLAMA_URL=http://ollama \
  --restart-policy Always
```

## Monitoring and Maintenance

### Health Monitoring

Create `health-check.sh`:

```bash
#!/bin/bash

# Service health check script
check_service() {
    local url=$1
    local name=$2

    if curl -f -s -o /dev/null "$url"; then
        echo "✅ $name is healthy"
        return 0
    else
        echo "❌ $name is down"
        return 1
    fi
}

# Check all services
check_service "http://localhost:3000/api/admin/health" "IdeaMem App"
check_service "http://localhost:6333/health" "Qdrant"
check_service "http://localhost:11434/api/tags" "Ollama"

# Check disk space
df -h | grep -E "/$|/data"

# Check memory usage
free -h

# Check running processes
ps aux | grep -E "(node|qdrant|ollama)"
```

### Backup Strategy

```bash
#!/bin/bash

# Backup script
BACKUP_DIR="/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Backup application data
cp -r ./data "$BACKUP_DIR/"

# Backup Qdrant data
docker exec qdrant qdrant-backup --output /backup/qdrant-$(date +%Y-%m-%d).tar.gz

# Backup configuration
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/"

# Clean old backups (keep 30 days)
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

### Log Management

```bash
# Log rotation configuration
cat > /etc/logrotate.d/ideamem << EOF
/opt/ideamem/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        docker-compose restart ideamem
    endscript
}
EOF
```

### Performance Tuning

#### Qdrant Optimization

```yaml
# qdrant-config.yaml
service:
  host: 0.0.0.0
  port: 6333

storage:
  # Optimize for search performance
  search_threads: 4
  write_ahead_log: true

  # Memory optimization
  memory_threshold: 0.8

  # Disk optimization
  disk_threshold: 0.9
```

#### Ollama Optimization

```bash
# Set Ollama environment variables
export OLLAMA_NUM_PARALLEL=4
export OLLAMA_MAX_LOADED_MODELS=2
export OLLAMA_FLASH_ATTENTION=1
```

### Troubleshooting

#### Common Issues

1. **Out of Memory**

   ```bash
   # Check memory usage
   docker stats

   # Increase memory limits
   docker-compose up -d --scale ideamem=1 --memory=8g
   ```

2. **Slow Indexing**

   ```bash
   # Check Ollama performance
   curl http://localhost:11434/api/generate -d '{"model":"nomic-embed-text","prompt":"test"}'

   # Monitor Qdrant performance
   curl http://localhost:6333/metrics
   ```

3. **Connection Issues**
   ```bash
   # Test service connectivity
   docker-compose exec ideamem curl http://qdrant:6333/health
   docker-compose exec ideamem curl http://ollama:11434/api/tags
   ```

### Maintenance Schedule

- **Daily**: Health checks, log review
- **Weekly**: Performance monitoring, backup verification
- **Monthly**: Security updates, dependency updates
- **Quarterly**: Capacity planning, performance optimization

---

This deployment guide provides comprehensive coverage for various deployment scenarios. Choose the approach that best fits your infrastructure and requirements.
