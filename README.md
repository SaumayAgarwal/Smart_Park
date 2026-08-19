# 🚗 SmartPark — Smart Urban Parking Platform

<div align="center">

![SmartPark Banner](https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80)

**A full-stack, production-ready event-driven parking management platform**  
built with Node.js · Express · Prisma · React 19 · MySQL · Redis · Apache Kafka · Socket.IO · Docker

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-black?style=flat-square&logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-blue?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black?style=flat-square&logo=socketdotio)](https://socket.io/)
[![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-KRaft-black?style=flat-square&logo=apachekafka)](https://kafka.apache.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-red?style=flat-square&logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

</div>

---

## 📖 Overview

**SmartPark** connects **space owners** who want to monetise unused parking spots with **drivers** looking for hassle-free urban parking. The platform handles everything end-to-end — spot discovery via interactive maps, real-time availability calendars, concurrency-safe booking, Razorpay & wallet split payments, QR pass entry/exit verification, and event-driven notifications (Socket.IO, SMS, and HTML Emails).

---

## ✨ Key Features

### 🔐 Authentication & Verification
- **Stateless JWT Auth**: Token-based authentication with role guards (`DRIVER`, `OWNER`, `ADMIN`).
- **OTP Account Verification**: 6-digit verification code sent via Nodemailer (Gmail SMTP) & SMS.
- **Bcrypt Password Security**: Hashed credentials stored safely in MySQL.

### 🅿️ Parking Spot Management (Owner)
- **Spot Management**: Add, edit, or toggle spot availability with amenities (Covered, Security, EV Charging).
- **Interactive Geocoding**: Set precise coordinates with OpenStreetMap & Nominatim search autocomplete.
- **Real-Time Booking Feed**: Live Socket.IO alerts when a driver books your space.

### 📅 Booking & Concurrency Guard (Driver)
- **Time-Slot Availability Calendar**: Real-time checking of reserved slots to prevent range overlaps.
- **Spot-Level Redis Lock (`lock:spot:{id}`)**: Token-based distributed lock preventing race conditions during checkout.
- **Timezone Accurate**: IST (`Asia/Kolkata`) local date handling across client and server.

### 💳 Split Payments & Wallet
- **SmartPark Wallet**: Automated credits on booking cancellations or penalty compensations.
- **Razorpay Integration**: Native order creation and HMAC-SHA256 signature verification for UPI & Card payments.
- **Split Checkout**: Pay partially using wallet balance, with remaining amount seamlessly charged via Razorpay.

### ⚡ Event-Driven Architecture (Apache Kafka)
- **Decoupled Pipeline**: Asynchronous message bus for processing heavy post-booking tasks.
- **Topics**: `smartpark.booking.events` and `smartpark.payment.events`.
- **Consumer Group**: `smartpark-notification-group` handles async HTML receipt generation, SMS alerts, and Socket.IO pushes without blocking HTTP response loops (<50ms API latency).

### ↩️ Cancellation & Refund Policy

| Cancellation Timing | Driver Refund | Owner Compensation |
|---|---|---|
| > 2 hours before start | **100%** to wallet | ₹0 |
| < 2 hours before start | **50%** to wallet | **50%** penalty credited to owner wallet |
| After start time | ₹0 | **100%** credited to owner wallet |

### 📱 QR Verification & Check-in
- **Secure Encrypted Pass**: Unique QR token generated upon booking confirmation.
- **In-App Scanner**: Owner scans driver QR pass via camera scanner for check-in validation.

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js v20 (Alpine)
- **Framework**: Express.js
- **ORM & DB Access**: Prisma ORM
- **Database**: MySQL 8.0
- **Cache & Distributed Locking**: Redis 7.2 (`ioredis`)
- **Event Streaming Broker**: Apache Kafka (KRaft mode, `kafkajs`)
- **Real-Time Engine**: Socket.IO 4.x
- **Mail & SMS**: Nodemailer (Gmail SMTP) & Fast2SMS / Twilio SDK
- **Payments**: Razorpay Node.js SDK

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Real-Time Client**: Socket.IO Client 4.x
- **Interactive Maps**: Leaflet & React-Leaflet
- **Icons & UI**: Lucide React & Custom Design System

### Infrastructure
- **Orchestration**: Docker Compose
- **Web Server & Reverse Proxy**: Nginx 1.27 (Alpine)

---

## 🏗️ System Architecture

```text
                     ┌──────────────────────────────┐
                     │    Browser (React 19 + Vite)  │
                     │       Port 3000 (Nginx)       │
                     └──────────────┬───────────────┘
                                    │ HTTP / WebSocket (/socket.io/)
                     ┌──────────────▼───────────────┐
                     │         Nginx Reverse Proxy  │
                     │  /api/*       → backend:8080 │
                     │  /socket.io/* → backend:8080 │
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │    Node.js + Express API     │
                     │         Port 8080            │
                     └──────┬──────────┬────────────┘
                            │          │
            ┌───────────────▼──┐  ┌───▼──────────────┐
            │   MySQL 8.0      │  │    Redis 7.2       │
            │  (Prisma ORM)    │  │  Spot-Level      │
            │   Port 3307      │  │  Distributed Lock│
            └──────────────────┘  └──────────────────┘
                                         │
                     ┌───────────────────▼──────────┐
                     │    Apache Kafka (KRaft)       │
                     │  Topic: smartpark.booking    │
                     │  Async Email / SMS Pipeline  │
                     └──────────────────────────────┘
```

---

## 🚀 Quick Start with Docker

### 1. Clone the Repository
```bash
git clone https://github.com/Neeteshsingh660/SmartPark.git
cd SmartPark
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Database
DATABASE_URL="mysql://root:Neetesh@2005@mysql:3306/smartpark_db"

# Redis & Kafka
REDIS_HOST="redis"
REDIS_PORT=6379
KAFKA_BROKER="kafka:9092"

# Security
JWT_SECRET="your_custom_jwt_secret_key"

# Nodemailer (Gmail SMTP — App Password)
MAIL_USERNAME="your_email@gmail.com"
MAIL_PASSWORD="your_gmail_app_password"

# Razorpay
RAZORPAY_KEY_ID="rzp_test_xxxxxx"
RAZORPAY_KEY_SECRET="xxxxxx"

# SMS Gateway (Fast2SMS)
FAST2SMS_API_KEY="your_fast2sms_api_key"
```

### 3. Build & Launch the Application
```bash
docker-compose up --build -d
```

This starts 5 containers:
| Container Name | Service | Access Port |
|---|---|---|
| `smartpark-mysql` | MySQL 8.0 Database | `3307` |
| `smartpark-redis` | Redis Cache & Distributed Lock | `6379` |
| `smartpark-kafka` | Apache Kafka Broker | `9092` |
| `smartpark-backend` | Node.js Express API & Socket.IO | `8080` |
| `smartpark-frontend` | React UI + Nginx Reverse Proxy | **`3000`** |

### 4. Access the Application
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📂 Project Structure

```text
SmartPark/
├── backend/                      # Node.js + Express + Prisma API
│   ├── prisma/
│   │   └── schema.prisma         # MySQL database schema definition
│   ├── src/
│   │   ├── config/               # DB, Redis, Kafka, Mailer, Razorpay, Seed
│   │   ├── controllers/          # Auth, Booking, Payment, Parking, Admin
│   │   ├── kafka/                # Producer & Consumer event pipeline
│   │   ├── middleware/           # Auth JWT middleware & Role guards
│   │   ├── routes/               # Express API endpoints
│   │   ├── services/             # LockService, OtpService, EmailService, SmsService
│   │   ├── socket/               # Socket.IO event handler & room manager
│   │   └── server.js             # HTTP server entrypoint
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                     # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/           # Auth, Driver, Owner, Admin, Landing, Common
│   │   ├── context/              # AuthContext, ToastContext
│   │   ├── services/             # API client & WebSocket service
│   │   └── main.jsx
│   ├── nginx.conf                # Nginx proxy & SPA fallback configuration
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml            # Multi-container service orchestrator
├── .gitignore
└── README.md
```

---

## 🛡️ Security & Best Practices
- **No Hardcoded Secrets**: All keys, passwords, and tokens are read dynamically from environment variables.
- **Race Condition Prevention**: Redis spot-level locking guarantees single booking checkout evaluation.
- **Atomic Financial Transactions**: Wallet operations & payment verifications run within database transactions.
- **Non-Blocking Architecture**: Background tasks (SMS & Email) are dispatched asynchronously through Kafka event queues.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
