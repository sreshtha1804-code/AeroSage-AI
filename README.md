# 🌿 AeroSage AI
### Predict Pollution. Protect People. Breathe Smarter.

**AeroSage AI** is a Generative AI-powered Urban Air Quality Assistant that helps individuals and families understand air pollution, monitor environmental conditions, and make informed decisions about their daily activities.

By combining environmental data from Open-Meteo with Google Gemini, AeroSage AI transforms complex air quality information into understandable insights, practical recommendations, and personalized environmental guidance.

---

## 🔗 Project Links

| Resource | Link |
|---|---|
| 🌐 Live Application | [AeroSage AI](https://aerosageai-six.vercel.app/) |
| 💻 GitHub Repository | [AeroSage-AI](https://github.com/sreshtha1804-code/AeroSage-AI) |
| ⚙️ Backend API | [Render Backend](https://aerosage-api.onrender.com) |
| ❤️ Backend Health Check | [API Status](https://aerosage-api.onrender.com/api/health) |
| 🤖 Generative AI | [Google Gemini API](https://ai.google.dev/) |
| 🧠 AI Model | Gemini 3.8 Flash |
| 🌍 Environmental Data | [Open-Meteo](https://open-meteo.com/) |
| ☁️ Frontend Hosting | [Vercel](https://vercel.com/) |
| 🖥️ Backend Hosting | [Render](https://render.com/) |
| 🗄️ Database | [Supabase](https://supabase.com/) (Optional) |

**Challenge:** Challenge 6 — Urban Air Quality Assistant

---

## 🌍 1. Problem Statement

Air pollution is a growing urban challenge that affects people's health, lifestyle, and everyday activities.

Although air quality information is available through various platforms, users often struggle to understand what AQI values mean and how pollution levels should influence their daily decisions.

For example:
- Is it safe for children to play outside?
- When is the best time to go for a walk?
- How can indoor air quality be improved?
- What precautions should families take during poor air quality?
- How can people understand changing pollution patterns?

Traditional AQI dashboards mainly display numbers. They do not always translate those numbers into practical, understandable guidance.

## 💡 2. Our Solution

AeroSage AI addresses this problem by creating an intelligent environmental assistance platform.

It combines air quality information, historical trends, forecasts, and Generative AI to help users understand environmental conditions and make better-informed decisions.

The platform goes beyond displaying AQI values by providing:
- Environmental monitoring and visualization.
- Pollution trends and forecasts.
- Smart outdoor activity planning.
- Indoor air quality recommendations.
- Family-oriented environmental guidance.
- An AI-powered conversational assistant.

Our goal is to make environmental information accessible, understandable, and actionable.

---

## ✨ 3. Key Features

### 🌫️ Air Quality Monitoring
- View air quality information for selected locations.
- Monitor estimated AQI and pollutant measurements.
- Understand air quality categories.
- Access environmental information through an intuitive dashboard.

### 📊 Historical Trends & Forecasts
- Visualize historical pollution trends.
- Explore available air quality forecasts.
- Understand how environmental conditions change over time.
- Identify periods that may require additional precautions.

### 🤖 Gemini-Powered AI Assistant
The conversational assistant uses **Google Gemini 3.8 Flash** to help users understand environmental conditions through natural-language conversations.

Users can ask questions such as:
- Is it safe for my children to play outside today?
- How do I make my bedroom air cleaner cheaply?
- What precautions should I take when AQI is high?
- What does the current pollution level mean for my family?

The assistant uses available air quality context to generate understandable responses and practical recommendations.

### 🕒 Smart Daily Activity Planner
- Helps users identify comparatively cleaner outdoor hours.
- Supports better planning of outdoor activities.
- Provides guidance based on available environmental information.

### 🏠 Indoor Air Quality Guidance
- Practical and affordable indoor pollution-reduction suggestions.
- Guidance on common indoor pollution sources.
- Air purifier sizing recommendations.
- Tips for improving bedroom and household air quality.

### 👨‍👩‍👧 Family Health Support
- Family profile management.
- Family-oriented environmental guidance.
- Printable environmental health reports.

*Cloud-based family profile storage requires optional Supabase configuration.*

### 🌱 Environmental Impact Calculator
- Explore the environmental impact of everyday habits.
- Understand how sustainable lifestyle choices can support cleaner surroundings.

---

## 🧠 4. Generative AI Integration

### Google Gemini API — Gemini 3.8 Flash

Google Gemini is the primary Generative AI service used in AeroSage AI.

**Where is it used?**

The Gemini API powers the environmental conversational assistant.

It helps users:
- Ask questions using natural language.
- Understand AQI and pollution information.
- Receive context-aware environmental guidance.
- Explore indoor and outdoor pollution precautions.
- Make informed everyday environmental decisions.

**How it works:**

1. A user submits a question through the frontend.
2. The backend receives the question and available environmental context.
3. The backend sends the request to the Gemini API.
4. Gemini generates a response.
5. The backend returns the generated response to the frontend.

The application also includes basic fallback guidance when the AI service is unavailable.

### Environmental Data — Open-Meteo API

Open-Meteo provides the environmental information used by AeroSage AI.

It supports:
- Location lookup.
- Air quality information.
- Pollutant measurements.
- Historical and forecast data where available.

The application combines environmental data with Gemini-generated insights to make the information more useful to everyday users.

**Important distinction:** Open-Meteo is an environmental data provider, not a Generative AI service.

---

## 🛠️ 5. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript |
| Build Tool | Vite |
| Styling | CSS, Tailwind CSS |
| Backend | Node.js, Express.js |
| Generative AI | Google Gemini API |
| AI Model | Gemini 3.8 Flash |
| Environmental Data | Open-Meteo API |
| Database | Supabase (Optional) |
| Data Visualization | Recharts |
| Icons | Lucide React |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Version Control | Git, GitHub |

---

## 🏗️ 6. System Architecture

AeroSage AI follows a frontend-backend architecture.

```text
                  USER
                    |
                    v
             REACT FRONTEND
                 VERCEL
                    |
                    v
            EXPRESS BACKEND
                 RENDER
                    |
           +--------+--------+
           |                 |
           v                 v
      OPEN-METEO         GOOGLE GEMINI
      ENVIRONMENTAL      GENERATIVE AI
          DATA           GEMINI 3.8
           |                 |
           +--------+--------+
                    |
                    v
             RESPONSE PROCESSING
                    |
                    v
             REACT FRONTEND
                    |
                    v
              USER INSIGHTS

          SUPABASE (OPTIONAL)
          FAMILY DATA STORAGE
```

### Application Workflow

1. The user interacts with the React frontend.
2. The frontend communicates with the Express backend.
3. The backend retrieves environmental information from Open-Meteo.
4. For conversational requests, the backend communicates with Gemini.
5. Responses are processed and returned to the frontend.
6. The user receives visualized environmental information and AI-generated guidance.

---

## 📁 7. Project Structure

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

## ⚙️ 8. Installation & Local Setup

### Prerequisites

Make sure the following are installed:

- Node.js 18 or later.
- npm.
- Git.
- A Google Gemini API key.

### Step 1: Clone the Repository

```bash
git clone https://github.com/sreshtha1804-code/AeroSage-AI.git
```

### Step 2: Navigate to the Project

```bash
cd AeroSage-AI
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

Create a `.env` file in the project root.

```env
PORT=8787

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash

CORS_ORIGIN=http://localhost:5173

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Supabase configuration is optional and is needed for cloud-based family profile storage.

**Security:** Never commit your `.env` file or expose your API keys in frontend code or public repositories.

### Step 5: Start the Backend

```bash
npm run server
```

### Step 6: Start the Frontend

Open another terminal:

```bash
npm run dev
```

Open the local URL provided by Vite, usually:

```text
http://localhost:5173
```

---

## 🔌 9. Backend API Endpoints

The Express backend exposes the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Checks backend health |
| GET | `/api/aqi?city=Kolkata` | Retrieves air quality information |
| POST | `/api/chat` | Processes AI assistant requests |
| GET | `/api/family` | Retrieves family profiles |
| POST | `/api/family` | Saves a family profile |
| DELETE | `/api/family/:id` | Deletes a family profile |

**Note:** Family endpoints require Supabase configuration.

### Backend Health Check

The deployed backend can be checked here:

https://aerosage-api.onrender.com/api/health

---

## 🚀 10. Deployment

AeroSage AI is deployed using separate frontend and backend services.

| Component | Platform | Deployment |
|---|---|---|
| Frontend | Vercel | [Live Frontend](https://aerosageai-six.vercel.app/) |
| Backend | Render | [Backend Service](https://aerosage-api.onrender.com) |
| Health Endpoint | Render | [API Health](https://aerosage-api.onrender.com/api/health) |

### Required Backend Environment Variables

Configure these in the Render dashboard:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini API authentication |
| `GEMINI_MODEL` | Configured Gemini model |
| `NODE_VERSION` | Node.js runtime version |
| `CORS_ORIGIN` | Permitted frontend origin |
| `SUPABASE_URL` | Optional Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Optional server-side Supabase key |

Recommended model configuration:

```env
GEMINI_MODEL=gemini-3.8-flash
```

Never expose server-side secrets through frontend environment variables.

---

## 🔐 11. Security & Reliability

AeroSage AI incorporates several backend security and reliability practices:

- Server-side handling of Gemini API requests.
- Environment-based secret management.
- Backend request validation.
- CORS configuration.
- Error handling for external API failures.
- Fallback guidance when the AI service is unavailable.
- Optional server-side Supabase integration.

These measures help improve the reliability and security of the application.

---

## 📌 12. Assumptions & Limitations

- Air quality information depends on the availability and coverage of external environmental data sources.
- AQI values are estimates derived from available pollutant measurements and calculation methods.
- Estimated AQI should not be confused with official ground-monitoring station readings.
- Forecasts are subject to uncertainty and changing environmental conditions.
- Gemini-generated guidance is informational and should not be treated as medical advice.
- Family profile cloud storage requires optional Supabase configuration.
- The free backend hosting tier may introduce a delay when the service wakes from inactivity.

---

## 🔮 13. Future Enhancements

AeroSage AI aims to expand into a more comprehensive environmental intelligence platform.

Planned improvements include:

- Hyperlocal air quality monitoring.
- IoT-based air quality sensor integration.
- Advanced pollution-risk prediction.
- Interactive environmental risk maps.
- More personalized family recommendations.
- Improved indoor air quality monitoring.
- Additional environmental data integrations.
- Automated testing and performance monitoring.

---

## 🎯 14. Problem Statement Alignment

**Selected Challenge: Challenge 6 — Urban Air Quality Assistant**

AeroSage AI addresses the need for an intelligent, accessible, and practical urban air quality assistance platform.

It combines environmental monitoring, data visualization, activity planning, indoor air quality recommendations, and Generative AI to help individuals and families understand pollution and make informed everyday decisions.

The project focuses on transforming environmental data into actionable guidance rather than simply presenting AQI numbers.

---

## 👩‍💻 15. Developer

**Sreshtha Das**

B.Tech — Computer Science and Engineering

GitHub: [sreshtha1804-code](https://github.com/sreshtha1804-code)

Project: [AeroSage AI](https://github.com/sreshtha1804-code/AeroSage-AI)

---

## ⚠️ Disclaimer

AeroSage AI is an informational environmental assistance platform. Its air quality readings, estimates, forecasts, and AI-generated recommendations are not a substitute for official environmental advisories or professional medical advice.

For authoritative air quality information, users should consult their relevant environmental monitoring authorities.

---

<p align="center">

### 🌿 AeroSage AI

**Predict Pollution. Protect People. Breathe Smarter.**

*Making environmental intelligence accessible, understandable, and actionable.*

</p>
