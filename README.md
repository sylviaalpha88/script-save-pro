# 🏥 LEMSA Pharmacy Management System

Welcome to the central repository for the **LEMSA Pharmacy Management System**. This project is built using TanStack Start, TypeScript, and Bun, with database integration powered by Supabase.

---

## 🌐 Live System Directory & Portals

Click the links below to access the individual staging environments for each department:

*   **🔑 Main Portal / User Login**: [Open System Portal](https://github.io)
*   **👨‍💼 Admin Department**: [Admin Login Dashboard](https://github.ioadmin/login)
*   **👥 HR / Employee Department**: [Staff Dashboard](https://github.iohr/dashboard)
*   **💰 Sales & Billing Department**: [Sales Point of Sale](https://github.iosales/auth)
*   **🛠️ IT & System Support**: [Technical Assistance](https://github.iosupport)

---

## 📦 Project Architecture & Directories
*   📁 `/.github/workflows` — Contains `build.yml` for automated GitHub Pages hosting.
*   📁 `/src` — Core application routing, layouts, and pharmacy modules.
*   📁 `/supabase` — Local backend database tables, triggers, and security.
*   📄 `/env.example` — Public global routing matrix configuration.

---

## 🚀 How to Run locally and Compile to `dist`

### 1. Installation
Install project tools using the **Bun** package manager:
```bash
bun install
```

### 2. Run Development Server
```bash
bun run dev
```

### 3. Generate Final Production Output (`dist`)
To compile the absolute final code package files into your distribution build directory:
```bash
bun run build
```
