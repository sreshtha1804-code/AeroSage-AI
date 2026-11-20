# 🌿 AeroSage AI
### Smarter Air. Healthier Living.

**Predict Pollution. Protect People. Breathe Smarter.**

AeroSage AI is an AI-powered air quality intelligence platform designed to help individuals, families, and communities understand pollution levels, anticipate environmental risks, and make healthier everyday decisions.

Instead of simply displaying AQI values, AeroSage AI transforms environmental data into actionable insights through AI-powered recommendations, personalized pollution safety guidance, daily activity planning, and indoor air quality suggestions.

---

## ✨ Key Features

### 🌍 1. Air Quality Intelligence
- Real-time air quality information using Open-Meteo's CAMS-based air quality data.
- AQI monitoring based on Indian CPCB breakpoints.
- PM2.5, PM10 and other pollutant readings.
- Historical trends and upcoming air quality forecasts.
- Clearly labelled demonstration mode when live data is unavailable.

### 🤖 2. AI-Powered Environmental Assistant
- Gemini-powered conversational AI assistant.
- Ask questions about pollution, health precautions, and environmental safety.
- Personalized recommendations based on air quality readings and household profiles.
- Rule-based fallback responses when AI services are unavailable.

### 📅 3. Smart Daily Planner
- Identifies comparatively cleaner outdoor activity windows.
- Helps plan walks, exercise, and daily commutes.
- Provides pollution-aware recommendations for everyday routines.

### 🏠 4. Indoor Air Intelligence
- Personalized ventilation suggestions.
- Indoor air quality improvement recommendations.
- Room-based air purifier sizing estimates.
- Practical and budget-friendly pollution protection tips.

### 👨‍👩‍👧 5. Family Safety Mode
- Create household profiles for children, adults, elderly people, and outdoor workers.
- Generate personalized pollution safety recommendations.
- Produce printable pollution safety reports.
- Optional cloud-based profile storage using Supabase.

### 🌱 6. Environmental Impact Calculator
- Compare different transportation choices.
- Estimate potential carbon emission savings.
- Compare disposable and reusable alternatives.
- Evaluate energy-efficient and conventional appliances.

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 18, Vite |
| Styling | Tailwind CSS, CSS |
| Backend | Node.js, Express.js |
| AI Integration | Google Gemini API |
| Air Quality Data | Open-Meteo (CAMS model) |
| Database | Supabase (Optional) |
| Data Visualization | Recharts |
| Icons | Lucide React |
| Deployment | Vercel, Render |
| Version Control | Git, GitHub |

---

## 🏗️ Project Architecture

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
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── render.yaml
├── vercel.json
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

Follow these steps to run AeroSage AI locally.

### Prerequisites

Make sure you have installed:

- Node.js 18 or later
- npm
- Git
- A code editor such as Visual Studio Code

### 1. Clone the Repository

```bash
git clone https://github.com/sreshtha1804-code/AeroSage-AI.git
```

### 2. Navigate to the Project

```bash
cd AeroSage-AI
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root using `.env.example` as a reference.

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

PORT=8787
CORS_ORIGIN=

SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

For the Gemini API key, visit:

https://aistudio.google.com/apikey

**Note:** Gemini integration is optional. The application supports labelled rule-based fallback responses.

### 5. Start the Backend

Open a terminal:

```bash
npm run server
```

The backend runs on:

```text
http://localhost:8787
```

### 6. Start the Frontend

Open another terminal:

```bash
npm run dev
```

Open the local development URL displayed by Vite, usually:

```text
http://localhost:5173
```

---

## 🔌 API Endpoints

AeroSage AI uses a Node.js and Express backend.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Backend health check |
| GET | `/api/aqi?city={city}` | Retrieves air quality information |
| POST | `/api/chat` | Processes AI assistant conversations |
| GET | `/api/family` | Retrieves household profiles |
| POST | `/api/family` | Creates a household profile |
| DELETE | `/api/family/:id` | Removes a household profile |

---

## ☁️ Deployment

AeroSage AI supports separate frontend and backend deployments.

### Frontend – Vercel

1. Import the GitHub repository into Vercel.
2. Select Vite as the framework.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Configure the environment variable:

```env
VITE_API_URL=https://your-backend.onrender.com
```

6. Deploy the application.

### Backend – Render

1. Connect the GitHub repository to Render.
2. Select Blueprint deployment to use `render.yaml`.
3. Configure the required environment variables:

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGIN=https://your-frontend.vercel.app
```

4. Configure optional Supabase credentials if cloud profiles are required.
5. Deploy the backend.

### Verify Backend Deployment

Visit:

```text
https://your-backend.onrender.com/api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

**Deployment Note:** Render's free tier may spin down after inactivity, causing delays on the first request.

---

## 🗄️ Supabase Configuration (Optional)

AeroSage AI supports optional cloud storage for household profiles.

1. Create a Supabase project.
2. Open the SQL Editor.
3. Execute the SQL script available at:

```text
supabase/schema.sql
```

4. Configure the following environment variables on Render:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
```

Without Supabase configuration, household profiles are stored locally in the browser.

**Security:** Never expose the Supabase service role key in frontend code or commit it to GitHub.

---

## 📊 Data Transparency & Reliability

AeroSage AI prioritizes transparency in environmental information.

- Air quality information is sourced from Open-Meteo's CAMS model.
- Indian AQI categories are approximated using CPCB breakpoint calculations.
- Source information and data timestamps are displayed.
- Demonstration data is clearly identified when live data cannot be retrieved.
- Environmental impact calculations use editable assumptions and provide estimates rather than measured results.
- AI-generated recommendations are intended for general awareness and are not a substitute for professional medical advice.

---

## 🌎 Project Vision

Air pollution is more than an environmental statistic. It affects everyday activities, family health, mobility, and quality of life.

AeroSage AI aims to bridge the gap between environmental data and practical decision-making by making pollution intelligence understandable, accessible, and actionable.

Our vision is to help people move from simply knowing about pollution to making informed decisions that protect themselves and their communities.

**Smarter Air. Healthier Living. A Better Tomorrow.**

---

## 👩‍💻 Development

Developed by **Team Twinergy**.

GitHub: https://github.com/sreshtha1804-code

---

## 📄 License

No open-source license has been specified yet. All rights reserved unless a license is added to this repository.

---

<p align="center">
  <b>🌿 AeroSage AI</b><br/>
  Predict Pollution. Protect People. Breathe Smarter.
</p>
