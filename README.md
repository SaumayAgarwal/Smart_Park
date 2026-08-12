# 🚗 SmartPark - Smart Parking Management System

SmartPark is a smart parking management system built using **Java, Spring Boot, MySQL, Redis, Apache Kafka, and Docker**.

The system allows users to find and book parking spaces while providing secure authentication, booking management, notifications, and parking operations.

## ✨ Features

* 🔐 JWT-based authentication
* 👥 Role-based access control
* 📧 OTP email verification
* 🅿️ Parking spot management
* 📍 Nearby parking search
* 📅 Parking booking
* 🔒 Redis-based distributed locking to prevent double booking
* ⚡ Kafka-based asynchronous notifications
* 🔔 Email and real-time notifications
* 📱 QR-based parking check-in/check-out
* 🗄️ MySQL database
* 🚀 Docker & Docker Compose support

## 🛠️ Tech Stack

### Backend

* Java
* Spring Boot
* Spring Security
* JWT
* Spring Data JPA / Hibernate
* Spring Validation
* Spring Mail
* Spring Kafka
* WebSocket / STOMP

### Database & Infrastructure

* MySQL
* Redis
* Apache Kafka
* Docker
* Docker Compose
* Maven

## 🏗️ Architecture

```text
             Client / Frontend
                    │
                    ▼
             Spring Boot API
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
     MySQL        Redis        Kafka
       │            │            │
       │            │            ▼
       │            │       Kafka Consumer
       │            │            │
       │            │            ▼
       │            │       Notifications
       │
       ▼
   Application Data
```

### Redis

Redis is used for:

* OTP storage
* Caching
* Temporary booking locks
* Preventing concurrent booking conflicts

### Kafka

Kafka is used for asynchronous event processing and notifications.

## 🚀 Getting Started

### Prerequisites

* Git
* Docker Desktop

### Clone the Repository

```bash
git clone git@github.com:Neeteshsingh660/SmartPark.git
cd SmartPark
```

### Environment Variables

Create a `.env` file in the project root:

```env
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
JWT_SECRET=your_jwt_secret
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
```

**Never commit the `.env` file to GitHub.**

### Run the Project

```bash
docker compose up -d --build
```

Check the containers:

```bash
docker ps
```

View backend logs:

```bash
docker compose logs -f backend
```

The backend runs on:

```text
http://localhost:8080
```

## 📂 Project Structure

```text
SmartPark/
├── src/
├── .mvn/
├── Dockerfile
├── docker-compose.yml
├── pom.xml
├── mvnw
├── mvnw.cmd
├── .gitignore
└── README.md
```

## 🔐 Security

Sensitive values such as database passwords, JWT secrets, and email credentials are stored using environment variables and are excluded from Git using `.gitignore`.

## 👨‍💻 Author

**Neetesh Singh**

GitHub: [Neeteshsingh660](https://github.com/Neeteshsingh660)

## 📄 License

This project is licensed under the MIT License.
