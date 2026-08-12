# 🚗 SmartPark - Smart Parking Marketplace

SmartPark is a production-grade, full-stack marketplace application that connects parking spot owners with drivers looking for parking. Built with a highly scalable, event-driven microservice architecture, it handles real-time geospatial searches, distributed booking locks, and encrypted QR-code-based check-ins.

## ✨ Key Features

* **Role-Based Access Control (RBAC):** Secure JWT authentication for `DRIVER`, `OWNER`, and `ADMIN` roles.
* **OTP Email Verification:** Redis-backed one-time passwords for secure user onboarding via Spring Mail.
* **Geospatial Search:** Uses the Haversine formula to find nearby parking spots based on the driver's GPS coordinates and dynamic filters (price, EV charging, covered parking).
* **Distributed Locking:** Utilizes **Redis** locks to prevent race conditions and double-booking during high-traffic checkout flows.
* **Real-Time Notifications:** Event-driven architecture using **Apache Kafka** and **WebSockets (STOMP)** to push live booking confirmations to the frontend.
* **Cryptographic QR Check-in:** Generates secure HMAC SHA-256 encrypted QR tokens for seamless check-in/check-out scanning by parking owners.
* **Admin Analytics:** Aggregated financial and user metrics via optimized SQL queries.
* **Fully Containerized:** One-click deployment using Docker & Docker Compose.

## 🛠️ Tech Stack

### Backend
* **Framework:** Java 21, Spring Boot 3
* **Database:** MySQL 8.0 (Spring Data JPA / Hibernate)
* **Caching & Distributed Locks:** Redis
* **Message Broker / Event Streaming:** Apache Kafka (Official Apache Image)
* **Security:** Spring Security, JWT (JSON Web Tokens), HMAC Encryption
* **Real-time:** Spring WebSockets, STOMP protocol

### Frontend (React)
* **Framework:** React.js (Vite)
* **Styling:** Tailwind CSS
* **Maps:** Leaflet & React-Leaflet
* **State Management & Routing:** React Router, Context API
* **QR Tech:** `qrcode.react`, `react-qr-reader`

### Infrastructure
* **Containerization:** Docker, Docker Compose (Multi-stage builds)

## 🚀 Getting Started

### Prerequisites
You only need one thing installed on your machine to run the entire backend infrastructure:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Running the Application

1. **Clone the repository**
   ```bash
   git clone [git@github.com:Neeteshsingh660/SmartPark.git]
   cd smartpark



Start the Infrastructure (MySQL, Redis, Kafka, & Spring Boot) Run the following command in the root directory:

Bash

docker compose up -d --build



Check the logs to ensure successful startup

Bash

docker compose logs -f backend


Access the API The backend is now running at: http://localhost:8080
📖 API Documentation Overview

The API is structured around 4 main domains:

/api/auth/** - Public endpoints for OTP generation, Registration, and Login.
/api/parking/** - Public endpoints for geospatial searches (/nearby) and spot details.
/api/owner/** - Protected endpoints for Owners to manage spots and scan QR codes.
/api/bookings/** & /api/payments/** - Protected endpoints for Drivers to lock spots, process payments, and retrieve QR codes.

(Note: Import the provided Postman Collection in the /docs folder for detailed request/response payloads).

🏗️ System Architecture Highlights
Statelessness: The backend is entirely stateless. Sessions are managed via JWTs, allowing horizontal scaling.
Concurrency Handling: When a driver initiates a booking, Redis locks the spot for a specific time window, ensuring no other driver can book the exact same timeframe until payment succeeds or times out.
Asynchronous Processing: Upon payment success, a Kafka event is produced. A separate consumer listens to this event to trigger email receipts and WebSocket notifications, preventing the main HTTP thread from blocking.
📄 License

This project is licensed under the MIT License.


***

### 💡 A quick tip:
If you haven't initialized Git yet, you can do so in your terminal (inside the `smartpark` folder) with these commands:
1. `git init`
2. `git add .`
3. `git commit -m "Initial commit: Production-ready Spring Boot Backend"`
4. Then link it to your GitHub repository 