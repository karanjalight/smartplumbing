# Smart Water Billing Platform — Project Proposal

This document captures the product vision and objectives. **API documentation** should be added alongside this file (see `docs/API.md` when available) so implementation stays aligned with backend contracts.

---

## 1. Project overview

This project aims to develop a **centralized digital platform** for managing **smart water meters**, **tenant billing**, and **landlord records**.

The platform will automate water usage tracking, billing, and payments while providing a simple and transparent system for tenants, property managers, and administrators.

By integrating **smart meter APIs**, **mobile payments**, and **automation tools**, the platform will eliminate manual billing processes and improve operational efficiency.

The solution will be accessible through a **modern web platform** and **Progressive Web App (PWA)**, ensuring users can access the system easily from mobile phones, tablets, or desktop computers.

---

## 2. Project objectives

The key objectives of this project are to:

- Build a **fully functional platform** for smart water billing, tenant management, and landlord record keeping.
- **Replace the current landing page** with a centralized platform for tenants, landlords, and administrators.
- Enable **real-time smart meter monitoring** and **automated billing**.
- Support **secure payments through M-Pesa** for both **prepaid** and **postpaid** billing models.
- Enable **automated payouts to landlords** on a monthly or scheduled basis.
- Maintain a **centralized digital record system** for:
  - invoices
  - tenant billing records
  - landlord agreements
  - smart meter installations
- Deliver a **Progressive Web App (PWA)** that works across Android, iOS, tablets, and desktops **without requiring installation from an app store**.
- Build a **scalable and maintainable** system architecture capable of supporting:
  - multiple properties
  - large numbers of tenants
  - additional smart meters
  - future system expansions

---

## 3. Smart meter system integration

The platform integrates directly with the smart meter manufacturer’s APIs for automated device management and real-time data access.

For the initial phase, the system supports **STS (Standard Transfer Specification)** smart water meters, enabling secure prepaid token-based water credit management.

The integration will allow the platform to:

- Register and onboard new smart meters during installation.
- Retrieve meter readings and water consumption data.
- Generate and manage STS prepaid tokens for tenants.
- Monitor meter health and connectivity status.
- Detect leaks or abnormal consumption patterns.
- Link smart meters directly to tenant accounts for automated billing.
- Synchronize meter usage data with the billing system.

---

## 4. Future expansion capability

The platform is designed with a flexible and scalable architecture that supports integration with additional smart metering infrastructure in the future, including:

- **IoT Gateways** — collect data from multiple smart meters.
- **Concentrators** — aggregate meter readings before sending to the platform.
- **LoRaWAN or other long-range networks** — used in large deployments.

This approach allows the system to scale from individual STS meters to full smart metering networks without major redesigns.

---

## 5. Core platform features

The platform uses a **three-tier system architecture** with separate interfaces for:

- **Tenants**
- **Landlords / Property Managers**
- **Administrators**

### 5.1 Tenant application

Tenants interact through a mobile-friendly web application with transparency over water usage and billing.

**Key features:**

- Create and manage personal profile information.
- View real-time water usage (daily, weekly, monthly).
- Track billing history and outstanding balances.
- Make prepaid or postpaid payments via M-Pesa.
- Receive instant water credit updates after payment.
- Access digital receipts and transaction records.
- Install as a mobile app using PWA technology.

**Alerts and notifications:**

- Low water balance
- Abnormal usage
- Leak detection warnings

### 5.2 Landlord / Property Manager portal

The landlord portal allows property owners to manage buildings, tenants, and billing.

**Features:**

- Add, edit, or remove tenants.
- Assign smart water meters to tenant units.
- Manage multiple buildings and properties from one account.
- Configure water pricing for tenants.
- Monitor tenant payments and billing records.
- Access analytics and reports on water usage and revenue.
- Store and manage contracts, invoices, and landlord agreements.

**Alerts:**

- Abnormal meter activity
- Payment issues
- Potential water leaks

### 5.3 Admin management dashboard

The admin dashboard provides full system oversight and operational control.

**Capabilities:**

- Manage tenants, landlords, and smart meters.
- Provision and onboard new smart meters.
- Generate manual STS tokens if app-based token delivery fails.
- Monitor meter health and connectivity status.
- Perform remote valve control where supported by meter hardware.
- Send platform-wide notifications and alerts.
- Maintain activity logs and audit trails.

**Analytics:**

- Water usage trends
- Revenue performance
- Device connectivity and reliability

---

## 6. Related documentation

| Document | Purpose |
|----------|---------|
| `docs/PROJECT_PROPOSAL.md` | This file — vision, objectives, features |
| `docs/API.md` | LONGi Meter Vending API and backend reference |

When sharing additional API documentation (e.g. M-Pesa), add to **`docs/API.md`** or create linked files under `docs/api/`.
