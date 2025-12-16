# 🚀 Order Execution Engine

A high-performance DEX order execution engine built with TypeScript that routes trades between Raydium and Meteora, provides real-time WebSocket updates, and maintains complete audit trails in a database.

## 📋 Table of Contents

- [Order Type Choice](#-order-type-choice-market-orders)
- [Branches & Implementations](#-branches--implementations)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [API Documentation](#-api-documentation)
- [WebSocket Protocol](#-websocket-protocol)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Deliverables Checklist](#-deliverables-checklist)
- [Demo Video](#-demo-video)

---

## 🌿 Branches & Implementations

This repository contains **three branches** demonstrating different implementation approaches:

### 1️⃣ `main` - Mock Implementation (Recommended for Development)
**Purpose**: Fast, reliable development and testing without blockchain dependencies

**Features**:
- ✅ Simulated DEX responses with realistic delays (200ms-3s)
- ✅ Mock price variations between Raydium and Meteora (2-5% difference)
- ✅ Complete order lifecycle and WebSocket updates
- ✅ Perfect for CI/CD and unit testing
- ✅ No blockchain setup required

**Use this branch for**:
- Local development
- Running automated tests
- Understanding system architecture
- Quick iteration

```bash
git checkout main
npm install
npm run dev
```

---

### 2️⃣ `devnet` - Real Solana Devnet Execution
**Purpose**: Real blockchain transactions on Solana devnet

**Features**:
- ✅ Actual Raydium SDK integration (`@raydium-io/raydium-sdk-v2`)
- ✅ Real transaction submission and confirmation
- ✅ Handles slippage, network latency, and retries
- ✅ **Verified Transaction Proof**: [View on Solana Explorer](https://explorer.solana.com/tx/3y18n87QDFHMshtiNpCfoKXv2KLwWVqLmt47bdqwbzJqBKjuB197cTwpz2MZFK1CCuuxWXQwEHUWChSZKszMwmgz?cluster=devnet)

**Transaction Details**:
```
Network: Devnet
Transaction Hash: 3y18n87QDFHMshtiNpCfoKXv2KLwWVqLmt47bdqwbzJqBKjuB197cTwpz2MZFK1CCuuxWXQwEHUWChSZKszMwmgz
Status: Confirmed ✅
DEX: Raydium
Block: Confirmed on Solana Devnet
```

**Prerequisites**:
- Solana CLI installed
- Devnet SOL from [faucet.solana.com](https://faucet.solana.com)
- Wallet keypair

**Setup**:
```bash
git checkout devnet
npm install

# Get devnet SOL
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Run with real blockchain
npm run dev
```

**Additional Environment Variables**:
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
WALLET_PRIVATE_KEY=your_base58_private_key
SLIPPAGE_TOLERANCE=0.01
```

---

### 3️⃣ `deployment` - Production-Ready Branch
**Purpose**: Optimized for cloud deployment with production configurations

**Features**:
- ✅ Production build optimizations
- ✅ Enhanced error logging and monitoring
- ✅ Rate limiting and security headers
- ✅ Health check endpoints for load balancers
- ✅ Docker support
- ✅ Environment-based configuration

**Deployment Platforms**:
- Render
- Railway
- Fly.io
- AWS/GCP/Azure

**Quick Deploy**:
```bash
git checkout deployment

# Using Docker
docker build -t order-engine .
docker run -p 3000:3000 --env-file .env order-engine

# Or direct deploy
npm run build
npm start
```

**Live Demo**: [https://your-deployed-url.com](https://your-deployed-url.com)

---

## 🎯 Order Type Choice: Market Orders

This engine currently supports **Market Orders**.

### Why Market Orders?

Market orders were chosen because they best demonstrate the core goals of this system:

- **Immediate execution** using live DEX pricing
- **Real-time routing** between Raydium and Meteora based on best price
- **Clear visibility** into execution lifecycle via WebSocket updates
- **Simplicity** that allows focus on DEX routing accuracy, concurrency handling, and execution flow

Market orders remove the complexity of price waiting conditions, allowing the system to showcase **DEX routing logic, concurrent processing, and real-time status streaming**, which are the primary evaluation criteria.

### 🔄 Extending to Other Order Types

The engine is designed to be extensible and can support additional order types with minimal changes:

#### Limit Orders
- **Implementation**: Store `targetPrice` with the order, periodically re-fetch DEX quotes (or subscribe to price feeds), and execute only when `bestEffectivePrice <= targetPrice`
- **Extension Point**: Add price checking logic in the worker before routing. Requeue if price target not met.

#### Sniper Orders
- **Implementation**: Add pre-execution conditions (e.g., token mint creation, pool initialization, liquidity threshold). Trigger execution when on-chain events are detected.
- **Extension Point**: Add event listeners for token launches, then use existing routing and execution pipeline.

**Key Insight**: Because routing, execution, and WebSocket updates are already decoupled, new order types only need **new trigger logic**, not a new execution engine.

---

## ✨ Features

✅ **Market Order Execution** with intelligent DEX routing  
✅ **Real-time WebSocket Updates** for order lifecycle  
✅ **Concurrent Processing** - 10 workers, 100 orders/minute  
✅ **Smart DEX Routing** - Automatically selects Raydium or Meteora based on best price  
✅ **Complete Audit Trail** - All orders, transactions, and events stored in Supabase  
✅ **Retry Logic** - Exponential backoff with 3 attempts  
✅ **Error Handling** - Failed orders logged with detailed error messages  
✅ **RESTful API** - Full CRUD operations for orders  
✅ **Comprehensive Testing** - 10 unit & integration tests covering all critical paths

---

## 🏗️ Architecture

### System Flow

```
┌─────────┐
│  Client │
└────┬────┘
     │
     │ POST /api/orders/execute
     ▼
┌─────────┐
│   API   │────────────┐
│ (Fastify)│           │
└────┬────┘            │
     │                 │
     │ Add Job         │ WebSocket
     ▼                 │ Connection
┌─────────┐            │
│ BullMQ  │            │
│  Queue  │            │
└────┬────┘            │
     │                 │
     │ Process Job     │
     ▼                 ▼
┌─────────┐      ┌──────────┐
│ Worker  │─────>│    WS    │
│         │      │  Manager │
└────┬────┘      └──────────┘
     │                 │
     │ Route Order     │ Send Updates
     ▼                 │
┌─────────┐            │
│   DEX   │            │
│ Router  │            │
└────┬────┘            │
     │                 │
     ├─────────────────┼─────────────┐
     │                 │             │
     ▼                 ▼             ▼
┌──────────┐    ┌──────────┐   ┌──────────┐
│ Raydium  │    │ Meteora  │   │ Supabase │
│  Quote   │    │  Quote   │   │    DB    │
└──────────┘    └──────────┘   └──────────┘
```

### Order Lifecycle

```
pending → routing → building → submitted → confirmed
   │         │          │          │
   └─────────┴──────────┴──────────┴────────→ failed
```

---

## 🧪 Testing

### Test Suite Coverage

This project includes **10 comprehensive tests** covering routing logic, queue behavior, and WebSocket lifecycle:

```bash
npm test
```

**Test Results**:
```
✓ tests/integration/websocket-sequence.test.ts (1) 
✓ tests/integration/failure-flow.test.ts (1)
✓ tests/unit/routing-best-price.test.ts (1)
✓ tests/unit/routing-fallback.test.ts (1)
✓ tests/unit/retry-logic.test.ts (1)
✓ tests/unit/price-fee-compare.test.ts (1)
✓ tests/unit/max-retry-fail.test.ts (1)
✓ tests/integration/websocket-txhash.test.ts (1)
✓ tests/integration/order-lifecycle.test.ts (1)
✓ tests/integration/queue-multiple-orders.test.ts (1)

Test Files: 10 passed (10)
Tests: 10 passed (10)
Duration: 581ms
```

### Test Categories

#### Unit Tests (Routing Logic)
1. **`routing-best-price.test.ts`** - Verifies DEX selection based on best effective price
2. **`routing-fallback.test.ts`** - Tests fallback when primary DEX fails
3. **`price-fee-compare.test.ts`** - Validates fee calculation in price comparison
4. **`retry-logic.test.ts`** - Confirms exponential backoff retry mechanism
5. **`max-retry-fail.test.ts`** - Ensures orders fail after 3 retry attempts

#### Integration Tests (Queue & WebSocket)
6. **`order-lifecycle.test.ts`** - Full end-to-end order execution flow
7. **`queue-multiple-orders.test.ts`** - Concurrent processing of 5+ orders
8. **`websocket-sequence.test.ts`** - Complete WebSocket status progression
9. **`websocket-txhash.test.ts`** - Transaction hash delivery via WebSocket
10. **`failure-flow.test.ts`** - Error handling and failure state transitions

### Running Specific Tests

```bash
# Run only unit tests
npm test -- tests/unit

# Run only integration tests
npm test -- tests/integration

# Run specific test file
npm test -- tests/unit/routing-best-price.test.ts

# Watch mode for development
npm test -- --watch
```

### Manual Testing Scenarios

**Test 1: Single Order**
```bash
curl -X POST https://order-execution-engine-3-5pts.onrender.com/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"amount": 1}'
```

**Test 2: Multiple Concurrent Orders (Queue Test)**
```bash
for i in {1..5}; do
  curl -X POST https://order-execution-engine-3-5pts.onrender.com/api/orders/execute \
    -H "Content-Type: application/json" \
    -d '{"amount": 1}' &
done
wait
```

**Test 3: WebSocket Connection**
```bash
npm install -g wscat
wscat -c "wss://order-execution-engine-3-5pts.onrender.com/api/orders/ws?orderId=YOUR_ORDER_ID"
```

---

## 📦 API Testing Collection

### Postman Collection

A complete Postman collection is provided in the repository with pre-configured requests for all endpoints.

**Location**: [`postman/order.postman_collection.json`](./postman/order.postman_collection.json)

**Collection ID**: `c459ca1f-1ac6-4a5e-a55c-b65607a7886e`

**Import to Postman**:
1. Open Postman
2. Click "Import" → "Upload Files"
3. Select `order.postman_collection.json` from the `postman` folder
4. Update environment variables to match your deployment

**Included Endpoints**:
- ✅ Execute Order (POST `/api/orders/execute`)
- ✅ Get Order Details (GET `/api/orders/:orderId`)
- ✅ List All Orders (GET `/api/orders`)
- ✅ Get Order Events (GET `/api/orders/:orderId/events`)
- ✅ Health Check (GET `/health`)

**Environment Variables**:
```json
{
  "baseUrl": "https://order-execution-engine-3-5pts.onrender.com",
  "wsUrl": "wss://order-execution-engine-3-5pts.onrender.com"
}
```

**Quick Test**:
```bash
# Import the collection, then run:
# 1. Health Check
# 2. Execute Order
# 3. Get Order Details (using orderId from step 2)
# 4. Get Order Events
```

---

## 🎥 Demo Videos

### Quick Demo (1:24) - Concurrent Order Processing
📹 **YouTube**: [Multiple Orders Demo](https://www.youtube.com/watch?v=O_ic9ADdoYQ)

**What's Shown**:
- 3-5 orders submitted simultaneously
- Real-time WebSocket updates for all orders
- Queue processing multiple orders concurrently
- DEX routing decisions in console logs
- All orders completing: `pending → routing → building → submitted → confirmed`

**Perfect for**: Quick overview of system capabilities and concurrent processing

---

### Full System Breakdown (12:00) - Complete Walkthrough
📹 **YouTube**: [Complete System Demonstration](https://www.youtube.com/watch?v=1LVC7IKlNag)


**Perfect for**: Complete understanding of design, implementation, and deployment

---

## 🚀 Deployment

### Live Deployment

**Production URL**: `https://order-execution-engine-3-5pts.onrender.com`

**API Endpoint**: `https://order-execution-engine-3-5pts.onrender.com/api/orders/execute`

**WebSocket**: `wss://order-execution-engine-3-5pts.onrender.com/api/orders/ws?orderId={orderId}`

**Status**: ✅ Online and operational

**Deployment Platform**: Render

**Try it now**:
```bash
curl -X POST https://order-execution-engine-3-5pts.onrender.com/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"amount": 1}'
```

### Environment Setup

```env
# Production Environment Variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-production-key
REDIS_URL=redis://default:password@redis-host:6379
PORT=3000
NODE_ENV=production
```

### Quick Deploy Options

#### Railway
```bash
git checkout deployment
railway init
railway up
```

#### Render
1. Connect GitHub repository
2. Select `deployment` branch
3. Add environment variables
4. Deploy

#### Docker
```bash
git checkout deployment
docker build -t order-engine .
docker run -p 3000:3000 --env-file .env order-engine
```

---

## ✅ Deliverables Checklist

All required deliverables have been completed:

### 1. ✅ GitHub Repository
- **URL**: [https://github.com/KunalRaj9835/Order_Execution_Engine](https://github.com/KunalRaj9835/Order_Execution_Engine)
- **Clean Commits**: Semantic commit messages with clear history
- **Branches**: 
  - `main` - Mock implementation
  - `devnet` - Real Solana devnet execution
  - `deployment` - Production-ready code

### 2. ✅ API Implementation
- **Order Execution**: POST `/api/orders/execute`
- **DEX Routing**: Raydium vs Meteora price comparison
- **Status Updates**: Real-time via WebSocket
- **CRUD Operations**: Full order management API

### 3. ✅ WebSocket Status Updates
- **Connection**: `/api/orders/ws?orderId={id}`
- **Lifecycle**: `pending → routing → building → submitted → confirmed`
- **Error Handling**: Failed status with detailed error messages

### 4. ✅ Real Execution Proof (Devnet Branch)
- **Transaction**: [View on Solana Explorer](https://explorer.solana.com/tx/3y18n87QDFHMshtiNpCfoKXv2KLwWVqLmt47bdqwbzJqBKjuB197cTwpz2MZFK1CCuuxWXQwEHUWChSZKszMwmgz?cluster=devnet)
- **Network**: Solana Devnet
- **DEX**: Raydium
- **Status**: ✅ Confirmed

### 5. ✅ Documentation
- **README**: Complete setup and API documentation
- **Design Decisions**: Market order choice explained
- **Architecture**: System flow diagrams and component breakdown
- **Setup Instructions**: Step-by-step installation guide

### 6. ✅ Deployment
- **Platform**: Render
- **URL**: `https://order-execution-engine-3-5pts.onrender.com`
- **Status**: ✅ Online
- **Health Check**: `GET /health`

### 7. ✅ Demo Videos
- **Quick Demo (1:24)**: [Multiple Orders Processing](https://www.youtube.com/watch?v=O_ic9ADdoYQ)
- **Full Breakdown (12:00)**: [Complete System Walkthrough](https://www.youtube.com/watch?v=1LVC7IKlNag)
- **Contents**:
  - ✅ System architecture overview and design decisions
  - ✅ 3-5 concurrent orders submitted
  - ✅ WebSocket status updates (all states shown)
  - ✅ DEX routing logs in console
  - ✅ Queue processing multiple orders
  - ✅ Code walkthrough and testing demonstration

### 8. ✅ Postman Collection
- **File**: [`postman/order.postman_collection.json`](./postman/order.postman_collection.json)
- **Collection ID**: `c459ca1f-1ac6-4a5e-a55c-b65607a7886e`
- **Coverage**: All API endpoints with environment variables
- **Import**: Available in repository

### 9. ✅ Testing Suite
- **Framework**: Vitest
- **Tests**: 10 passed
- **Coverage**:
  - ✅ Routing logic (5 tests)
  - ✅ Queue behavior (2 tests)
  - ✅ WebSocket lifecycle (3 tests)
- **Run**: `npm test`

---

## 📚 Additional Resources

### Documentation
- [API Reference](./docs/API.md)
- [WebSocket Protocol](./docs/WEBSOCKET.md)
- [Database Schema](./docs/DATABASE.md)
- [Testing Guide](./docs/TESTING.md)

### External Links
- [Raydium SDK](https://github.com/raydium-io/raydium-sdk-V2-demo)
- [Meteora Docs](https://docs.meteora.ag/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [BullMQ Documentation](https://docs.bullmq.io/)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Kunal Raj**
- GitHub: [@KunalRaj9835](https://github.com/KunalRaj9835)
- Email: kunalraj3374@gmail.com
- Repository: [Order_Execution_Engine](https://github.com/KunalRaj9835/Order_Execution_Engine)

---

## 🙏 Acknowledgments

- Solana Foundation for devnet infrastructure
- Raydium and Meteora for DEX SDKs
- Anthropic for technical assessment framework

---
