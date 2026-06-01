# VitalScan | Patient Health Analyzer

**VitalScan** is a medical-grade, full-stack predictive health analyzer and patient registry system designed for hospital management. Powered by **Python Flask**, **SQLite**, and **Gemini 1.5 Flash**, the platform takes patient blood test values (Glucose, Haemoglobin, Cholesterol) and instantly generates 2-sentence clinical risk assessments, automated category flags, dynamic RxNorm medication recommendations, and downloadable hospital-layout patient reports with live QR codes.

---

## Key Clinical Features

1. **Patient Registry (CRUD)**: Log new patient diagnostics, search through rosters, modify existing patient files with active blood value history tracking, and delete logs with confirmation warnings.
2. **AI Health Risk Predictions (Gemini 1.5 Flash)**: Connects to the official `google-generativeai` SDK. When saving or updating a patient, Gemini performs a quick physiological check and saves a two-sentence assessment.
3. **Resilient Local Fallback Engine**: If Gemini is offline, rate-limited, or has an invalid key, the backend dynamically falls back to an expert clinical rule-based engine to prevent app disruption.
4. **Live Preview Predictor**: While typing blood values in the Add Patient form, the frontend queries a rapid-response engine in real-time, providing immediate risk categorization before the form is saved.
5. **Dynamic RxNorm Medication Lookup**: Connects dynamically to the free **US National Library of Medicine (RxNorm) API** to fetch standard generic and branded formulations (along with their exact RxCUI codes) matching the patient's predicted diagnosis.
6. **disease.sh Global Health Statistics**: Connects to the live `disease.sh` endpoint to show real-time active, recovered, cumulative, and fatality epidemiological metrics.
7. **Hospital-Style Printable Reports**: Renders a clinical letterhead format with custom color markers (Red for abnormal, Green for normal metrics). Includes a generated QR code linking directly to the specific patient's portal details page.
8. **One-Click PDF & PNG Export**: Instant client-side generation of clinical documents matching the exact hospital letterhead style using `html2pdf.js` and `html2canvas`.
9. **Roster Export**: Instant CSV download of the complete patient database.
10. **Dual-Theme Design**: Switch between Light Mode (teal & clean clinical white) and Dark Mode (deep navy & slate gray) via a navbar toggle. Styled with a premium responsive layout using the elegant **Poppins** typography.

---

## Technical Stack

- **Backend**: Python Flask, SQLite
- **Database ORM**: Flask-SQLAlchemy
- **AI Engine**: Gemini 1.5 Flash (via `google-generativeai`)
- **APIs**: RxNorm API, disease.sh
- **Frontend**: Bootstrap 5, Chart.js, HTML5, Vanilla CSS, Vanilla JS
- **Export Tools**: html2pdf.js, html2canvas.js, Dynamic QR-Code PNG generator
- **Typography & Icons**: Poppins (Google Fonts), FontAwesome CDN

---

## Project Structure

```
VITAL SCAN/
│
├── app.py                # Main Flask application and API route controller
├── models.py             # Database schemas (Patient, BloodHistory) using SQLAlchemy
├── config.py             # Configuration loader from environment variables
├── requirements.txt      # Python dependencies list
│
├── .env                  # Environment keys (contains Gemini API key)
├── .gitignore            # Git exclusion file
│
├── templates/
│   ├── base.html         # Main dashboard and patient registry layout (SPA tabs)
│   └── patient_report.html # Printable, hospital letterhead layout page
│
└── static/
    ├── css/
    │   └── style.css     # Premium clinical responsive styles & themes (dual mode)
    └── js/
        └── main.js       # Live search, validation, preview, AJAX CRUD, and integrations
```

---

## Quick Setup Instructions

Follow these steps to launch the app on your local system:

### 1. Prerequisites
Ensure you have **Python 3.8+** installed.

### 2. Install Dependencies
Open your command terminal in the project directory and run:
```bash
pip install -r requirements.txt
```

### 3. Setup Gemini API Key
The application will look for your Gemini API key in a `.env` file in the root folder. A `.env` file has been pre-configured for you:
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
FLASK_ENV=development
SECRET_KEY=vitalscan-secret-key-2026
```

### 4. Run the Application
Start the Flask local web server by executing a single command:
```bash
python app.py
```

### 5. Access the Portal
Once launched, open your web browser and navigate to:
```
http://127.0.0.1:5000
```
*The SQLite database is initialized and pre-seeded with sample clinical patient records upon startup.*
