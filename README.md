# 🌿 AeroSage AI
### Predict Pollution. Protect People. Breathe Smarter.

**AeroSage AI** is a Generative AI-powered Urban Air Quality Assistant designed to help individuals and families understand air pollution, monitor environmental conditions, and make healthier everyday decisions.

Instead of simply displaying AQI values, AeroSage AI transforms environmental information into practical insights through air quality monitoring, pollution trends, activity planning, indoor air quality guidance, and an AI-powered conversational assistant.

<p align="center">
  **Live Application:** https://aerosageai-six.vercel.app/
  **Backend API:** https://aerosage-api.onrender.com
  **GitHub Repository:** https://github.com/sreshtha1804-code/AeroSage-AI
</p>

---

## 🌍 Project Overview

Air pollution is a major environmental challenge affecting public health, especially children, elderly individuals, and people with respiratory sensitivities.

People often see AQI numbers but do not know what those numbers mean for their daily activities.

AeroSage AI addresses this problem by combining environmental data with Generative AI to provide understandable, actionable, and context-aware environmental guidance.

### 🎯 Our Mission

To make environmental intelligence accessible to everyone and empower communities to make informed decisions about the air they breathe.

---

## ✨ Key Features

### 1. 🌫️ Real-Time Air Quality Dashboard
- Monitor air quality information for selected locations.
- View estimated AQI and pollutant information.
- Understand air quality categories through an intuitive dashboard.
- Access environmental conditions in an easy-to-understand format.

### 2. 📊 Pollution Trends & Forecasts
- Explore historical air quality trends.
- View upcoming air quality forecasts.
- Understand changes in pollution levels.
- Identify periods that may require additional precautions.

### 3. 🧠 AI-Powered Environmental Assistant
Powered by **Google Gemini 3.8 Flash**.

Users can ask natural-language questions such as:
- Is it safe for my children to play outside today?
- How can I improve my bedroom's air quality cheaply?
- What precautions should I take during poor air quality?
- What does the current AQI mean for my family?

The assistant uses available environmental context to generate understandable responses and practical recommendations.

### 4. 🕒 Smart Daily Activity Planner
- Identify comparatively cleaner outdoor hours.
- Support better planning of outdoor activities.
- Provide recommendations based on available air quality information.

### 5. 🏠 Indoor Air Quality Guidance
- Discover affordable ways to improve indoor air quality.
- Learn practical pollution-reduction habits.
- Explore air purifier sizing guidance.
- Understand common indoor pollution sources.

### 6. 👨‍👩‍👧 Family Health Support
- Manage family profiles.
- Access family-oriented environmental guidance.
- Generate printable environmental health reports.

*Cloud-based family profile storage requires optional Supabase configuration.*

### 7. 🌱 Environmental Impact Calculator
Explore how everyday choices and sustainable habits can contribute to a healthier environment.

---

## 🤖 Generative AI Integration

### Google Gemini API — Gemini 3.8 Flash

Gemini is the primary Generative AI service used in AeroSage AI.

It powers the conversational environmental assistant and helps users:

- Understand air quality information.
- Ask questions in natural language.
- Receive context-aware environmental guidance.
- Explore practical indoor and outdoor pollution precautions.
- Make more informed everyday decisions.

The backend sends user questions and available environmental context to the Gemini API and returns generated responses to the frontend.

**Configured model:**
`gemini-3.8-flash`

### Environmental Data Integration

**Open-Meteo API**

Open-Meteo provides environmental and air quality information used by the application, including air quality measurements and forecast data.

The application combines this environmental information with Gemini-generated insights.

**Important:** Environmental readings and AQI calculations are estimates based on available data and calculation methods. They should not be interpreted as official ground-monitoring station measurements.

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, JavaScript, Vite |
| Styling | Tailwind CSS, CSS |
| Backend | Node.js, Express.js |
| Generative AI | Google Gemini API |
| AI Model | Gemini 3.8 Flash |
| Environmental Data | Open-Meteo API |
| Database | Supabase (optional) |
| Charts | Recharts |
| Icons | Lucide React |
| Deployment | Vercel, Render |
| Version Control | Git, GitHub |

