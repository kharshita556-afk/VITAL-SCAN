import os
import re
import json
import io
import urllib.request
import urllib.parse
from datetime import datetime
from flask import Flask, render_template, jsonify, request, send_file, current_app
from config import Config
from models import db, Patient, BloodHistory
import google.generativeai as genai
import qrcode

app = Flask(__name__)
app.config.from_object(Config)

# Initialize Database
db.init_app(app)
with app.app_context():
    setup_db()

# Helper function to clean JSON string from Gemini
def clean_json_string(text):
    text = text.strip()
    # Remove markdown code fence if present
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*```$', '', text)
    return text.strip()

# Rule-based fallback clinical analyzer
def fallback_health_prediction(glucose, haemoglobin, cholesterol):
    is_glucose_high = glucose > 140
    is_haemoglobin_low = haemoglobin < 12
    is_cholesterol_high = cholesterol > 200
    
    is_glucose_severe = glucose > 180
    is_haemoglobin_severe = haemoglobin < 10
    is_cholesterol_severe = cholesterol > 240
    
    conditions = []
    remarks_sentences = []
    
    if is_glucose_high:
        if is_glucose_severe:
            conditions.append("Diabetes")
            remarks_sentences.append(f"Severely elevated blood glucose ({glucose} mg/dL) points to high risk of diabetic crisis.")
        else:
            conditions.append("Diabetes")
            remarks_sentences.append(f"Elevated blood glucose ({glucose} mg/dL) suggests impaired glucose control and potential hyperglycemia.")
    
    if is_haemoglobin_low:
        if is_haemoglobin_severe:
            conditions.append("Anemia")
            remarks_sentences.append(f"Critically low haemoglobin ({haemoglobin} g/dL) indicates severe anemia and low blood oxygenation levels.")
        else:
            conditions.append("Anemia")
            remarks_sentences.append(f"Depressed haemoglobin levels ({haemoglobin} g/dL) point to mild anemia and possible fatigue risks.")
            
    if is_cholesterol_high:
        if is_cholesterol_severe:
            conditions.append("Hypercholesterolemia")
            remarks_sentences.append(f"Severely elevated cholesterol ({cholesterol} mg/dL) indicates a profound risk for coronary heart disease.")
        else:
            conditions.append("Hypercholesterolemia")
            remarks_sentences.append(f"Elevated cholesterol ({cholesterol} mg/dL) suggests hypercholesterolemia, posing moderate cardiovascular risks.")
            
    if not conditions:
        condition = "Healthy"
        risk_level = "Normal"
        remarks = "All blood values (Glucose, Haemoglobin, and Cholesterol) lie within normal physiological limits. Continue maintaining a balanced diet and regular physical activity to sustain this healthy status."
    else:
        # Determine main condition
        condition = conditions[0]
        if len(conditions) > 1:
            condition = "Multiple Concerns"
            
        # Determine risk level
        if is_glucose_severe or is_haemoglobin_severe or is_cholesterol_severe or len(conditions) >= 2:
            risk_level = "High Risk"
        else:
            risk_level = "Moderate Risk"
            
        remarks = " ".join(remarks_sentences[:2])
        if len(remarks_sentences) == 1:
            remarks += " Further diagnostic screening and clinical evaluation are highly recommended."
            
    return {
        "remarks": remarks,
        "risk_level": risk_level,
        "condition": condition
    }

# Gemini clinical analyzer using 1.5 Flash
def generate_health_prediction(glucose, haemoglobin, cholesterol):
    api_key = app.config.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: Gemini API Key not found in config. Using fallback rule-based analyzer.")
        return fallback_health_prediction(glucose, haemoglobin, cholesterol)
        
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are a highly precise clinical AI medical expert. Analyze these blood test parameters:
        - Blood Glucose: {glucose} mg/dL (Normal: 70-140 mg/dL)
        - Haemoglobin: {haemoglobin} g/dL (Normal: 12-17.5 g/dL)
        - Total Cholesterol: {cholesterol} mg/dL (Normal: < 200 mg/dL)

        Respond ONLY in the following strict JSON format, with no markdown code fences, no extra text, and no styling. Just raw JSON:
        {{
            "remarks": "Exactly two sentences summarizing the physiological risk, potential concerns, or healthy status based strictly on the provided values.",
            "risk_level": "Normal" or "Moderate Risk" or "High Risk",
            "condition": "Healthy" or "Diabetes" or "Anemia" or "Hypercholesterolemia" or "Multiple Concerns"
        }}
        
        Clinical rules for Risk Level:
        - If any value is severely out of range (Glucose > 180, Cholesterol > 240, Haemoglobin < 10) OR multiple values are abnormal, set risk_level to "High Risk".
        - If any value is moderately out of range (Glucose 141-180, Cholesterol 201-240, Haemoglobin 10-11.9), set risk_level to "Moderate Risk".
        - If all values are normal, set risk_level to "Normal".
        """
        
        response = model.generate_content(prompt)
        cleaned_text = clean_json_string(response.text)
        result = json.loads(cleaned_text)
        
        # Verify required keys exist
        if "remarks" in result and "risk_level" in result and "condition" in result:
            return {
                "remarks": result["remarks"].strip(),
                "risk_level": result["risk_level"].strip(),
                "condition": result["condition"].strip()
            }
        else:
            raise KeyError("Missing required keys from AI response")
            
    except Exception as e:
        print(f"Error during Gemini API analysis: {str(e)}. Using fallback analyzer.")
        return fallback_health_prediction(glucose, haemoglobin, cholesterol)

# ----------------- DB Initialize Helper -----------------
def setup_db():
    with app.app_context():
        db.create_all()
        # Seed test data if database is empty
        if not Patient.query.first():
            test_patients = [
                Patient(
                    full_name="Sarah Jenkins",
                    dob="1985-04-12",
                    email="sarah.j@hospital.org",
                    glucose=115.0,
                    haemoglobin=13.8,
                    cholesterol=185.0,
                    remarks="Glucose and cholesterol levels are in the optimal normal range. General cardiovascular and blood health parameters appear strong.",
                    risk_level="Normal",
                    condition="Healthy"
                ),
                Patient(
                    full_name="Robert Carter",
                    dob="1962-11-23",
                    email="rcarter@medline.net",
                    glucose=195.0,
                    haemoglobin=14.2,
                    cholesterol=210.0,
                    remarks="Severely elevated blood glucose points to significant diabetic concern. Sightly elevated cholesterol also warrants moderate cardiovascular monitoring.",
                    risk_level="High Risk",
                    condition="Diabetes"
                ),
                Patient(
                    full_name="Emily Davis",
                    dob="1998-08-05",
                    email="emilydavis@outlook.com",
                    glucose=95.0,
                    haemoglobin=9.8,
                    cholesterol=170.0,
                    remarks="Critically low haemoglobin points to clear iron-deficiency anemia. Glucose and cholesterol levels remain within highly acceptable normal parameters.",
                    risk_level="High Risk",
                    condition="Anemia"
                )
            ]
            for p in test_patients:
                db.session.add(p)
            db.session.commit()
            print("Database seeded with sample patient data!")

# ----------------- Backend Routes -----------------

@app.route('/')
def index():
    return render_template('base.html')

@app.route('/api/patients', methods=['GET'])
def get_patients():
    patients = Patient.query.order_by(Patient.created_at.desc()).all()
    return jsonify([p.to_dict() for p in patients])

@app.route('/api/patients', methods=['POST'])
def add_patient():
    data = request.json
    
    # Extract fields
    full_name = data.get('full_name', '').strip()
    dob = data.get('dob', '').strip()
    email = data.get('email', '').strip()
    
    # Input validation
    if not full_name or not dob or not email:
        return jsonify({"error": "All fields are required"}), 400
        
    try:
        glucose = float(data.get('glucose'))
        haemoglobin = float(data.get('haemoglobin'))
        cholesterol = float(data.get('cholesterol'))
    except (ValueError, TypeError):
        return jsonify({"error": "Glucose, Haemoglobin, and Cholesterol must be numeric"}), 400

    # AI health prediction
    analysis = generate_health_prediction(glucose, haemoglobin, cholesterol)
    
    new_patient = Patient(
        full_name=full_name,
        dob=dob,
        email=email,
        glucose=glucose,
        haemoglobin=haemoglobin,
        cholesterol=cholesterol,
        remarks=analysis['remarks'],
        risk_level=analysis['risk_level'],
        condition=analysis['condition']
    )
    
    db.session.add(new_patient)
    db.session.commit()
    
    return jsonify({"success": True, "patient": new_patient.to_dict()})

@app.route('/api/patients/<int:patient_id>', methods=['PUT'])
def update_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    data = request.json
    
    # Extract fields
    full_name = data.get('full_name', '').strip()
    dob = data.get('dob', '').strip()
    email = data.get('email', '').strip()
    
    if not full_name or not dob or not email:
        return jsonify({"error": "All fields are required"}), 400
        
    try:
        glucose = float(data.get('glucose'))
        haemoglobin = float(data.get('haemoglobin'))
        cholesterol = float(data.get('cholesterol'))
    except (ValueError, TypeError):
        return jsonify({"error": "Glucose, Haemoglobin, and Cholesterol must be numeric"}), 400

    # Build timeline of blood value updates
    changes = []
    if patient.glucose != glucose:
        changes.append(f"Glucose changed from {patient.glucose} to {glucose}")
    if patient.haemoglobin != haemoglobin:
        changes.append(f"Haemoglobin changed from {patient.haemoglobin} to {haemoglobin}")
    if patient.cholesterol != cholesterol:
        changes.append(f"Cholesterol changed from {patient.cholesterol} to {cholesterol}")

    # Re-run AI analysis if any values changed
    if changes:
        analysis = generate_health_prediction(glucose, haemoglobin, cholesterol)
        patient.remarks = analysis['remarks']
        patient.risk_level = analysis['risk_level']
        patient.condition = analysis['condition']
        
        # Save change log in timeline history
        history_desc = f"Updated blood values: " + ", ".join(changes)
        history_log = BloodHistory(patient_id=patient.id, change_desc=history_desc)
        db.session.add(history_log)

    # General info updates
    patient.full_name = full_name
    patient.dob = dob
    patient.email = email
    patient.glucose = glucose
    patient.haemoglobin = haemoglobin
    patient.cholesterol = cholesterol
    
    db.session.commit()
    return jsonify({"success": True, "patient": patient.to_dict()})

@app.route('/api/patients/<int:patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    db.session.delete(patient)
    db.session.commit()
    return jsonify({"success": True, "message": "Patient record deleted successfully."})

@app.route('/api/preview', methods=['POST'])
def preview_prediction():
    data = request.json
    try:
        glucose = float(data.get('glucose', 0))
        haemoglobin = float(data.get('haemoglobin', 0))
        cholesterol = float(data.get('cholesterol', 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Numeric values only"}), 400
        
    # Use fast rule-based prediction for the instant preview typing feedback
    preview = fallback_health_prediction(glucose, haemoglobin, cholesterol)
    return jsonify(preview)

@app.route('/api/rxnorm/<condition>', methods=['GET'])
def rxnorm_suggestions(condition):
    # Map common conditions to general standard drug listings
    condition_map = {
        "diabetes": ["Metformin", "Glipizide", "Glyburide"],
        "anemia": ["Ferrous Sulfate", "Folic Acid", "Cyanocobalamin"],
        "hypercholesterolemia": ["Atorvastatin", "Simvastatin", "Rosuvastatin"],
        "multiple concerns": ["Metformin", "Atorvastatin", "Ferrous Sulfate"],
        "healthy": []
    }
    
    normalized = condition.lower()
    selected_drugs = []
    
    # Try direct mapping or match sub-conditions
    for key, drugs in condition_map.items():
        if key in normalized:
            selected_drugs = drugs
            break
            
    if not selected_drugs:
        # Default or healthy fallback
        return jsonify({
            "condition": condition,
            "medicines": [],
            "advice": "No specific medications indicated. Maintain a balanced diet, stay hydrated, and perform regular exercise."
        })

    advice_map = {
        "diabetes": "Maintain a low-glycemic, balanced diet. Monitor daily blood glucose readings. Engage in moderate cardiovascular activities 30 minutes daily.",
        "anemia": "Consume iron-rich foods (lean meats, leafy greens). Pair with Vitamin C for optimal absorption. Avoid excessive calcium near iron intake.",
        "hypercholesterolemia": "Adopt a heart-healthy diet low in saturated and trans fats. Increase dietary soluble fibers. Prioritize regular aerobic workouts.",
        "multiple concerns": "Adhere closely to structured dietary adjustments. Monitor glucose and cholesterol levels routinely. Balance exercise with scheduled rest."
    }
    
    advice = advice_map.get(condition.lower(), "Adhere to general healthy lifestyle recommendations and seek personalized advice from a clinician.")
    
    medicines_list = []
    # Fetch live concepts from RxNorm for each selected drug
    for drug in selected_drugs:
        try:
            # Query RxNorm API (no key required)
            url = f"https://rxnav.nlm.nih.gov/REST/drugs.json?name={urllib.parse.quote(drug)}"
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                
                # Check for concept group results
                concept_groups = res_data.get('drugGroup', {}).get('conceptGroup', [])
                rxcui = "N/A"
                standard_name = drug
                
                # Search for SBD (Semantic Branded Drug) or SCD (Semantic Clinical Drug) concepts to get the standard form
                for group in concept_groups:
                    tty = group.get('tty', '')
                    concepts = group.get('conceptProperties', [])
                    if tty in ['SCD', 'MIN'] and concepts:
                        rxcui = concepts[0].get('rxcui', 'N/A')
                        standard_name = concepts[0].get('name', drug)
                        break
                        
                medicines_list.append({
                    "generic_name": drug,
                    "rxnorm_name": standard_name,
                    "rxcui": rxcui
                })
        except Exception as e:
            # Fallback if RxNorm API fails or times out
            medicines_list.append({
                "generic_name": drug,
                "rxnorm_name": f"{drug} (Standard Generic)",
                "rxcui": "API Timeout/Offline"
            })
            
    return jsonify({
        "condition": condition,
        "medicines": medicines_list,
        "advice": advice
    })

@app.route('/patient/<int:patient_id>')
def patient_report(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    # Generate unique Report ID based on date and ID
    date_prefix = patient.created_at.strftime("%Y%m%d") if patient.created_at else datetime.now().strftime("%Y%m%d")
    report_id = f"VS-{date_prefix}-{patient.id:04d}"
    
    return render_template('patient_report.html', patient=patient, report_id=report_id)

@app.route('/patient/<int:patient_id>/qr')
def patient_qr(patient_id):
    # Generates a QR Code directing to the patient details report URL
    report_url = request.host_url + f"patient/{patient_id}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(report_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0d9488", back_color="white")  # Teal styling for medical theme
    
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    
    return send_file(img_io, mimetype='image/png')

# Startup
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
