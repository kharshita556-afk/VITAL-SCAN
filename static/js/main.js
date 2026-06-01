/* ==========================================================================
   VitalScan Frontend Controller - Tab Navigation, CRUD, Charts & Integrations
   ========================================================================== */

// Global State
let patientsList = [];
let riskDistributionChart = null;
let currentTheme = localStorage.getItem("vitalscan-theme") || "light";

// Document Elements
document.addEventListener("DOMContentLoaded", () => {
    // Initialize Theme
    initTheme();

    // Start Live Clock
    initClock();

    // Load Initial Data
    fetchPatients();
    fetchGlobalStats();

    // Tab Navigation Binding
    initTabNavigation();

    // Event Listeners Setup
    setupEventListeners();
});

// ----------------- Theme Switch Management -----------------
function initTheme() {
    document.documentElement.setAttribute("data-theme", currentTheme);
    const themeBtn = document.getElementById("themeToggleBtn");
    
    // Update theme button icon
    if (currentTheme === "dark") {
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}

function toggleTheme() {
    const themeBtn = document.getElementById("themeToggleBtn");
    if (currentTheme === "light") {
        currentTheme = "dark";
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        currentTheme = "light";
        themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("vitalscan-theme", currentTheme);
}

// ----------------- Live Navbar Clock -----------------
function initClock() {
    const clockEl = document.getElementById("liveClock");
    
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        let seconds = now.getSeconds();
        
        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        
        clockEl.innerText = `${hours}:${minutes}:${seconds}`;
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

// ----------------- Tab Panels Swapping -----------------
function initTabNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const dashboardPanel = document.getElementById("dashboardPanel");
    const patientsPanel = document.getElementById("patientsPanel");
    
    const currentTabTitle = document.getElementById("currentTabTitle");
    const currentTabSubtitle = document.getElementById("currentTabSubtitle");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            
            // Do not switch if already active
            if (link.classList.contains("active")) return;
            
            // Remove active classes from all links
            navLinks.forEach(l => l.classList.remove("active"));
            
            // Set active class on clicked link
            link.classList.add("active");
            
            const selectedTab = link.getAttribute("data-tab");
            
            // Toggle active-panel class on the sections cleanly
            dashboardPanel.classList.remove("active-panel");
            patientsPanel.classList.remove("active-panel");
            
            if (selectedTab === "dashboard") {
                dashboardPanel.classList.add("active-panel");
                
                currentTabTitle.innerText = "Clinical Dashboard";
                currentTabSubtitle.innerText = "Monitor patient health anomalies & predictive diagnostics";
                
                // Re-draw chart on active swap
                renderChart();
            } else if (selectedTab === "patients") {
                patientsPanel.classList.add("active-panel");
                
                currentTabTitle.innerText = "Patient Records Registry";
                currentTabSubtitle.innerText = "Manage patient rosters, clinical reports, and medical histories";
            }
        });
    });

    // Special quick navigation from dashboard button to patient table
    document.getElementById("btnGoToAllPatients").addEventListener("click", () => {
        const patientsNavLink = document.querySelector('[data-tab="patients"]');
        if (patientsNavLink) patientsNavLink.click();
    });
}

// ----------------- Events Listeners Setup -----------------
function setupEventListeners() {
    // Theme toggle action
    document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

    // Live search listener
    document.getElementById("patientSearchInput").addEventListener("input", handleSearch);

    // CSV Export Action
    document.getElementById("btnExportCSV").addEventListener("click", exportToCSV);

    // Forms validation & submissions
    const addForm = document.getElementById("addPatientForm");
    addForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (validateForm(addForm, "add")) {
            submitAddPatient();
        }
    });

    const editForm = document.getElementById("editPatientForm");
    editForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (validateForm(editForm, "edit")) {
            submitEditPatient();
        }
    });

    // Delete confirm action
    document.getElementById("btnConfirmDelete").addEventListener("click", submitDeletePatient);

    // Add Patient Form live predictions keystroke events
    const addBloodFields = ["addGlucose", "addHaemoglobin", "addCholesterol"];
    addBloodFields.forEach(id => {
        document.getElementById(id).addEventListener("keyup", debounceLivePreview);
    });

    // Reset Add Form and Live Preview Box when modal closes
    document.getElementById("addPatientModal").addEventListener("hidden.bs.modal", () => {
        addForm.reset();
        addForm.classList.remove("was-validated");
        
        // Reset preview
        document.getElementById("previewRiskBadge").innerText = "Enter details";
        document.getElementById("previewRiskBadge").className = "badge bg-teal text-white small px-2 py-0.5 rounded-pill";
        document.getElementById("previewPredictionRemarks").innerText = "Complete the blood metrics to view real-time diagnostic estimations before saving.";
    });
}

