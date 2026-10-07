import { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "./App.css";
import InteractionGraph from "./InteractionGraph";
import Analytics from "./Analytics";
import ProfilePage from "./ProfilePage";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const API_URL_MANUAL = "http://127.0.0.1:8000/check-interactions";
const API_URL_EXTRACT = "http://127.0.0.1:8000/extract-and-check";
const API_URL_OCR = "http://127.0.0.1:8000/ocr-and-check";
const API_URL_DICT = "http://127.0.0.1:8000/dictionary";
const API_URL_PROFILES = "http://127.0.0.1:8000/profiles";

function ConfidenceBadge({ confidence }) {
  const label =
    confidence === "exact"
      ? "Direct match"
      : confidence === "class_fallback"
      ? "Class-level"
      : "No match";
  const cls =
    confidence === "exact"
      ? "confidence-badge confidence-badge--exact"
      : confidence === "class_fallback"
      ? "confidence-badge confidence-badge--class"
      : "confidence-badge confidence-badge--none";
  return <span className={cls}>{label}</span>;
}

function ExplanationToggle({ result }) {
  const [audience, setAudience] = useState("patient");
  const text =
    audience === "patient" ? result.patient_explanation : result.doctor_explanation;

  if (!result.doctor_explanation && !result.patient_explanation) return null;

  return (
    <div className="explanation-block">
      <div className="explanation-toggle">
        <button
          type="button"
          className={audience === "patient" ? "toggle-btn toggle-btn--active" : "toggle-btn"}
          onClick={() => setAudience("patient")}
        >
          For Patients
        </button>
        <button
          type="button"
          className={audience === "doctor" ? "toggle-btn toggle-btn--active" : "toggle-btn"}
          onClick={() => setAudience("doctor")}
        >
          For Doctors
        </button>
      </div>
      <div className="explanation-text">
        {text.split('\n\n').map((paragraph, idx) => {
          // Simple bold rendering for **text**
          const parts = paragraph.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={idx} style={{ marginBottom: "10px" }}>
              {parts.map((part, pIdx) => 
                part.startsWith('**') && part.endsWith('**') 
                  ? <strong key={pIdx}>{part.slice(2, -2)}</strong>
                  : part
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBreakdown({ breakdown }) {
  const [open, setOpen] = useState(false);
  if (!breakdown) return null;

  const rows = Object.entries(breakdown).map(([key, detail]) => {
    const label = key.replace(/_/g, " ");
    const pts = detail.points;
    return { key, label, pts, detail };
  });

  return (
    <div className="score-breakdown">
      <button
        type="button"
        className="score-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide" : "Show"} score breakdown
      </button>
      {open && (
        <table className="score-table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="score-table__label">{row.label}</td>
                <td className={`score-table__points ${row.pts < 0 ? "score-table__points--neg" : ""}`}>
                  {row.pts > 0 ? "+" : ""}{row.pts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RiskGauge({ score }) {
  const data = [
    { name: "Score", value: score },
    { name: "Remainder", value: 100 - score }
  ];
  const color = score >= 70 ? "#c0392b" : score >= 40 ? "#b5790a" : "#2f7d4f";

  return (
    <div style={{ width: 120, height: 60, position: "relative" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={40}
            outerRadius={55}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="#e2e8f0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", bottom: 0, width: "100%", textAlign: "center", fontSize: "18px", fontWeight: "bold", color: color }}>
        {score}
      </div>
    </div>
  );
}

function MechanismFlowchart({ drug1, drug2, severity }) {
  const color = severity === "High" ? "#c0392b" : severity === "Moderate" ? "#b5790a" : "#2f7d4f";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", margin: "20px 0", padding: "20px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
      <div style={{ padding: "10px 16px", background: "white", border: "2px solid #94a3b8", borderRadius: "6px", fontWeight: "bold", textAlign: "center", width: "120px" }}>
        {drug1}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#64748b" }}>
        <span style={{ fontSize: "20px" }}>→</span>
        <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" }}>Interacts with</span>
      </div>
      <div style={{ padding: "12px", background: color, color: "white", borderRadius: "50%", width: "80px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: "12px", fontWeight: "bold", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        {severity} Risk
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#64748b" }}>
        <span style={{ fontSize: "20px" }}>←</span>
        <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" }}>Interacts with</span>
      </div>
      <div style={{ padding: "10px 16px", background: "white", border: "2px solid #94a3b8", borderRadius: "6px", fontWeight: "bold", textAlign: "center", width: "120px" }}>
        {drug2}
      </div>
    </div>
  );
}

function ResultCard({ result }) {
  if (!result.found) {
    return (
      <div className="result-card" style={{ borderLeft: "4px solid #10b981", background: "#ecfdf5" }}>
        <div className="result-card__header">
          {result.drug_1} + {result.drug_2}
          <span style={{ marginLeft: "10px", fontSize: "12px", background: "#10b981", color: "white", padding: "4px 8px", borderRadius: "4px" }}>
            SAFE / HARMLESS
          </span>
        </div>
        <p className="result-card__note" style={{ color: "#065f46" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'text-bottom', marginRight: '6px' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          No known interaction found in our medical database. Based on available data, this combination is generally considered safe and harmless.
        </p>
      </div>
    );
  }
  const displaySeverity = result.computed_severity || result.severity;

  return (
    <div className="result-card" data-severity={displaySeverity}>
      <div className="result-card__header">
        {result.drug_1} + {result.drug_2}
        <ConfidenceBadge confidence={result.confidence} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div className="result-card__meta" style={{ margin: 0 }}>
          <span className="severity-pill">{displaySeverity} severity</span>
          <span className="relation-type">{result.relation_type}</span>
          <span className="mention-count">
            seen {result.mention_count} time{result.mention_count === 1 ? "" : "s"} in source data
          </span>
        </div>
        {result.severity_score !== undefined && (
          <RiskGauge score={result.severity_score} />
        )}
      </div>

      <ScoreBreakdown breakdown={result.score_breakdown} />
      
      <MechanismFlowchart drug1={result.drug_1} drug2={result.drug_2} severity={displaySeverity} />

      {result.evidence_sentence && (
        <p className="evidence">“{result.evidence_sentence}”</p>
      )}

      <ExplanationToggle result={result} />

      {result.note && <p className="result-card__note">{result.note}</p>}

      <div className="normalized-info">
        <span>
          {result.drug_1} → {result.drug_1_normalized.normalized}
          {result.drug_1_normalized.match_type !== "assumed_generic" &&
            ` (${result.drug_1_normalized.match_type})`}
        </span>
        <span>
          {result.drug_2} → {result.drug_2_normalized.normalized}
          {result.drug_2_normalized.match_type !== "assumed_generic" &&
            ` (${result.drug_2_normalized.match_type})`}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("manual"); // "manual" | "note" | "image"
  const [drugsInput, setDrugsInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [dictionary, setDictionary] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [profiles, setProfiles] = useState([]);
  useEffect(() => {
    axios.get(API_URL_DICT).then(res => setDictionary(res.data.words || [])).catch(() => {});
    fetchProfiles();
  }, []);

  function fetchProfiles() {
    axios.get(API_URL_PROFILES).then(res => setProfiles(res.data || [])).catch(() => {});
  }

  const handleDrugsInputChange = (e) => {
    const val = e.target.value;
    setDrugsInput(val);
    
    // Autocomplete logic for the last token
    const parts = val.split(",");
    const lastPart = parts[parts.length - 1].trimStart();
    if (lastPart.length > 1) {
      const filtered = dictionary.filter(w => w.toLowerCase().startsWith(lastPart.toLowerCase())).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (word) => {
    const parts = drugsInput.split(",");
    parts.pop(); // remove the partial word
    const newStr = parts.join(",") + (parts.length > 0 ? ", " : "") + word + ", ";
    setDrugsInput(newStr);
    setShowSuggestions(false);
  };

  const [activeProfile, setActiveProfile] = useState(null);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 110, 98); // Teal header background
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("MedGaurd AI", 20, 20);
    
    // Patient Info or General Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    let y = 45;
    if (activeProfile) {
      doc.text("Personal Medication Safety Report", 20, y);
      y += 10;
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Patient: ${activeProfile.name}`, 20, y);
      if (activeProfile.age || activeProfile.gender) doc.text(`Demographics: ${activeProfile.age || "-"} yrs, ${activeProfile.gender || "-"}`, 90, y);
      y += 6;
      if (activeProfile.allergies) {
        doc.setTextColor(185, 28, 28);
        doc.text(`Allergies: ${activeProfile.allergies}`, 20, y);
      }
      doc.setTextColor(0, 0, 0);
      y += 15;
    } else {
      doc.text("Medication Safety Report", 20, y);
      y += 15;
    }

    // Summary Box
    doc.setFillColor(240, 248, 255);
    doc.rect(20, y - 5, 170, 25, 'F');
    doc.setFontSize(12);
    doc.text(`Medications Checked: ${response.drug_count}`, 25, y + 2);
    doc.text(`Potential Interactions Found: ${response.interactions_found}`, 25, y + 12);
    y += 35;
    
    response.results.forEach((r, idx) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Interaction Title
      doc.setFontSize(14);
      if (r.found && r.severity === "High") doc.setTextColor(192, 57, 43); // Red
      else if (r.found && r.severity === "Moderate") doc.setTextColor(181, 121, 10); // Yellow/Orange
      else doc.setTextColor(47, 125, 79); // Green
      
      doc.text(`${idx + 1}. ${r.drug_1} + ${r.drug_2}`, 20, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      if (r.found) {
        doc.text(`Severity: ${r.severity} (Risk Score: ${r.severity_score || 'N/A'}/100)`, 20, y);
        y += 8;
        
        // Patient Explanation
        doc.setTextColor(0, 0, 0);
        const explanation = r.patient_explanation || r.evidence_sentence || "No detailed explanation available.";
        const lines = doc.splitTextToSize(`Advice: ${explanation}`, 170);
        doc.text(lines, 20, y);
        y += lines.length * 6;
      } else {
        doc.text(`No known major interactions found in our database.`, 20, y);
        y += 8;
      }
      y += 10;
    });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by MedGaurd AI. Always consult a healthcare professional before changing medications.", 20, 285);

    doc.save(`${activeProfile ? activeProfile.name.replace(/\s+/g, '_') : 'MedGaurd'}_Interaction_Report.pdf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResponse(null);

    setLoading(true);
    try {
      let res;
      if (mode === "manual") {
        const drugs = drugsInput
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean);

        if (drugs.length < 2) {
          setError("Enter at least 2 drug names, separated by commas.");
          setLoading(false);
          return;
        }
        res = await axios.post(API_URL_MANUAL, { drugs });
      } else if (mode === "note") {
        if (!noteInput.trim()) {
          setError("Paste some text containing drug names first.");
          setLoading(false);
          return;
        }
        res = await axios.post(API_URL_EXTRACT, { text: noteInput });
      } else {
        if (!imageFile) {
          setError("Choose an image of a prescription or medication list first.");
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", imageFile);
        res = await axios.post(API_URL_OCR, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setResponse(res.data);
      
      // Auto-sync logic
      if (activeProfile) {
          const allDrugs = new Set(activeProfile.medications || []);
          if (mode === "manual") {
              const typed = drugsInput.split(",").map(d => d.trim()).filter(Boolean);
              typed.forEach(d => allDrugs.add(d));
          } else if (res.data && res.data.results) {
              res.data.results.forEach(r => {
                  allDrugs.add(r.drug_1);
                  allDrugs.add(r.drug_2);
              });
          }
          const updatedDrugs = Array.from(allDrugs);
          axios.put(`${API_URL_PROFILES}/${activeProfile.id}`, { medications: updatedDrugs }).then(() => {
              setActiveProfile({...activeProfile, medications: updatedDrugs});
              fetchProfiles();
          }).catch(console.error);
      }
      
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not reach the interaction checker API. Is the backend running?"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-widget">
          <h3>Quick Tips</h3>
          <p>Always double-check newly prescribed medications with your active list.</p>
          <p>Avoid mixing NSAIDs (like Ibuprofen) with blood thinners (like Warfarin) unless advised.</p>
        </div>
        <div className="sidebar-widget">
          <h3>Common Interactions</h3>
          <p style={{fontSize: "12px", color: "var(--muted)", marginBottom: "12px"}}>
            Try searching these real combinations to see different risk levels:
          </p>
          <ul style={{ paddingLeft: "15px", margin: 0, fontSize: "13px" }}>
            <li style={{marginBottom: "8px"}}><strong style={{color: "var(--high)"}}>🔴 HIGH RISK:</strong><br/>
              • Aspirin, Flurbiprofen<br/>
              • Chloroquine, Kaolin<br/>
              • Acarbose, Pancreatin
            </li>
            <li style={{marginBottom: "8px"}}><strong style={{color: "var(--moderate)"}}>🟡 MODERATE:</strong><br/>
              • Ibuprofen, Anticoagulants<br/>
              • Digoxin, Sympathomimetics<br/>
              • Barbiturates, Corticosteroids
            </li>
            <li style={{marginBottom: "8px"}}><strong style={{color: "var(--low)"}}>🟢 LOW RISK:</strong><br/>
              • OMNICEF, Antacids<br/>
              • Glimepiride, Magnesium Salicylate<br/>
              • SPRYCEL, Antacids
            </li>
            <li style={{marginBottom: "8px"}}><strong>⚪ NO MATCH (Safe):</strong><br/>
              • Amoxicillin, Tylenol<br/>
              • Vitamin C, Magnesium
            </li>
          </ul>
        </div>
        {activeProfile && (
          <div className="sidebar-widget profile-summary">
            <h3>Active Profile</h3>
            <p><strong>{activeProfile.name}</strong></p>
            <p>{activeProfile.medications.length} meds active</p>
            {activeProfile.allergies && (
               <div style={{color: "red", fontSize: "12px", marginTop: "10px"}}>
                 <strong>Allergies:</strong> {activeProfile.allergies}
               </div>
            )}
          </div>
        )}
      </aside>

      <main className="app-main">
        <header className="app__header">
          <div className="header-left">
            <h1 onClick={() => setMode("manual")} style={{cursor: "pointer"}}>MedGaurd AI</h1>
            <p className="app__subtitle">
              Enter medications (brand or generic names) to check for known drug-drug
              interactions.
            </p>
          </div>
          <div style={{display: "flex", flexDirection: "column", alignItems: "flex-end"}}>
            <div style={{display: "flex", gap: "10px"}}>
              <button className="profile-btn-header" style={{background: "#64748b"}} onClick={() => setMode("manual")}>
                🏠 Home
              </button>
              <button className="profile-btn-header" style={{background: "#3b82f6"}} onClick={() => setMode("analytics")}>
                📊 Dashboard
              </button>
              <button className="profile-btn-header" style={{background: "#10b981"}} onClick={() => setMode("profile")}>
                {activeProfile ? `👤 ${activeProfile.name}` : "My Profile"}
              </button>
            </div>
            {activeProfile && <span style={{fontSize: "12px", color: "#10b981", marginTop: "4px", fontWeight: "bold"}}>✓ Auto-sync ON</span>}
          </div>
        </header>

        {mode === "analytics" ? (
        <Analytics />
      ) : mode === "profile" ? (
        <ProfilePage 
          activeProfile={activeProfile}
          setActiveProfile={(p) => { setActiveProfile(p); if (p) setDrugsInput(p.medications.join(", ")); }}
          profiles={profiles}
          fetchProfiles={fetchProfiles}
          API_URL_PROFILES={API_URL_PROFILES}
        />
      ) : (
        <>
          <div className="mode-toggle">
        <button
          type="button"
          className={mode === "manual" ? "toggle-btn toggle-btn--active" : "toggle-btn"}
          onClick={() => setMode("manual")}
        >
          Manual List
        </button>
        <button
          type="button"
          className={mode === "note" ? "toggle-btn toggle-btn--active" : "toggle-btn"}
          onClick={() => setMode("note")}
        >
          Paste a Note
        </button>
        <button
          type="button"
          className={mode === "image" ? "toggle-btn toggle-btn--active" : "toggle-btn"}
          onClick={() => setMode("image")}
        >
          Upload a Photo
        </button>
      </div>

      <form
        className={mode === "manual" ? "input-form" : "input-form input-form--note"}
        onSubmit={handleSubmit}
      >
        {mode === "manual" ? (
          <div className="input-container">
            <input
              type="text"
              value={drugsInput}
              onChange={handleDrugsInputChange}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onFocus={handleDrugsInputChange}
              placeholder="e.g. EQUETRO, ethosuximide, digoxin"
            />
            {showSuggestions && (
              <div className="autocomplete-dropdown">
                {suggestions.map(s => (
                  <div 
                    key={s} 
                    className="autocomplete-item" 
                    onClick={() => selectSuggestion(s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : mode === "note" ? (
          <textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Paste a clinical note or medication list, e.g. 'Patient is on EQUETRO 200mg and ethosuximide 500mg for seizure control...'"
            rows={5}
          />
        ) : (
          <div className="image-upload">
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setImageFile(file);
                setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
            />
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="Selected prescription" className="image-preview" />
            )}
          </div>
        )}
        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              <div className="spinner" />
              Checking...
            </>
          ) : (
            "Check Interactions"
          )}
        </button>
      </form>

      {error && (
        <div className="error-banner">
          <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 22 22 2 22 12 2"></polygon>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          {error}
        </div>
      )}

      {response && (
        <div className="results">
          <div className="results__summary">
            Checked {response.pairs_checked} pair
            {response.pairs_checked === 1 ? "" : "s"} across {response.drug_count}{" "}
            medications — <strong>{response.interactions_found}</strong> interaction
            {response.interactions_found === 1 ? "" : "s"} found.
            
            <button className="pdf-btn" onClick={generatePDF}>
              Download PDF Report
            </button>
          </div>

          <InteractionGraph results={response.results} />

          {response.results.map((result, idx) => (
            <ResultCard key={idx} result={result} />
          ))}
        </div>
      )}
        </>
      )}
      </main>
    </div>
  );
}
