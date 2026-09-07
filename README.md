# 🌐 Website System Architecture & Portal Directory

## 📋 Department Portals & Login URLs

| Department | URL / Login Path | Access Level |
| :--- | :--- | :--- |
| **Admin Dashboard** | `https://example.com` | Super Admin / IT |
| **HR / Staff Portal** | `https://example.com` | Employees |
| **Customer Portal** | `https://example.com` | Public Users |
| **API Gateway** | `https://example.com` | Developers |

---

## 🏗️ Repository Directory Structure
*   📁 `/src` — Core application source code.
*   📁 `/config` — System environment templates.
*   📁 `/docs` — Detailed department workflows and API manuals.
*   📁 `/dist` — Final optimized production build files (Generated after build).

---

## 🚀 Final Run & Deployment Instructions
Follow these steps to compile the system and generate the final `dist` folder:

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org) installed.

### 2. Installation
Install all required project dependencies:
\`\`\`bash
npm install
\`\`\`

### 3. Production Build
Run the compilation script to generate the production-ready `dist` folder:
\`\`\`bash
npm run build
\`\`\`
The compiled assets will appear in the root `/dist` directory, ready to be uploaded to your web server.
