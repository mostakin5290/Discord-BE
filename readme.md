# 🔙 Discord Clone - Backend Server

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Kafka](https://img.shields.io/badge/Apache%20Kafka-000?style=for-the-badge&logo=apachekafka)

> The powerful REST API and WebSocket server powering the Discord Clone.

---

## 🏗️ Architecture & Services

The backend is built as a **Modular Monolith** using Express.js, with distinct service layers for scalability.

### Core Modules
| Module | Description | Key Tech |
| :--- | :--- | :--- |
| **Auth** | User authentication, Session management, Role-based Access Control. | JWT, Passport, Bcrypt |
| **Messaging** | Real-time chat, Direct Messages, Channel Messages. | Socket.io, Kafka, Redis |
| **Media** | Voice/Video token generation, Webhooks. | LiveKit SDK |
| **Social** | Friend requests, Online status, Notifications. | Redis (Pub/Sub) |
| **AI** | Conversation summaries, Smart discovery. | Gemini API, Pinecone |

### System Diagram
```mermaid
graph TD
    subgraph API_Gateway ["🛡️ API Gateway"]
        API[Express REST API]
        Auth[JWT Auth]
        WS[WebSocket Server]
    end

    subgraph Services ["⚙️ Micro-Services"]
        Auth_Svc[Auth Service]
        Msg_Svc[Messaging Service]
        AI_Svc[AI Service]
        Media_Svc[Media Service]
    end

    subgraph Async ["⚡ Async Layer"]
        Kafka{Apache Kafka}
        Redis_Pub((Redis Pub/Sub))
        Workers[Job Consumers]
    end

    subgraph Data ["💾 Persistence"]
        DB[(PostgreSQL)]
        Cache[(Redis Cache)]
        Vector[(Pinecone)]
    end

    API --> Auth_Svc
    API --> Msg_Svc
    WS <--> Redis_Pub
    WS --> Kafka

    Msg_Svc --> Kafka
    Kafka -.-> Workers
    Workers --> DB
    Workers --> Cache

    AI_Svc --> Vector
    AI_Svc --> DB
```


---

## 🛠️ Setup & Installation

### 1. Prerequisites
- Node.js v18+
- PostgreSQL
- Redis
- Kafka (or Aiven)

### 2. Installation
```bash
# Navigate to backend
cd Discord-BE

# Install dependencies
npm install
# or
yarn install
```

### 3. Configuration
Create a `.env` file in the root directory:

```env
PORT=3000
DATABASE_URL="postgresql://user:pass@localhost:5432/discord"
REDIS_URL="redis://localhost:6379"
KAFKA_BROKER="localhost:9092"
JWT_SECRET="your-super-secret"
LIVEKIT_API_KEY="..."
LIVEKIT_API_SECRET="..."
GENAI_API_KEY="..."
```

### 4. Database Setup
```bash
# Generate Prisma Client
npx prisma generate

# Push Schema to DB
npx prisma db push
```

### 5. Running the Server
```bash
# Development Mode (with Hot Reload)
npm run dev

# Production Build
npm run build
npm start
```

---

## 📡 API Overview

### Authentication
- `POST /api/v1/auth/register` - Create new account
- `POST /api/v1/auth/login` - Login

### Servers & Channels
- `POST /api/v1/server/create` - Create a new server
- `POST /api/v1/server/:serverId/channels` - Create a channel

### Messages
- `POST /api/v1/messages/send` - Send a message (HTTP fallback)
- `GET /api/v1/messages/:channelId` - Get chat history

> *Note: Most real-time messaging happens via Socket.io events.*

---

## 🧪 Key Directories

- `src/controllers`: Request handlers.
- `src/services`: Business logic (Kafka producers, AI logic).
- `src/routes`: API route definitions.
- `src/config`: Configuration for DB, Redis, etc.
- `src/prisma`: Database schema.
