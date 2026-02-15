# 🔙 Discord Clone - Backend Server

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Kafka](https://img.shields.io/badge/Apache%20Kafka-000?style=for-the-badge&logo=apachekafka)

> The powerful REST API and WebSocket server powering the Discord Clone.

---

## 🛠️ Complete Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Core** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL (Prisma ORM), Redis (ioredis), Pinecone (Vector DB) |
| **Real-time** | Socket.io, Apache Kafka (KafkaJS) |
| **Authentication** | JWT, Passport.js (Google, GitHub, Facebook), Bcrypt |
| **Media & Storage** | LiveKit (WebRTC), Cloudinary, UploadThing, Multer |
| **AI & ML** | Google Gemini (GenAI), Pinecone SDK |
| **Utilities** | Zod (Validation), Nodemailer (Email), Nanoid |

---

## 🌟 Comprehensive Features

### 🔐 Authentication & Security
-   **Multi-Provider Auth**: Login with Email/Password, Google, GitHub, or Facebook.
-   **Session Management**: JWT-based stateless authentication with secure HTTP-only cookies.
-   **Password Recovery**: OTP-based email verification using Nodemailer.

### 💬 Advanced Messaging
-   **Event-Driven Architecture**: Messages are produced to **Kafka** topics and consumed by worker services to ensure high throughput.
-   **Socket + Redis**: Real-time delivery using Socket.io, with Redis Pub/Sub syncing state across multiple server instances.
-   **Rich Media**: Support for image/file uploads via Cloudinary and UploadThing.

### 🎮 Servers & Community
-   **Role-Based Access Control (RBAC)**: granular permissions for server optimization.
-   **Channel Management**: Create Text and Voice channels, organize into Categories.
-   **Invite System**: Generate unique invite links with expiration logic.

### 📹 Voice & Video (LiveKit)
-   **SFU Architecture**: Scalable generic conferencing using LiveKit.
-   **Features**: Screen sharing, noise cancellation, and selective subscription.

### 🧠 AI Integration (Gemini)
-   **Chat Summaries**: AI generates concise summaries of missed conversations.
-   **Smart Discovery**: Vector-based search using Pinecone to find relevant communities/messages.

---

## 🏗️ Architecture Deep Dive

The backend employs a **Modular Monolith** pattern where distinct domains (Auth, Chat, Social) live in the same codebase but interact via event buses.

### Data Flow for Chat
1.  **Ingestion**: User sends message -> Socket Server -> **Kafka Producer**.
2.  **Processing**: **Kafka Consumer** reads message -> Validates -> saves to **PostgreSQL**.
3.  **Delivery**: Consumer publishes to **Redis Pub/Sub** -> All Socket Servers receive event -> Deliver to connected clients.


### System Diagram
![System Architecture](./assets/architecture_diagram.svg)

### 🔗 Feature Workflows

#### 1. Authentication Flow
![Auth Flow](./assets/auth_flow.svg)

#### 2. Messaging Pipeline (Socket -> Kafka -> Redis)
![Message Flow](./assets/message_flow.svg)

#### 3. Voice & Video (LiveKit)
![Media Flow](./assets/media_flow.svg)

#### 4. AI & Vector Search
![AI Flow](./assets/ai_flow.svg)


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
