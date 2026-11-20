# 🌿 AeroSage AI
### Predict Pollution. Protect People. Breathe Smarter.

**AeroSage AI** is an AI-powered air quality intelligence and environmental health platform designed to help individuals, families, and communities understand pollution, anticipate air quality risks, and make healthier everyday decisions.

Instead of simply displaying AQI values, AeroSage AI transforms environmental data into practical recommendations for outdoor activities, indoor air quality, family safety, and sustainable living.

---

## 🌐 Live Project Links

| Resource | Link |
|---|---|
| 🌿 Live Application | [AeroSage AI](https://aerosageai-six.vercel.app/) |
| 💻 GitHub Repository | [AeroSage-AI](https://github.com/sreshtha1804-code/AeroSage-AI) |
| ⚙️ Backend API | [AeroSage API](https://aerosage-api.onrender.com) |
| ❤️ API Health Check | [Check API Status](https://aerosage-api.onrender.com/api/health) |
| 🚀 Frontend Hosting | [Vercel](https://vercel.com/) |
| ☁️ Backend Hosting | [Render](https://render.com/) |

---

## ✨ Key Features

### 1. 🌍 Real-Time Air Quality Intelligence
- Search air quality information by city.
- View estimated AQI and major pollutant readings.
- Track PM2.5, PM10, and other available pollutants.
- Explore historical trends and short-term forecasts.
- Understand air quality through health-oriented categories.

### 2. 📅 Smart Daily Planner
- Identify comparatively cleaner hours for outdoor activities.
- Get recommendations for walks, school, work, and other daily routines.
- Make more informed decisions based on air quality forecasts.

### 3. 🏠 Indoor Air Quality Assistant
- Understand indoor ventilation needs.
- Explore air purifier sizing guidance.
- Receive practical, low-cost indoor air quality improvement tips.
- Learn when ventilation may be beneficial based on outdoor conditions.

### 4. 🤖 AI-Powered Environmental Assistant
- Ask questions about pollution and environmental health.
- Receive contextual air quality guidance.
- Get practical suggestions based on available environmental information.
- Uses Google's Gemini API when configured, with a rule-based fallback.

### 5. 👨‍👩‍👧 Family Safety
- Create and manage family profiles.
- Organize profiles by user category.
- Access family-oriented environmental guidance.
- Generate printable family reports.

*Family profile persistence requires Supabase configuration.*

### 6. 🌱 Environmental Impact Calculator
- Explore estimated environmental impact.
- Understand how everyday choices relate to sustainability.
- Use editable assumptions to calculate indicative results.

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, JavaScript |
| Build Tool | Vite |
| Styling | CSS, Tailwind CSS |
| Icons | Lucide React |
| Charts | Recharts |
| Backend | Node.js, Express.js |
| AI Integration | Google Gemini API |
| Environmental Data | Open-Meteo Geocoding & Air Quality APIs |
| Database / Persistence | Supabase (optional) |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Version Control | Git & GitHub |

---

## 🏗️ System Architecture

```text
                  USER
                    |
                    v
          REACT FRONTEND (VITE)
                    |
                    v
             EXPRESS BACKEND
                    |
        +-----------+-----------+
        |           |           |
        v           v           v
   Open-Meteo    Gemini API   Supabase
   Air Quality   AI Assistant  Optional
   & Geocoding
        |           |           |
        +-----------+-----------+
                    |
                    v
          PROCESSED RESPONSES
                    |
                    v
             USER INTERFACE
```

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

## ⚙️ Run Locally

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

CORS_ORIGIN=http://localhost:5173

SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

Do not commit your `.env` file or expose API keys publicly.

### 5. Start the Backend

Open a terminal:

```bash
npm run server
```

The backend will run at:

```text
http://localhost:8787
```

### 6. Start the Frontend

Open another terminal:

```bash
npm run dev
```

Open the local application:

```text
http://localhost:5173
```

---

## 🔌 API Documentation

The backend provides the following API endpoints.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check backend health |
| GET | `/api/aqi?city=Kolkata` | Retrieve air quality information |
| GET | `/api/aqi?city=Kolkata&demo=1` | Retrieve demonstration AQI data |
| POST | `/api/chat` | Send a message to the AI assistant |
| GET | `/api/family` | Retrieve family profiles |
| POST | `/api/family` | Create a family profile |
| DELETE | `/api/family/:id?device=DEVICE_ID` | Delete a family profile |

### Example: Health Check

```http
GET /api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

### Example: Chat Request

```http
POST /api/chat
Content-Type: application/json
```

Request body:

```json
{
  "message": "How can I protect myself from air pollution?",
  "history": [],
  "context": {},
  "profile": []
}
```

The response contains the assistant's text and an indicator of whether the Gemini AI service was used.

---

## ☁️ Deployment

AeroSage AI uses separate hosting for the frontend and backend.

### Frontend — Vercel

1. Import the GitHub repository into Vercel.
2. Select Vite as the framework.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add the following environment variable:

```env
VITE_API_URL=https://aerosage-api.onrender.com
```

6. Deploy the project.

### Backend — Render

The repository includes a `render.yaml` Blueprint configuration.

Important settings:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check | `/api/health` |
| Node Version | 20 |

Configure the following environment variables in Render:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGIN=https://aerosageai-six.vercel.app
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

Supabase variables are optional if family profile persistence is not required.

---

## 🌐 Data Sources & Transparency

AeroSage AI uses environmental data from Open-Meteo's Geocoding and Air Quality APIs.

**Important data considerations:**

- Air quality information is based on atmospheric model data, not direct measurements from a local ground sensor.
- AQI values are estimated using PM2.5 and PM10 concentrations with CPCB-style breakpoints.
- The displayed AQI should be treated as an indicative estimate, not an official government monitoring-station reading.
- Forecasts and recommendations are informational and should not replace official health advisories or professional medical advice.

---

## 🔮 Future Enhancements

- Interactive pollution maps.
- More advanced predictive pollution analytics.
- Personalized environmental risk notifications.
- Expanded health-oriented recommendations.
- Integration with additional environmental data sources.
- Improved family monitoring and reporting.

---

## 👥 Team

**Team Twinergy**

Built with the vision of making environmental intelligence more accessible, understandable, and actionable.

---

## ❤️ Contributing

Contributions, suggestions, and feedback are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Submit a pull request.

---

## 📄 License

No open-source license has been specified yet. All rights are reserved by the project owner unless a license is added to this repository.

---

### 🌿 AeroSage AI
**Predict Pollution. Protect People. Breathe Smarter.**

*Making every breath a little smarter.*