// ----------------- Inline Form Validation -----------------
function validateForm(formElement, prefix) {
    let isValid = true;

    const emailInput = document.getElementById(`${prefix}Email`);
    const dobInput = document.getElementById(`${prefix}Dob`);
    const glucoseInput = document.getElementById(`${prefix}Glucose`);
    const haemoglobinInput = document.getElementById(`${prefix}Haemoglobin`);
    const cholesterolInput = document.getElementById(`${prefix}Cholesterol`);

    // Reset validations
    formElement.classList.remove("was-validated");
    document.querySelectorAll(".invalid-feedback").forEach(el => el.style.display = "none");

    // Email Validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value.trim())) {
        isValid = false;
        emailInput.classList.add("is-invalid");
        document.getElementById(`${prefix}EmailError`).style.display = "block";
    } else {
        emailInput.classList.remove("is-invalid");
    }

    // DOB Validation (cannot be a future date)
    const dobDate = new Date(dobInput.value);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (!dobInput.value || dobDate > today) {
        isValid = false;
        dobInput.classList.add("is-invalid");
        document.getElementById(`${prefix}DobError`).style.display = "block";
    } else {
        dobInput.classList.remove("is-invalid");
    }

    // Blood values validations (numeric only)
    const numericRegex = /^\d+(\.\d+)?$/;

    [
        { input: glucoseInput, label: "Glucose" },
        { input: haemoglobinInput, label: "Haemoglobin" },
        { input: cholesterolInput, label: "Cholesterol" }
    ].forEach(item => {
        const val = item.input.value.trim();
        if (!val || !numericRegex.test(val) || parseFloat(val) <= 0) {
            isValid = false;
            item.input.classList.add("is-invalid");
            item.input.parentElement.nextElementSibling.style.display = "block";
        } else {
            item.input.classList.remove("is-invalid");
        }
    });

    return isValid;
}

// ----------------- CRUD Operations -----------------

// 1. Fetch Patients from Backend
function fetchPatients() {
    const tableBody = document.getElementById("patientsTableBody");
    
    fetch("/api/patients")
        .then(res => res.json())
        .then(data => {
            patientsList = data;
            
            // Render UI lists
            renderPatientsTable(data);
            renderRecentTable(data);
            
            // Recalculate and update stats cards
            updateStatsCards(data);
            
            // Re-render risk distribution chart
            renderChart();
        })
        .catch(err => {
            console.error("Error fetching clinical registry:", err);
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4"><i class="fa-solid fa-circle-exclamation me-2"></i>Failed to fetch clinical records from server.</td></tr>`;
        });
}