---

## 🏗️ Project Architecture

```text
                 USER
                   |
                   v
          REACT FRONTEND
             (Vercel)
                   |
                   v
          EXPRESS BACKEND
             (Render)
             /       \
            /         \
           v           v
     Open-Meteo    Gemini API
     Air Quality   Gemini 3.8
       Data          Flash
           \           /
            \         /
             v       v
          PROCESSED INSIGHTS
                   |
                   v
          USER-FRIENDLY RESULTS
```

Optional Supabase integration supports cloud-based family profile storage.

---

## 📁 Project Structure

```text
AeroSage-AI/
│
├── server/
│   └── index.js
│
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── supabase/
│   └── schema.sql
│
├── public/
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── render.yaml
├── vercel.json
├── vite.config.js
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites

Make sure you have installed:

- Node.js 18 or later
- npm
- Git
- A Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/sreshtha1804-code/AeroSage-AI.git
```

### 2. Navigate to the project

```bash
cd AeroSage-AI
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root.

```env
PORT=8787

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash

CORS_ORIGIN=http://localhost:5173

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Supabase variables are optional unless you want cloud-based family profile storage.

**Security:** Never commit your `.env` file, Gemini API key, or Supabase service-role key to GitHub.

### 5. Start the development server

Start the backend:

```bash
npm run server
```

In another terminal, start the frontend:

```bash
npm run dev
```

Open the local URL displayed by Vite, usually:

```text
http://localhost:5173
```

---

## 🔌 API Endpoints

The backend exposes the following endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Backend health check |
| GET | `/api/aqi?city=Kolkata` | Retrieve air quality information |
| POST | `/api/chat` | Generate AI-powered responses |
| GET | `/api/family` | Retrieve family profiles |
| POST | `/api/family` | Save a family profile |
| DELETE | `/api/family/:id` | Delete a family profile |

Family endpoints require Supabase configuration.

### Health Check

```text
https://aerosage-api.onrender.com/api/health
```

---

## 🚀 Deployment

AeroSage AI uses separate deployment services for its frontend and backend.

### Frontend — Vercel

The React frontend is deployed using Vercel.

Live URL:

https://aerosageai-six.vercel.app/

### Backend — Render

The Node.js and Express backend is deployed using Render.

Backend URL:

https://aerosage-api.onrender.com

Configure the required environment variables in Render before deployment.

Set the frontend's backend API URL using the deployment configuration supported by the project.

---

## 🔐 Security Considerations

- API keys are stored as server-side environment variables.
- Gemini requests are handled by the backend.
- Supabase service credentials should never be exposed in frontend code.
- Backend input validation helps prevent invalid requests.
- CORS configuration restricts permitted frontend origins.
- Error handling provides fallback responses when AI services are unavailable.

---

## 🌱 Future Enhancements

- Hyperlocal air quality monitoring.
- More granular pollution-risk predictions.
- Personalized family health recommendations.
- Integration with IoT air quality sensors.
- Indoor air quality monitoring.
- Interactive pollution-risk maps.
- More environmental data sources.
- Improved automated testing and monitoring.

---

## 💡 Problem Statement Alignment

**Challenge 6 — Urban Air Quality Assistant**

AeroSage AI addresses the challenge of making urban air quality information understandable, accessible, and actionable.

By combining environmental data, AI-generated insights, and practical recommendations, the platform helps individuals and families understand pollution risks and make better-informed everyday decisions.

It aims to move beyond traditional AQI dashboards towards an intelligent, user-focused environmental assistance platform.

---

## 👩‍💻 Developed By

**Sreshtha Das**

B.Tech — Computer Science and Engineering

GitHub: https://github.com/sreshtha1804-code

---

## 📜 Disclaimer

AeroSage AI is an informational environmental assistance platform. Its readings, estimates, forecasts, and AI-generated recommendations are not a substitute for official air quality advisories or professional medical advice.

Users should consult official environmental monitoring authorities for authoritative air quality information.

---

<p align="center">
  **AeroSage AI 🌿**
  <br/>
  *Predict Pollution. Protect People. Breathe Smarter.*
</p>
