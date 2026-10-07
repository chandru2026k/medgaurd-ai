import { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "./App.css";
import InteractionGraph from "./InteractionGraph";
import Analytics from "./Analytics";

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

  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileAgeInput, setProfileAgeInput] = useState("");
  const [profileGenderInput, setProfileGenderInput] = useState("");
  const [profileDobInput, setProfileDobInput] = useState("");

  const [activeProfile, setActiveProfile] = useState(null);

  const saveProfile = async () => {
    if (!profileNameInput.trim()) return alert("Please enter a profile name.");
    let drugs = [];
    if (mode === "manual" && drugsInput.trim()) {
        drugs = drugsInput.split(",").map((d) => d.trim()).filter(Boolean);
    } else if (response && response.results) {
        const allDrugs = new Set();
        response.results.forEach(r => {
            allDrugs.add(r.drug_1);
            allDrugs.add(r.drug_2);
        });
        drugs = Array.from(allDrugs);
    }
    
    try {
      await axios.post(API_URL_PROFILES, { 
        name: profileNameInput.trim(), 
        age: profileAgeInput ? parseInt(profileAgeInput) : null,
        gender: profileGenderInput.trim() || null,
        dob: profileDobInput.trim() || null,
        medications: drugs 
      });
      alert("Profile saved! It will automatically sync as you check interactions.");
      setProfileNameInput("");
      setProfileAgeInput("");
      setProfileGenderInput("");
      setProfileDobInput("");
      setShowProfileModal(false);
      
      // Refresh and try to set the latest as active
      axios.get(API_URL_PROFILES).then(res => {
        const data = res.data || [];
        setProfiles(data);
        if (data.length > 0) setActiveProfile(data[data.length - 1]);
      }).catch(() => {});
    } catch (err) {
      console.error(err);
      alert("Failed to save profile. Please check if the backend is running.");
    }
  };

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

  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
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
            <button className="profile-btn-header" style={{background: "#3b82f6"}} onClick={() => setMode("analytics")}>
              📊 Model Analytics
            </button>
            <button className="profile-btn-header" onClick={() => setShowProfileModal(true)}>
              {activeProfile ? `👤 ${activeProfile.name}` : "My Profile"}
            </button>
          </div>
          {activeProfile && <span style={{fontSize: "12px", color: "#10b981", marginTop: "4px", fontWeight: "bold"}}>✓ Auto-sync ON</span>}
        </div>
      </header>

      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowProfileModal(false)}>&times;</button>
            <h2>{activeProfile ? `Profile: ${activeProfile.name}` : "Patient Profiles"}</h2>
            {activeProfile && (
              <div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #bbf7d0" }}>
                <strong>Current Active Profile</strong><br/>
                <span style={{ fontSize: "14px", color: "#374151" }}>
                  {activeProfile.age ? `${activeProfile.age} yrs` : ""} {activeProfile.gender ? `• ${activeProfile.gender}` : ""} {activeProfile.dob ? `• DOB: ${activeProfile.dob}` : ""}
                </span><br/>
                <span style={{ fontSize: "14px", color: "#166534", fontWeight: "500" }}>Medication History:</span>
                <p style={{ fontSize: "14px", color: "#374151", margin: "4px 0 0 0" }}>
                  {activeProfile.medications.length > 0 ? activeProfile.medications.join(", ") : "No medications recorded yet."}
                </p>
                <button 
                  onClick={() => { setActiveProfile(null); setDrugsInput(""); setShowProfileModal(false); }}
                  style={{ marginTop: "10px", background: "#ef4444", color: "white", padding: "4px 8px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
                  Sign Out / Clear Active Profile
                </button>
              </div>
            )}
            
            {!activeProfile && (
              <>
                <p>Create a new profile to automatically save your medication history.</p>
                <div style={{ margin: "20px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input 
                    type="text" 
                    placeholder="Enter patient name..." 
                    value={profileNameInput}
                    onChange={e => setProfileNameInput(e.target.value)}
                    style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                  />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input 
                      type="number" 
                      placeholder="Age" 
                      value={profileAgeInput}
                      onChange={e => setProfileAgeInput(e.target.value)}
                      style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    />
                    <select 
                      value={profileGenderInput}
                      onChange={e => setProfileGenderInput(e.target.value)}
                      style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    >
                      <option value="">Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <input 
                      type="date" 
                      title="Date of Birth"
                      value={profileDobInput}
                      onChange={e => setProfileDobInput(e.target.value)}
                      style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    />
                  </div>
                  <button onClick={saveProfile} style={{ background: "#10b981", color: "white", padding: "10px 12px", border: "none", borderRadius: "4px", cursor: "pointer", width: "100%", marginTop: "10px" }}>
                    Save Profile
                  </button>
                </div>
                <hr style={{ margin: "20px 0" }}/>
              </>
            )}

            <h3>Saved Profiles</h3>
            {profiles.length === 0 ? <p>No profiles saved yet.</p> : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {profiles.map(p => (
                  <li key={p.id} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
                    <strong>{p.name}</strong> 
                    <span style={{ fontSize: "13px", color: "#666", marginLeft: "10px" }}>
                      {p.age ? `${p.age} yrs` : ""} {p.gender ? `• ${p.gender}` : ""} {p.dob ? `• DOB: ${p.dob}` : ""}
                    </span>
                    <br/>
                    <span style={{ fontSize: "14px", color: "#666" }}>{p.medications.join(", ")}</span>
                    <br/>
                    {activeProfile?.id !== p.id && (
                      <button 
                        onClick={() => {
                          setActiveProfile(p);
                          setDrugsInput(p.medications.join(", "));
                          setShowProfileModal(false);
                        }}
                        style={{ marginTop: "8px", background: "#3b82f6", color: "white", padding: "4px 8px", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Set as Active Profile
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {mode === "analytics" ? (
        <Analytics />
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