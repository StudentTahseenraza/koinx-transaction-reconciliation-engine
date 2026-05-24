<div align="center">

# 🚀 Transaction Reconciliation Engine

### *Enterprise-Grade Crypto Transaction Matching System*

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-orange.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-brightgreen.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

**A powerful backend service that reconciles crypto transactions between user-exported and exchange-exported CSV files with intelligent matching algorithms.**

[Features](#features) • [Quick Start](#quick-start) • [API Documentation](#api-documentation) • [Architecture](#architecture) • [Testing](#testing)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Matching Algorithm](#matching-algorithm)
- [Testing](#testing)
- [Error Handling](#error-handling)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

The **Transaction Reconciliation Engine** solves a critical problem in crypto finance: matching transactions from two different sources (user exports and exchange exports) that represent the same activity but rarely match perfectly.

### The Problem We Solve

- ❌ Different transaction IDs across systems
- ❌ Timestamp drift (seconds to minutes apart)
- ❌ Asset name variations (`BTC` vs `Bitcoin` vs `bitcoin`)
- ❌ Type perspective differences (`TRANSFER_IN` vs `TRANSFER_OUT`)
- ❌ Data quality issues (missing fields, invalid formats)
- ❌ Duplicate records

### Our Solution

✅ Intelligent matching algorithm with configurable tolerances  
✅ Smart normalization of assets and transaction types  
✅ Comprehensive reconciliation reports  
✅ Production-ready REST API  
✅ Swagger UI documentation  

---

## ✨ Features

| Feature | Description | Status |
|---------|-------------|--------|
| 📁 **CSV Ingestion** | Parse and validate CSV files with error tracking | ✅ |
| 🔄 **Smart Matching** | Algorithm-based matching with configurable tolerances | ✅ |
| 📊 **Reconciliation Reports** | Detailed reports with match statistics | ✅ |
| 🎯 **Conflict Detection** | Identify transactions with discrepancies | ✅ |
| 📈 **Statistics Dashboard** | Comprehensive analytics and insights | ✅ |
| 💾 **CSV Export** | Export reconciliation results as CSV | ✅ |
| 🚀 **REST API** | Full RESTful API with Swagger documentation | ✅ |
| 🔐 **Validation** | Data quality validation with error logging | ✅ |
| ⚡ **Async Processing** | Non-blocking reconciliation for large datasets | ✅ |
| 📝 **Audit Trail** | Complete audit log for every transaction | ✅ |

---

</div> ```

# 🛠 Development Tools

```yaml
Package Manager: npm
Process Manager: Nodemon
Type Checking: TypeScript
Linting: ESLint
Formatting: Prettier
API Documentation: Swagger UI
```

# 🚀 Quick Start

## Prerequisites

```bash
Node.js >= 18.0.0
MongoDB >= 6.0
npm >= 9.0.0
```

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/reconciliation-engine.git

# Navigate to project directory
cd reconciliation-engine

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start MongoDB (local installation)
mongod

# Seed sample data (optional)
npm run seed

# Start development server
npm run dev
```

# ⚙️ Environment Configuration

Create a `.env` file:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
MONGODB_URI=mongodb://localhost:27017/reconciliation_engine

# Matching Tolerances
TIMESTAMP_TOLERANCE_SECONDS=300
QUANTITY_TOLERANCE_PCT=0.01

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE_MB=10
```

# ▶️ Running the Application

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

# 📚 API Documentation

## Base URL

```text
http://localhost:3000
```

## Interactive API Docs (Swagger)

```text
http://localhost:3000/api-docs
```

# 📦 Useful Commands

```bash
# Check lint issues
npm run lint

# Format code
npm run format

# Type checking
npm run typecheck

# Clean build
npm run clean
```

# 📌 API Endpoints

## 🔄 Reconciliation Endpoints

| Method | Endpoint | Description | Request Body / Params |
|---------|----------|-------------|-----------------------|
| POST | `/api/reconcile` | Trigger reconciliation process | `{ timestampToleranceSeconds, quantityTolerancePct }` |
| GET | `/api/reconcile/runs` | Get all reconciliation runs | Query: `limit`, `offset` |

---

## 📊 Report Endpoints

| Method | Endpoint | Description | Parameters |
|---------|----------|-------------|------------|
| GET | `/api/report/{runId}/summary` | Get reconciliation summary | `runId (path)` |
| GET | `/api/report/{runId}` | Get full reconciliation report | `runId (path)`, `category (query)` |
| GET | `/api/report/{runId}/statistics` | Get reconciliation statistics | `runId (path)` |
| GET | `/api/report/{runId}/unmatched` | Get unmatched transactions | `runId (path)` |
| GET | `/api/report/{runId}/export/{format}` | Export report as JSON or CSV | `runId`, `format (path)` |
| GET | `/api/report/{runId}/detailed` | Get detailed report with filters | `runId`, filters `(query)` |
| GET | `/api/report/{runId}/audit/{txId}` | Get audit trail for transaction | `runId`, `transactionId` |
| GET | `/api/report/compare/{id1}/{id2}` | Compare two reconciliation runs | `runId1`, `runId2` |

---

## 📁 Ingestion Endpoints

| Method | Endpoint | Description | Request Body |
|---------|----------|-------------|--------------|
| POST | `/api/ingestion/upload` | Upload user and exchange CSV files | `userCsv`, `exchangeCsv` *(multipart/form-data)* |
| GET | `/api/ingestion/status/{runId}` | Get ingestion status | `runId (path)` |

---

## 📈 Dashboard Endpoint

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/dashboard` | Get dashboard analytics |

---

## 🔁 Example API Flow

```text
1. POST /api/ingestion/upload
              ↓
2. POST /api/reconcile
              ↓
3. GET /api/report/{runId}/summary
              ↓
4. GET /api/report/{runId}/statistics
              ↓
5. GET /api/report/{runId}/export/csv
```


# 📊 Database Schema

## ReconciliationRun Collection

```javascript
{
  runId: String,                    // Unique run identifier

  status: String,                   // PENDING / RUNNING / COMPLETED / FAILED

  config: {
    timestampToleranceSeconds: Number,
    quantityTolerancePct: Number
  },

  stats: {
    totalUserTx: Number,
    totalExchangeTx: Number,

    validUserTx: Number,
    validExchangeTx: Number,

    matched: Number,
    conflicting: Number,

    unmatchedUser: Number,
    unmatchedExchange: Number
  },

  startedAt: Date,

  completedAt: Date,

  error: String
}
```

---

## Transaction Collection

```javascript
{
  source: String,                   // USER / EXCHANGE

  sourceId: String,                 // Original transaction ID

  runId: ObjectId,

  timestamp: Date,

  rawTimestamp: String,

  type: String,

  asset: String,

  quantity: Number,

  priceUsd: Number,

  fee: Number,

  normalizedAsset: String,

  normalizedType: String,

  isValid: Boolean,

  validationErrors: [String],

  rawData: Object
}
```

---

## ReconciliationResult Collection

```javascript
{
  runId: ObjectId,

  category: String,
  // MATCHED
  // CONFLICTING
  // UNMATCHED_USER
  // UNMATCHED_EXCHANGE

  reason: String,

  userTx: ObjectId,

  exchangeTx: ObjectId,

  matchScore: Number,

  differences: {

    timestampDiffSec: Number,

    quantityDiffPct: Number,

    priceDiffPct: Number,

    feeDiffPct: Number
  }
}
```

---

# 🧮 Matching Algorithm

## Scoring System

| Factor | Weight | Description |
|--------|--------|-------------|
| Asset Match | 40% | Same cryptocurrency |
| Type Match | 30% | BUY / SELL / TRANSFER |
| Timestamp | 20% | Time difference within tolerance |
| Quantity | 10% | Amount difference within tolerance |

---

## Match Categories

| Score Range | Category | Description |
|------------|----------|-------------|
| 95–100 | MATCHED | Perfect or near-perfect match |
| 70–94 | CONFLICTING | Close match with discrepancies |
| <70 | UNMATCHED | No suitable match found |

---

# 🔄 Normalization Rules

## Asset Mapping

```javascript
'bitcoin'   → 'BTC'
'Bitcoin'   → 'BTC'
'btc'       → 'BTC'

'ethereum'  → 'ETH'

'solana'    → 'SOL'
```

---

## Type Mapping

```javascript
'BUY' → 'BUY'

'SELL' → 'SELL'

'TRANSFER_OUT'
→
'TRANSFER_IN'

'TRANSFER_IN'
→
'TRANSFER_IN'
```

---

# 🧪 Testing

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Test Coverage Goals

| Component | Coverage Target |
|-----------|----------------|
| Services | 90% |
| Controllers | 85% |
| Models | 80% |
| Utils | 95% |

---

## Sample Test Output

```text
Test Suites: 12 passed, 12 total

Tests:       45 passed, 45 total

Snapshots:   0 total

Time:        8.234 s

Coverage:    92.5%
```

---

# 🚨 Error Handling

## Error Types

| Error Type | HTTP Status | Description |
|-----------|-------------|-------------|
| ValidationError | 400 | Invalid input data |
| NotFoundError | 404 | Resource not found |
| ConflictError | 409 | Duplicate entry |
| InternalServerError | 500 | Server error |

---

## Error Response Format

```json
{
  "status": "fail",
  "message": "Validation Error",
  "errors": [
    "timestamp is invalid",
    "quantity cannot be negative"
  ]
}
```

---

# 📋 Logging Levels

```text
ERROR → System failures, database errors

WARN → Data quality issues, validation warnings

INFO → Normal operations, reconciliation progress

DEBUG → Detailed matching information
```
