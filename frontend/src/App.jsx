import { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "./App.css";
import InteractionGraph from "./InteractionGraph";
import Analytics from "./Analytics";
import ProfilePage from "./ProfilePage";

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
      <p className="explanation-text">{text}</p>
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

function ResultCard({ result }) {
  if (!result.found) {
    return (
      <div className="result-card result-card--empty">
        <div className="result-card__header">
          {result.drug_1} + {result.drug_2}
          <ConfidenceBadge confidence={result.confidence} />
        </div>
        <p className="result-card__note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'text-bottom', marginRight: '6px' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          No known interaction found in our database. This does not guarantee the
          combination is safe — it may simply be absent from our source data.
        </p>
      </div>
    );
  }

  return (
    <div className="result-card" data-severity={result.severity}>
      <div className="result-card__header">
        {result.drug_1} + {result.drug_2}
        <ConfidenceBadge confidence={result.confidence} />
      </div>

      <div className="result-card__meta">
        <span className="severity-pill">{result.severity} severity</span>
        {result.computed_severity && (
          <span className="score-pill">
            score {result.severity_score}/100 → {result.computed_severity}
          </span>
        )}
        <span className="relation-type">{result.relation_type}</span>
        <span className="mention-count">
          seen {result.mention_count} time{result.mention_count === 1 ? "" : "s"} in source data
        </span>
      </div>

      <ScoreBreakdown breakdown={result.score_breakdown} />

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
  const [selectedProfile, setSelectedProfile] = useState("");

  useEffect(() => {
    axios.get(API_URL_DICT).then(res => setDictionary(res.data.words || [])).catch(() => {});
    fetchProfiles();
  }, []);

  const fetchProfiles = () => {
    axios.get(API_URL_PROFILES).then(res => setProfiles(res.data || [])).catch(() => {});
  };

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
    doc.setFontSize(18);
    doc.text("MedGaurd AI - Interaction Report", 20, 20);
    doc.setFontSize(12);
    doc.text(`Drugs checked: ${response.drug_count}`, 20, 30);
    doc.text(`Interactions found: ${response.interactions_found}`, 20, 40);
    
    let y = 50;
    response.results.forEach(r => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`- ${r.drug_1} + ${r.drug_2}: ${r.found ? r.severity + " severity" : "No known interaction"}`, 20, y);
      if (r.found && r.evidence_sentence) {
        y += 10;
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(r.evidence_sentence, 170);
        doc.text(lines, 25, y);
        y += lines.length * 5;
        doc.setFontSize(12);
      }
      y += 10;
    });
    doc.save("MedGaurd_Report.pdf");
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

    <div className="app">
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
    </div>
  );
}