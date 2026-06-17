# ProKitchen POS System

A high-performance, real-time Point of Sale (POS) and Kitchen Display System (KDS) designed for modern restaurant environments. Built with a focus on operational speed, data integrity, and real-time synchronization between the front-of-house and back-of-house.

---

## 🚀 Key Features

### 🛒 POS Terminal
* **Dynamic Product Grid:** Image-rich, category-filtered product selection.
* **Inventory Awareness:** Real-time stock tracking; prevents over-selling.
* **Seamless Checkout:** Instant transaction processing with auto-receipt generation.

### 👨‍🍳 Kitchen Display System (KDS)
* **Real-time Ticket Board:** Uses WebSockets (Pusher) for instant order notifications.
* **Operational Pipeline:** Tracks order states from `PENDING` to `PREPARING`, `READY`, and finally `COMPLETED`.
* **Wait-Time Analytics:** Visual "stress timers" (Green/Yellow/Red) help chefs prioritize orders.
* **Dedicated Prep Tickets:** Stripped-down, high-visibility receipts for kitchen efficiency.

### 📊 Admin Dashboard
* **Menu & Inventory Control:** Full CRUD operations for categories and products.
* **Cloudinary Integration:** Easy image management for menu items.
* **Revenue Analytics:** Automated, real-time sales reporting and order counting.

---

## 🛠 Tech Stack

* **Framework:** Next.js 15 (App Router)
* **Language:** TypeScript
* **Database:** PostgreSQL (via Neon)
* **ORM:** Prisma
* **Real-time:** Pusher
* **Media:** Cloudinary
* **Styling:** Tailwind CSS

---

## 🏗 System Architecture

The application is built on a clean, decoupled architecture:
1. **Server Actions:** All database interactions are handled via secure Server Actions, ensuring sensitive business logic never leaves the server.
2. **Relational Integrity:** Utilizes PostgreSQL foreign key constraints to ensure order history remains accurate even when menu items are modified.
3. **Real-Time Event Loop:** Pub/Sub pattern via Pusher to keep the Kitchen and Cashier interfaces perfectly synced.



---

## ⚙️ Getting Started

### Prerequisites
* Node.js 18+
* PostgreSQL Database (Neon recommended)
* Pusher Account (for WebSockets)
* Cloudinary Account (for image hosting)

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/prokitchen-pos.git](https://github.com/yourusername/prokitchen-pos.git)
   cd prokitchen-pos

    Install dependencies:
    Bash

    npm install

    Set up your .env.local file:
    Code snippet

    DATABASE_URL="your_neon_db_url"
    PUSHER_APP_ID="your_pusher_id"
    NEXT_PUBLIC_PUSHER_KEY="your_pusher_key"
    PUSHER_SECRET="your_pusher_secret"
    NEXT_PUBLIC_PUSHER_CLUSTER="your_cluster"
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your_cloud_name"
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="your_preset"

    Push the database schema:
    Bash

    npx prisma db push

    Start the development server:
    Bash

    npm run dev

💡 Technical Challenges Solved

    Hydration Mismatch: Resolved React server/client HTML mismatches using suppressHydrationWarning for dynamic date and boolean attributes.

    Prisma Serialization: Fixed [object Object] errors during server-to-client data transfer by sanitizing Prisma Decimal and Date objects into plain JSON.

    Referential Integrity: Implemented cascading deletes and foreign key management to maintain absolute historical accuracy for past transactions.

👨‍💻 Developer

Muhammad Ammar (Ammar Talpur) Full Stack Web Developer | Backend Specialist