# 🚀 Order Execution Engine

A high-performance DEX order execution engine built with TypeScript that routes trades between Raydium and Meteora, provides real-time WebSocket updates, and maintains complete audit trails in a database.

## 📋 Table of Contents

- [Order Type Choice](#-order-type-choice-market-orders)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [API Documentation](#-api-documentation)
- [WebSocket Protocol](#-websocket-protocol)
- [Database Schema](#-database-schema)
- [Testing](#-testing)
- [Deployment](#-deployment)

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
```typescript
// In order.worker.ts - before routing
if (orderType === 'limit' && bestPrice > targetPrice) {
  await orderQueue.add('execute', job.data, { delay: 5000 });
  return { status: 'waiting_for_price' };
}
```

#### Sniper Orders
- **Implementation**: Add pre-execution conditions (e.g., token mint creation, pool initialization, liquidity threshold). Trigger execution when on-chain events are detected.
- **Extension Point**: Add event listeners for token launches, then use existing routing and execution pipeline.
```typescript
// Add to worker
const isNewToken = await detectTokenLaunch(tokenAddress);
if (isNewToken) {
  // Execute immediately with high priority
  await executeWithMaxPriority(order);
}
```

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

**Status Descriptions:**
1. **pending** - Order received and queued
2. **routing** - Comparing DEX prices (Raydium vs Meteora)
3. **building** - Creating transaction with chosen DEX
4. **submitted** - Transaction sent to network
5. **confirmed** - Transaction successful (includes txHash)
6. **failed** - Error occurred at any step (includes error message)

### Component Breakdown

| Component | Purpose | Technology |
|-----------|---------|------------|
| **API Layer** | HTTP endpoints, request validation | Fastify |
| **WebSocket Manager** | Real-time client connections | @fastify/websocket |
| **Order Queue** | Job queuing and concurrency control | BullMQ + Redis |
| **Worker** | Order processing and execution | BullMQ Worker |
| **DEX Router** | Price comparison and routing logic | Custom TypeScript |
| **Database** | Persistent storage and audit trail | Supabase (PostgreSQL) |

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Web Framework**: Fastify (WebSocket support built-in)
- **Queue**: BullMQ + Redis
- **Database**: Supabase (PostgreSQL)
- **Real-time**: WebSocket
- **DEX Integration**: Mock implementation (easily replaceable with Raydium/Meteora SDKs)

---

## 📦 Installation

### Prerequisites

- Node.js 20+
- Redis server
- Supabase account

### Setup Steps

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd order-execution-engine
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
PORT=3000
```

4. **Create database tables**

Run this SQL in your Supabase SQL Editor:

```sql
-- Orders table
create table orders (
  id uuid primary key,
  token_name text not null,
  amount numeric not null,
  raydium_price numeric,
  meteora_price numeric,
  chosen_dex text,
  execution_price numeric,
  status text not null,
  created_at timestamp with time zone default now()
);

-- Transactions table
create table transactions (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id),
  dex_used text not null,
  execution_price numeric not null,
  tx_hash text not null,
  created_at timestamp with time zone default now()
);

-- Order events table
create table order_events (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id),
  event text not null,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Indexes for performance
create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at desc);
create index idx_transactions_order_id on transactions(order_id);
create index idx_order_events_order_id on order_events(order_id);
```

5. **Start Redis**
```bash
redis-server
```

6. **Run the application**
```bash
npm run dev
```

You should see:
```
🚀 Worker started and listening for jobs...
🚀 Order Execution Engine Started!
📡 Server running on http://0.0.0.0:3000
💾 Database: Connected to Supabase
🔴 Redis: Connected
👷 Worker: Initialized and ready
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Submit Order
Execute a market order.

**Endpoint**: `POST /api/orders/execute`

**Request Body**:
```json
{
  "tokenName": "SOL/USDC",
  "amount": 1000
}
```

**Response**:
```json
{
  "orderId": "210264cc-6351-4ce4-b631-0bcf0143cb6c",
  "tokenName": "SOL/USDC",
  "amount": 1000,
  "message": "Order queued successfully",
  "websocketUrl": "/api/orders/ws?orderId=210264cc-6351-4ce4-b631-0bcf0143cb6c"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"tokenName": "SOL/USDC", "amount": 1000}'
```

---

#### 2. Get Order Details
Retrieve complete order information including events and transactions.

**Endpoint**: `GET /api/orders/:orderId`

**Response**:
```json
{
  "order": {
    "id": "210264cc-6351-4ce4-b631-0bcf0143cb6c",
    "token_name": "RAY/USDC",
    "amount": 1,
    "raydium_price": 98.8422,
    "meteora_price": 101.0640,
    "chosen_dex": "Raydium",
    "execution_price": 99.1387,
    "status": "confirmed",
    "created_at": "2025-12-14T13:53:51.000Z"
  },
  "events": [
    {
      "id": "evt_123",
      "order_id": "210264cc-6351-4ce4-b631-0bcf0143cb6c",
      "event": "pending",
      "metadata": { "message": "Order created and queued" },
      "created_at": "2025-12-14T13:53:51.000Z"
    },
    {
      "event": "routing",
      "metadata": {
        "raydium_price": 98.8422,
        "meteora_price": 101.0640,
        "chosen_dex": "Raydium"
      }
    },
    {
      "event": "confirmed",
      "metadata": {
        "tx_hash": "tx_h0kpxwh8jj",
        "execution_price": 99.1387
      }
    }
  ],
  "transactions": [
    {
      "id": "tx_123",
      "order_id": "210264cc-6351-4ce4-b631-0bcf0143cb6c",
      "dex_used": "Raydium",
      "execution_price": 99.1387,
      "tx_hash": "tx_h0kpxwh8jj",
      "created_at": "2025-12-14T13:53:55.000Z"
    }
  ]
}
```

---

#### 3. Get All Orders
List all orders with pagination.

**Endpoint**: `GET /api/orders?page=1&limit=10`

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response**:
```json
{
  "orders": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

#### 4. Get Order Events
Retrieve event timeline for a specific order.

**Endpoint**: `GET /api/orders/:orderId/events`

**Response**:
```json
{
  "orderId": "210264cc-6351-4ce4-b631-0bcf0143cb6c",
  "events": [...]
}
```

---

#### 5. Health Check
Check if the service is running.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-14T13:53:48.000Z",
  "service": "order-execution-engine"
}
```

---

## 🔌 WebSocket Protocol

### Connection
```
ws://localhost:3000/api/orders/ws?orderId={orderId}
```

### Message Format

All messages are JSON objects with a `status` field.

#### Status Updates

**1. Pending**
```json
{
  "status": "pending",
  "orderId": "210264cc-6351-4ce4-b631-0bcf0143cb6c",
  "tokenName": "RAY/USDC",
  "amount": 1
}
```

**2. Routing**
```json
{
  "status": "routing"
}
```

**3. Building**
```json
{
  "status": "building",
  "dex": "Raydium",
  "raydiumPrice": 98.8422,
  "meteoraPrice": 101.0640,
  "chosenPrice": 98.8422,
  "priceDifference": 2.2218,
  "priceDifferencePercent": 2.25
}
```

**4. Submitted**
```json
{
  "status": "submitted"
}
```

**5. Confirmed**
```json
{
  "status": "confirmed",
  "txHash": "tx_h0kpxwh8jj",
  "executionPrice": 99.1387,
  "dex": "Raydium"
}
```

**6. Failed**
```json
{
  "status": "failed",
  "error": "Insufficient liquidity"
}
```

### Example using `wscat`

```bash
npm install -g wscat

# Connect
wscat -c "ws://localhost:3000/api/orders/ws?orderId=YOUR_ORDER_ID"

# You'll receive real-time updates as the order progresses
```

---

## 💾 Database Schema

### Orders Table
Stores order details and execution results.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (order ID) |
| token_name | text | Trading pair (e.g., "SOL/USDC") |
| amount | numeric | Order amount |
| raydium_price | numeric | Quote from Raydium |
| meteora_price | numeric | Quote from Meteora |
| chosen_dex | text | Selected DEX (Raydium/Meteora) |
| execution_price | numeric | Final execution price |
| status | text | Order status |
| created_at | timestamptz | Order creation time |

### Transactions Table
Records completed transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| order_id | uuid | Foreign key to orders |
| dex_used | text | DEX used for execution |
| execution_price | numeric | Execution price |
| tx_hash | text | Transaction hash |
| created_at | timestamptz | Transaction time |

### Order Events Table
Complete audit trail of order lifecycle.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| order_id | uuid | Foreign key to orders |
| event | text | Event type (pending, routing, etc.) |
| metadata | jsonb | Additional event data |
| created_at | timestamptz | Event timestamp |

---

## 🧪 Testing

### Manual Testing

**Test 1: Single Order**
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"tokenName": "SOL/USDC", "amount": 1000}'
```

**Test 2: Multiple Concurrent Orders**
```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/orders/execute \
    -H "Content-Type: application/json" \
    -d '{"tokenName": "BONK/SOL", "amount": 100}' &
done
wait
```

**Test 3: WebSocket Connection**
```bash
npm install -g wscat
wscat -c "ws://localhost:3000/api/orders/ws?orderId=YOUR_ORDER_ID"
```

### Expected Console Output

```
📥 New order received:
   Order ID: 210264cc-6351-4ce4-b631-0bcf0143cb6c
   Token: RAY/USDC
   Amount: 1

🔄 Processing order 210264cc-6351-4ce4-b631-0bcf0143cb6c for RAY/USDC
📡 Routing order 210264cc-6351-4ce4-b631-0bcf0143cb6c...
🔍 Routing order for RAY/USDC (1 tokens)...
📊 Raydium quote for RAY/USDC: $98.8422
📊 Meteora quote for RAY/USDC: $101.0640
💰 Best execution: Raydium at 99.1387 (after 0.30% fee)
📊 Raydium effective: 99.1387 | Meteora effective: 101.2661
📈 Price difference: 2.25% - Savings: 2.1274
🔨 Building transaction for order 210264cc-6351-4ce4-b631-0bcf0143cb6c on Raydium...
📤 Submitting transaction for order 210264cc-6351-4ce4-b631-0bcf0143cb6c...
✅ Order 210264cc-6351-4ce4-b631-0bcf0143cb6c confirmed!
   Token: RAY/USDC
   DEX: Raydium
   Price: $99.1387
   TX: tx_h0kpxwh8jj
```

### Unit Tests (TODO)

```bash
npm test
```

Tests should cover:
- ✅ DEX routing logic (price comparison)
- ✅ Queue behavior (concurrency, retry)
- ✅ WebSocket lifecycle (connection, updates, disconnection)
- ✅ Error handling (failed orders, network errors)
- ✅ Database operations (create, update, query)

---

## 🚀 Deployment

### Environment Setup

Ensure these environment variables are set:

```env
SUPABASE_URL=your-production-url
SUPABASE_SECRET_KEY=your-production-key
REDIS_URL=your-redis-url
PORT=3000
NODE_ENV=production
```

### Build

```bash
npm run build
npm start
```

### Deployment Platforms

**Recommended**: Railway, Render, or Fly.io (all offer free tiers)

**Requirements**:
- Node.js 20+
- Redis instance
- Publicly accessible endpoint

---

