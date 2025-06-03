# PrivMX MCP - Docker Setup Guide

This guide helps you set up the PrivMX MCP system with Qdrant vector database using Docker.

## 🚀 Quick Start

### 1. Start Qdrant Vector Database

```bash
# Start Qdrant in background
docker-compose up -d qdrant

# Check Qdrant health
curl http://localhost:6333/health
```

### 2. Set Up Environment

```bash
# Copy and configure environment
cp packages/mcp-server/.env.example packages/mcp-server/.env

# Edit .env to add your OpenAI API key
echo "OPENAI_API_KEY=your-api-key-here" >> packages/mcp-server/.env
```

### 3. Process Documentation & Generate Embeddings

```bash
# Install dependencies
pnpm install

# Index documentation
pnpm cli:index

# Generate embeddings
pnpm cli:embeddings

# Store in Qdrant
pnpm cli:qdrant
```

### 4. Test the System

```bash
# Test Qdrant search
pnpm cli:qdrant --test

# View statistics
pnpm cli:qdrant --stats

# Start MCP server
pnpm cli:start
```

## 🐳 Docker Compose Services

### Qdrant Vector Database

- **Image**: `qdrant/qdrant:v1.7.4`
- **Ports**: 
  - `6333` - REST API
  - `6334` - gRPC API (optional)
- **Volume**: Persistent storage in `qdrant_storage`
- **Health Check**: Automatic health monitoring

### Configuration

The Qdrant service is optimized for the PrivMX documentation workload:

```yaml
environment:
  # Performance settings
  QDRANT__SERVICE__MAX_REQUEST_SIZE_MB: 32
  QDRANT__SERVICE__MAX_WORKERS: 4
  
  # Storage optimization
  QDRANT__STORAGE__OPTIMIZERS__DEFAULT_SEGMENT_NUMBER: 2
  QDRANT__STORAGE__OPTIMIZERS__MAX_SEGMENT_SIZE_KB: 20000
  
  # HNSW index settings for vector search
  QDRANT__STORAGE__HNSW_INDEX__M: 16
  QDRANT__STORAGE__HNSW_INDEX__EF_CONSTRUCT: 100
```

## 🔧 Management Commands

### Docker Operations

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f qdrant

# Stop services
docker-compose down

# Clean up (removes volumes!)
docker-compose down -v
```

### Qdrant Management

```bash
# Check Qdrant status
curl http://localhost:6333/health

# List collections
curl http://localhost:6333/collections

# Get collection info
curl http://localhost:6333/collections/privmx-docs

# View collection statistics
curl http://localhost:6333/collections/privmx-docs | jq
```

### Data Management

```bash
# Clean all data (including Qdrant)
pnpm cli:clean --force --embeddings --qdrant

# Clean only local files (keep Qdrant)
pnpm cli:clean --force --embeddings

# Reset only Qdrant collection
pnpm cli:qdrant --cleanup
```

## 📊 System Architecture

```
Documentation Files
        ↓
    Chunking & Processing
        ↓
    OpenAI Embeddings (1536 dimensions)
        ↓
    SQLite Tracking Database
        ↓
    Qdrant Vector Database
        ↓
    MCP Server (Semantic Search)
```

## 🔍 Troubleshooting

### Qdrant Connection Issues

```bash
# Check if Qdrant is running
docker ps | grep qdrant

# Check Qdrant logs
docker-compose logs qdrant

# Test connection
curl -f http://localhost:6333/health || echo "Qdrant not accessible"
```

### Performance Issues

```bash
# Check Qdrant resource usage
docker stats privmx-qdrant

# Monitor collection size
curl http://localhost:6333/collections/privmx-docs | jq '.result.points_count'

# Check indexing status
curl http://localhost:6333/collections/privmx-docs | jq '.result.status'
```

### Data Issues

```bash
# Verify embeddings exist
ls -la data/embeddings.json

# Check tracking database
sqlite3 data/embeddings-tracker.db "SELECT COUNT(*) FROM embedding_tracking;"

# Validate collection in Qdrant
curl http://localhost:6333/collections/privmx-docs/points/count
```

## 🛡️ Security & Authentication

### Optional: Enable Qdrant Authentication

Uncomment in `docker-compose.yml`:

```yaml
environment:
  QDRANT__SERVICE__API_KEY: "your-secret-api-key"
```

Then set in your `.env`:

```bash
QDRANT_API_KEY=your-secret-api-key
```

### Network Security

The setup creates an isolated network `privmx-network` for service communication.

## 📈 Monitoring & Metrics

### Qdrant Metrics

```bash
# Collection statistics
curl http://localhost:6333/collections/privmx-docs | jq '{
  points_count: .result.points_count,
  status: .result.status,
  vectors_count: .result.vectors_count
}'

# System telemetry
curl http://localhost:6333/telemetry
```

### Application Metrics

```bash
# View tracking statistics
pnpm cli:qdrant --stats

# Check embeddings summary
cat data/embeddings-summary.json | jq

# View Qdrant storage summary
cat data/qdrant-storage-summary.json | jq
```

## 🔄 Backup & Recovery

### Backup Qdrant Data

```bash
# Create snapshot
curl -X POST http://localhost:6333/collections/privmx-docs/snapshots

# List snapshots
curl http://localhost:6333/collections/privmx-docs/snapshots

# Backup volume (while stopped)
docker-compose down
docker run --rm -v mcp-privmx_qdrant_storage:/data -v $(pwd)/backup:/backup alpine tar czf /backup/qdrant-backup.tar.gz -C /data .
```

### Restore Qdrant Data

```bash
# Restore volume (while stopped)
docker-compose down
docker run --rm -v mcp-privmx_qdrant_storage:/data -v $(pwd)/backup:/backup alpine tar xzf /backup/qdrant-backup.tar.gz -C /data
docker-compose up -d
```

## 🚀 Production Deployment

### Resource Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB+ for moderate document sets
- **Storage**: SSD recommended for vector operations
- **Network**: 1Gbps+ for bulk operations

### Scaling Considerations

```yaml
# Production docker-compose overrides
environment:
  QDRANT__SERVICE__MAX_WORKERS: 8
  QDRANT__STORAGE__OPTIMIZERS__MAX_SEGMENT_SIZE_KB: 50000
  QDRANT__STORAGE__WAL__WAL_CAPACITY_MB: 64
```

### Health Monitoring

```bash
# Set up health check monitoring
while true; do
  curl -f http://localhost:6333/health >/dev/null 2>&1 || echo "$(date): Qdrant health check failed"
  sleep 30
done
```

## 📝 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key for embeddings | - | ✅ |
| `QDRANT_URL` | Qdrant server URL | `http://localhost:6333` | ❌ |
| `QDRANT_API_KEY` | Qdrant API key (if auth enabled) | - | ❌ |

## 🎯 Next Steps

After successful setup:

1. **Integrate with MCP Server**: Add semantic search to MCP tools
2. **Implement Hybrid Search**: Combine vector and keyword search
3. **Add Caching**: Implement query result caching
4. **Monitor Performance**: Set up metrics and alerting
5. **Scale as Needed**: Adjust Qdrant configuration for your workload

## 📞 Support

- 🐛 **Issues**: Check logs and troubleshooting section
- 📖 **Documentation**: See main README.md for development details
- 🔧 **Configuration**: Review docker-compose.yml for customization 