// Render Patients table
function renderPatientsTable(list) {
    const tableBody = document.getElementById("patientsTableBody");
    tableBody.innerHTML = "";
    
    if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5"><i class="fa-regular fa-folder-open me-2 fs-4 d-block mb-2"></i>No patient logs stored in database yet.</td></tr>`;
        return;
    }

    list.forEach(patient => {
        const row = document.createElement("tr");
        
        // Custom blood indicator stylings
        const glucoseClass = patient.glucose > 140 ? "indicator-danger" : "indicator-normal";
        const haemoglobinClass = patient.haemoglobin < 12 ? "indicator-danger" : "indicator-normal";
        const cholesterolClass = patient.cholesterol > 200 ? "indicator-danger" : "indicator-normal";

        // Risk badge configurations
        let badgeColorClass = "badge-normal-risk";
        if (patient.risk_level === "High Risk") badgeColorClass = "badge-high-risk";
        else if (patient.risk_level === "Moderate Risk") badgeColorClass = "badge-moderate-risk";

        row.innerHTML = `
            <td class="ps-4 fw-semibold text-teal-dark">${escapeHtml(patient.full_name)}</td>
            <td><a href="mailto:${escapeHtml(patient.email)}" class="text-decoration-none text-muted">${escapeHtml(patient.email)}</a></td>
            <td>${escapeHtml(patient.dob)} <small class="text-muted">(${patient.age} yrs)</small></td>
            <td class="text-center fw-semibold"><span class="${glucoseClass}">${patient.glucose}</span></td>
            <td class="text-center fw-semibold"><span class="${haemoglobinClass}">${patient.haemoglobin}</span></td>
            <td class="text-center fw-semibold"><span class="${cholesterolClass}">${patient.cholesterol}</span></td>
            <td class="text-center"><span class="custom-risk-badge ${badgeColorClass}">${patient.risk_level}</span></td>
            <td class="small text-muted">${patient.created_at}</td>
            <td class="text-end pe-4">
                <div class="d-flex justify-content-end gap-1.5">
                    <button class="btn btn-teal-secondary btn-sm" onclick="showPrescription(${patient.id})" title="View Reference Prescription"><i class="fa-solid fa-prescription-bottle-medical"></i></button>
                    <a href="/patient/${patient.id}" class="btn btn-teal-secondary btn-sm" title="View Printable Medical Report"><i class="fa-solid fa-print"></i></a>
                    <button class="btn btn-teal-secondary btn-sm text-teal-dark" onclick="openEditModal(${patient.id})" title="Edit Details"><i class="fa-solid fa-edit"></i></button>
                    <button class="btn btn-teal-secondary btn-sm text-danger" onclick="openDeleteModal(${patient.id}, '${escapeHtml(patient.full_name)}')" title="Delete Record"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Render Dashboard mini table (last 5 entries)
function renderRecentTable(list) {
    const tableBody = document.getElementById("recentPatientsTableBody");
    tableBody.innerHTML = "";
    
    // Slice last 5
    const recent = list.slice(0, 5);
    
    if (recent.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No diagnostic logs logged yet.</td></tr>`;
        return;
    }

    recent.forEach(patient => {
        const row = document.createElement("tr");

        const glucoseClass = patient.glucose > 140 ? "indicator-danger" : "indicator-normal";
        const haemoglobinClass = patient.haemoglobin < 12 ? "indicator-danger" : "indicator-normal";
        const cholesterolClass = patient.cholesterol > 200 ? "indicator-danger" : "indicator-normal";

        let badgeColorClass = "badge-normal-risk";
        if (patient.risk_level === "High Risk") badgeColorClass = "badge-high-risk";
        else if (patient.risk_level === "Moderate Risk") badgeColorClass = "badge-moderate-risk";

        row.innerHTML = `
            <td class="fw-semibold text-teal-dark ps-3">${escapeHtml(patient.full_name)}</td>
            <td>${patient.age} yrs</td>
            <td class="text-center fw-semibold"><span class="${glucoseClass}">${patient.glucose}</span></td>
            <td class="text-center fw-semibold"><span class="${haemoglobinClass}">${patient.haemoglobin}</span></td>
            <td class="text-center fw-semibold"><span class="${cholesterolClass}">${patient.cholesterol}</span></td>
            <td class="text-center"><span class="custom-risk-badge ${badgeColorClass}">${patient.risk_level}</span></td>
            <td class="text-end text-muted pe-3 small">${patient.created_at}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Update Stats Cards counting numbers
function updateStatsCards(list) {
    const total = list.length;
    const highRisk = list.filter(p => p.risk_level === "High Risk").length;
    const normal = list.filter(p => p.risk_level === "Normal").length;
    
    // Calculate Today's entries
    const todayStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const todayEntries = list.filter(p => p.created_at && p.created_at.startsWith(todayStr)).length;

    document.getElementById("statTotalPatients").innerText = total;
    document.getElementById("statHighRiskPatients").innerText = highRisk;
    document.getElementById("statNormalPatients").innerText = normal;
    document.getElementById("statTodayEntries").innerText = todayEntries;
}

// 2. Add New Patient AJAX
function submitAddPatient() {
    toggleLoadingOverlay(true);
    
    const payload = {
        full_name: document.getElementById("addFullName").value.trim(),
        email: document.getElementById("addEmail").value.trim(),
        dob: document.getElementById("addDob").value,
        glucose: parseFloat(document.getElementById("addGlucose").value),
        haemoglobin: parseFloat(document.getElementById("addHaemoglobin").value),
        cholesterol: parseFloat(document.getElementById("addCholesterol").value)
    };

    fetch("/api/patients", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(resData => {
        toggleLoadingOverlay(false);
        if (resData.success) {
            // Close Modal
            const modalEl = document.getElementById("addPatientModal");
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            // Refresh table & display success toast
            fetchPatients();
            showToast("Diagnostic record for " + payload.full_name + " logged successfully!");
        } else {
            alert("Error: " + (resData.error || "Failed to log patient."));
        }
    })
    .catch(err => {
        toggleLoadingOverlay(false);
        console.error("Add patient post failed:", err);
        alert("Server communication error. Please try again.");
    });
}

// 3. Edit Patient Modals
function openEditModal(id) {
    const patient = patientsList.find(p => p.id === id);
    if (!patient) return;

    // Prefill fields
    document.getElementById("editPatientId").value = patient.id;
    document.getElementById("editFullName").value = patient.full_name;
    document.getElementById("editEmail").value = patient.email;
    document.getElementById("editDob").value = patient.dob;
    document.getElementById("editGlucose").value = patient.glucose;
    document.getElementById("editHaemoglobin").value = patient.haemoglobin;
    document.getElementById("editCholesterol").value = patient.cholesterol;

    // Timeline changes list rendering
    const historyList = document.getElementById("editHistoryList");
    historyList.innerHTML = "";

    if (patient.history && patient.history.length > 0) {
        document.getElementById("editTimelineSection").style.display = "block";
        patient.history.forEach(log => {
            const li = document.createElement("li");
            li.className = "timeline-item text-start";
            li.innerHTML = `
                <div class="timeline-time"><i class="fa-solid fa-calendar-day me-1"></i>${log.changed_at}</div>
                <div class="timeline-text fw-medium text-teal-dark">${escapeHtml(log.change_desc)}</div>
            `;
            historyList.appendChild(li);
        });
    } else {
        // No updates yet
        document.getElementById("editTimelineSection").style.display = "block";
        historyList.innerHTML = `<li class="text-muted small py-2"><i class="fa-solid fa-seedling me-1"></i>No previous blood updates. Record is in its original logged state.</li>`;
    }

    // Open Modal
    const modalEl = document.getElementById("editPatientModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function submitEditPatient() {
    toggleLoadingOverlay(true);
    const id = document.getElementById("editPatientId").value;
    
    const payload = {
        full_name: document.getElementById("editFullName").value.trim(),
        email: document.getElementById("editEmail").value.trim(),
        dob: document.getElementById("editDob").value,
        glucose: parseFloat(document.getElementById("editGlucose").value),
        haemoglobin: parseFloat(document.getElementById("editHaemoglobin").value),
        cholesterol: parseFloat(document.getElementById("editCholesterol").value)
    };

    fetch(`/api/patients/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(resData => {
        toggleLoadingOverlay(false);
        if (resData.success) {
            const modalEl = document.getElementById("editPatientModal");
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            fetchPatients();
            showToast("Diagnostic record for " + payload.full_name + " updated successfully!");
        } else {
            alert("Error: " + (resData.error || "Failed to update record."));
        }
    })
    .catch(err => {
        toggleLoadingOverlay(false);
        console.error("Update patient failed:", err);
        alert("Server communication error. Please try again.");
    });
}

// 4. Delete Patient Modals
function openDeleteModal(id, name) {
    document.getElementById("deletePatientId").value = id;
    document.getElementById("deletePatientName").innerText = name;

    const modalEl = document.getElementById("deleteConfirmModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function submitDeletePatient() {
    const id = document.getElementById("deletePatientId").value;
    const name = document.getElementById("deletePatientName").innerText;

    fetch(`/api/patients/${id}`, {
        method: "DELETE"
    })
    .then(res => res.json())
    .then(resData => {
        const modalEl = document.getElementById("deleteConfirmModal");
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        if (resData.success) {
            fetchPatients();
            showToast("Patient record of " + name + " has been deleted from clinical registry.");
        } else {
            alert("Error: " + (resData.error || "Failed to delete patient."));
        }
    })
    .catch(err => {
        console.error("Delete patient failed:", err);
        alert("Server communication error.");
    });
}

// ----------------- Debounced Live Predictions Preview -----------------
let previewTimer = null;

function debounceLivePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(triggerLivePreviewFetch, 400);
}

function triggerLivePreviewFetch() {
    const glucoseVal = document.getElementById("addGlucose").value.trim();
    const haemoglobinVal = document.getElementById("addHaemoglobin").value.trim();
    const cholesterolVal = document.getElementById("addCholesterol").value.trim();

    // Check if blood values are positive numeric
    const numRegex = /^\d+(\.\d+)?$/;
    if (!numRegex.test(glucoseVal) || !numRegex.test(haemoglobinVal) || !numRegex.test(cholesterolVal)) {
        // Values incomplete or invalid
        return;
    }

    const payload = {
        glucose: parseFloat(glucoseVal),
        haemoglobin: parseFloat(haemoglobinVal),
        cholesterol: parseFloat(cholesterolVal)
    };

    // Show preview mini loader
    const loader = document.getElementById("previewLoader");
    loader.classList.remove("d-none");

    fetch("/api/preview", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        loader.classList.add("d-none");
        if (data.remarks && data.risk_level) {
            // Update remarks
            document.getElementById("previewPredictionRemarks").innerText = data.remarks;
            
            // Update badge color
            const badge = document.getElementById("previewRiskBadge");
            badge.innerText = data.risk_level;
            
            // Risk colors mapping
            if (data.risk_level === "High Risk") {
                badge.className = "badge bg-danger text-white small px-2 py-0.5 rounded-pill animate-pulse";
            } else if (data.risk_level === "Moderate Risk") {
                badge.className = "badge bg-warning text-dark small px-2 py-0.5 rounded-pill";
            } else {
                badge.className = "badge bg-success text-white small px-2 py-0.5 rounded-pill";
            }
        }
    })
    .catch(err => {
        loader.classList.add("d-none");
        console.error("Live preview estimation failed:", err);
    });
}

// ----------------- Prescription suggestion with RxNorm API -----------------
function showPrescription(patientId) {
    const patient = patientsList.find(p => p.id === patientId);
    if (!patient) return;

    document.getElementById("prescRemarksText").innerText = `"${patient.remarks}"`;
    const drugsContainer = document.getElementById("rxnormMedicinesList");
    const adviceContainer = document.getElementById("rxnormAdviceText");

    drugsContainer.innerHTML = `
        <div class="text-center py-3 text-muted">
            <div class="spinner-border spinner-border-sm text-teal me-1.5" role="status"></div>
            Searching RxNorm catalog...
        </div>
    `;
    adviceContainer.innerText = "Consulting standard guidelines...";

    // Fetch RxNorm Suggestions from backend route
    fetch(`/api/rxnorm/${encodeURIComponent(patient.condition || "healthy")}`)
        .then(res => res.json())
        .then(data => {
            drugsContainer.innerHTML = "";
            
            if (data.medicines && data.medicines.length > 0) {
                data.medicines.forEach(drug => {
                    const li = document.createElement("li");
                    li.className = "drug-item d-flex justify-content-between align-items-center";
                    li.innerHTML = `
                        <div>
                            <span class="d-block text-teal-dark fw-bold"><i class="fa-solid fa-capsules me-1.5"></i>${escapeHtml(drug.generic_name)}</span>
                            <span class="drug-itemSmall text-muted d-block">${escapeHtml(drug.rxnorm_name)}</span>
                        </div>
                        <span class="badge bg-teal-soft text-teal-dark border small">CUI: ${escapeHtml(drug.rxcui)}</span>
                    `;
                    drugsContainer.appendChild(li);
                });
            } else {
                // If Healthy / Normal
                drugsContainer.innerHTML = `
                    <div class="alert alert-success border-0 bg-green-soft text-teal-dark p-2.5 rounded-3 d-flex align-items-center mb-0" style="font-size: 13.5px;">
                        <i class="fa-solid fa-circle-check me-2 fs-5"></i>
                        No dynamic medications needed. Standard healthy lifestyle recommended.
                    </div>
                `;
            }
            
            adviceContainer.innerText = data.advice || "No specific guidelines recorded.";
        })
        .catch(err => {
            console.error("RxNorm reference fetch failed:", err);
            drugsContainer.innerHTML = `<div class="text-danger small py-2"><i class="fa-solid fa-circle-exclamation me-1.5"></i>Failed to fetch RxNorm library concepts.</div>`;
            adviceContainer.innerText = "General clinical counseling suggested.";
        });

    // Open Modal
    const modalEl = document.getElementById("prescriptionModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// ----------------- disease.sh Global Stats Fetching -----------------
function fetchGlobalStats() {
    // Queries free disease.sh statistics API (no key required)
    fetch("https://disease.sh/v3/covid-19/all")
        .then(res => {
            if (!res.ok) throw new Error("HTTP error: " + res.status);
            return res.json();
        })
        .then(data => {
            document.getElementById("globalActiveCases").innerText = formatNumber(data.active);
            document.getElementById("globalRecovered").innerText = formatNumber(data.recovered);
            document.getElementById("globalTotalCases").innerText = formatNumber(data.cases);
            document.getElementById("globalDeaths").innerText = formatNumber(data.deaths);
        })
        .catch(err => {
            console.error("disease.sh API call failed:", err);
            document.getElementById("globalActiveCases").innerText = "Offline";
            document.getElementById("globalRecovered").innerText = "Offline";
            document.getElementById("globalTotalCases").innerText = "Offline";
            document.getElementById("globalDeaths").innerText = "Offline";
        });
}

// ----------------- Export patient rosters to CSV -----------------
function exportToCSV() {
    if (patientsList.length === 0) {
        alert("The clinical registry is empty. Nothing to export!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    csvContent += "Report ID,Patient Name,Date of Birth,Age,Email Address,Glucose (mg/dL),Haemoglobin (g/dL),Cholesterol (mg/dL),AI Risk Category,AI Diagnostic remarks,Logged Date\n";

    // Rows
    patientsList.forEach(patient => {
        const date_prefix = patient.created_at ? patient.created_at.replaceAll('-', '').replaceAll(' ', '').replaceAll(':', '').slice(0,8) : "2026";
        const report_id = `VS-${date_prefix}-${String(patient.id).padStart(4, '0')}`;
        
        // Escape strings for CSV
        const escapedName = `"${patient.full_name.replaceAll('"', '""')}"`;
        const escapedRemarks = `"${patient.remarks.replaceAll('"', '""')}"`;
        const escapedEmail = `"${patient.email.replaceAll('"', '""')}"`;

        const row = [
            report_id,
            escapedName,
            patient.dob,
            patient.age,
            escapedEmail,
            patient.glucose,
            patient.haemoglobin,
            patient.cholesterol,
            patient.risk_level,
            escapedRemarks,
            patient.created_at
        ].join(",");
        
        csvContent += row + "\n";
    });

    // Create download element
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VitalScan_Patient_Registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ----------------- Table Live Search Filter -----------------
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        // Render full list if query is empty
        renderPatientsTable(patientsList);
        return;
    }

    const filtered = patientsList.filter(patient => {
        return patient.full_name.toLowerCase().includes(query) ||
               patient.email.toLowerCase().includes(query) ||
               (patient.remarks && patient.remarks.toLowerCase().includes(query)) ||
               patient.dob.includes(query);
    });

    renderPatientsTable(filtered);
}

// ----------------- Chart.js Rendering -----------------
function renderChart() {
    const canvas = document.getElementById("riskDistributionChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Recalculate totals
    const high = patientsList.filter(p => p.risk_level === "High Risk").length;
    const moderate = patientsList.filter(p => p.risk_level === "Moderate Risk").length;
    const normal = patientsList.filter(p => p.risk_level === "Normal").length;

    // Destroy existing chart instance first
    if (riskDistributionChart) {
        riskDistributionChart.destroy();
    }

    // Handle empty state chart representation
    const emptyState = (high === 0 && moderate === 0 && normal === 0);
    const chartLabels = emptyState ? ["No Data Recorded"] : ["High Risk", "Moderate Risk", "Normal"];
    const chartData = emptyState ? [1] : [high, moderate, normal];
    const chartColors = emptyState ? ["#e2e8f0"] : ["#ef4444", "#f59e0b", "#10b981"];

    // Initialize new Chart instance
    riskDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: currentTheme === "dark" ? 2 : 1,
                borderColor: currentTheme === "dark" ? "#1f2937" : "#ffffff",
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: currentTheme === "dark" ? "#f3f4f6" : "#0f172a",
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 11,
                            weight: '500'
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    enabled: !emptyState,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const total = high + moderate + normal;
                            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                            return ` ${context.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// ----------------- UI Helpers & Utilities -----------------
function toggleLoadingOverlay(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (show) {
        overlay.classList.remove("d-none");
    } else {
        overlay.classList.add("d-none");
    }
}

function showToast(message) {
    document.getElementById("successToastText").innerText = message;
    const toastEl = document.getElementById("successToast");
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

function formatNumber(num) {
    if (!num) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
