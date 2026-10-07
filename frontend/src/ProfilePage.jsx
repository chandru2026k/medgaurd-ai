import React, { useState } from "react";
import axios from "axios";

export default function ProfilePage({ activeProfile, setActiveProfile, profiles, fetchProfiles, API_URL_PROFILES }) {
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileAgeInput, setProfileAgeInput] = useState("");
  const [profileGenderInput, setProfileGenderInput] = useState("");
  const [profileDobInput, setProfileDobInput] = useState("");
  const [profileHeightInput, setProfileHeightInput] = useState("");
  const [profileWeightInput, setProfileWeightInput] = useState("");
  const [profileBloodInput, setProfileBloodInput] = useState("");
  const [profileAllergiesInput, setProfileAllergiesInput] = useState("");
  const [profileConditionsInput, setProfileConditionsInput] = useState("");

  const [errorMsg, setErrorMsg] = useState("");

  const saveProfile = async () => {
    setErrorMsg("");
    if (!profileNameInput.trim()) {
      setErrorMsg("Please enter a patient name.");
      return;
    }
    
    try {
      await axios.post(API_URL_PROFILES, { 
        name: profileNameInput.trim(), 
        age: profileAgeInput ? parseInt(profileAgeInput) : null,
        gender: profileGenderInput.trim() || null,
        dob: profileDobInput.trim() || null,
        height: profileHeightInput.trim() || null,
        weight: profileWeightInput.trim() || null,
        blood_type: profileBloodInput.trim() || null,
        allergies: profileAllergiesInput.trim() || null,
        conditions: profileConditionsInput.trim() || null,
        medications: [] 
      });
      
      setProfileNameInput("");
      setProfileAgeInput("");
      setProfileGenderInput("");
      setProfileDobInput("");
      setProfileHeightInput("");
      setProfileWeightInput("");
      setProfileBloodInput("");
      setProfileAllergiesInput("");
      setProfileConditionsInput("");
      
      // Refresh and try to set the latest as active
      axios.get(API_URL_PROFILES).then(res => {
        const data = res.data || [];
        fetchProfiles();
        if (data.length > 0) setActiveProfile(data[data.length - 1]);
      }).catch(() => {});
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to save profile. Please check if the backend is running.");
    }
  };

  return (
    <div style={{ padding: "20px", background: "white", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginTop: "20px" }}>
      <h2 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "20px" }}>
        {activeProfile ? `Active Profile: ${activeProfile.name}` : "Patient Profiles"}
      </h2>

      {activeProfile && (
        <div style={{ background: "#f0fdf4", padding: "24px", borderRadius: "8px", marginBottom: "30px", border: "1px solid #bbf7d0" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#166534" }}>Current Patient Record</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <div>
              <p style={{ margin: "4px 0", fontSize: "15px" }}><strong>Age:</strong> {activeProfile.age || "N/A"}</p>
              <p style={{ margin: "4px 0", fontSize: "15px" }}><strong>Gender:</strong> {activeProfile.gender || "N/A"}</p>
              <p style={{ margin: "4px 0", fontSize: "15px" }}><strong>DOB:</strong> {activeProfile.dob || "N/A"}</p>
            </div>
            <div>
              <p style={{ margin: "4px 0", fontSize: "15px" }}><strong>Height:</strong> {activeProfile.height || "N/A"}</p>
              <p style={{ margin: "4px 0", fontSize: "15px" }}><strong>Weight:</strong> {activeProfile.weight || "N/A"}</p>
              <p style={{ margin: "4px 0", fontSize: "15px" }}><strong>Blood Type:</strong> {activeProfile.blood_type || "N/A"}</p>
            </div>
          </div>

          {(activeProfile.allergies || activeProfile.conditions) && (
            <div style={{ background: "#fee2e2", padding: "16px", borderRadius: "8px", border: "1px solid #fca5a5", marginBottom: "20px" }}>
              {activeProfile.allergies && (
                <div style={{ marginBottom: activeProfile.conditions ? "10px" : "0" }}>
                  <strong style={{ color: "#b91c1c" }}>⚠️ Known Allergies:</strong>
                  <p style={{ margin: "4px 0 0 0", color: "#7f1d1d" }}>{activeProfile.allergies}</p>
                </div>
              )}
              {activeProfile.conditions && (
                <div>
                  <strong style={{ color: "#b91c1c" }}>⚠️ Chronic Conditions:</strong>
                  <p style={{ margin: "4px 0 0 0", color: "#7f1d1d" }}>{activeProfile.conditions}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <strong style={{ fontSize: "16px", color: "#166534" }}>Medication History (Auto-Synced):</strong>
            <ul style={{ paddingLeft: "20px", color: "#374151", marginTop: "8px" }}>
              {activeProfile.medications.length > 0 
                ? activeProfile.medications.map((med, i) => <li key={i}>{med}</li>)
                : <li>No medications recorded yet. Check interactions to auto-sync!</li>
              }
            </ul>
          </div>

          <button 
            onClick={() => setActiveProfile(null)}
            style={{ marginTop: "20px", background: "#ef4444", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
          >
            Sign Out / Switch Patient
          </button>
        </div>
      )}

      {!activeProfile && (
        <div style={{ marginBottom: "40px", background: "#f8fafc", padding: "24px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>Register New Patient</h3>
          
          {errorMsg && (
             <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px", borderRadius: "4px", marginBottom: "16px", border: "1px solid #fca5a5" }}>
               {errorMsg}
             </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
            <input 
              type="text" placeholder="Patient Name (Required)" value={profileNameInput}
              onChange={e => setProfileNameInput(e.target.value)}
              style={{ padding: "12px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "16px" }}
            />
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <input type="number" placeholder="Age" value={profileAgeInput} onChange={e => setProfileAgeInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
              <select value={profileGenderInput} onChange={e => setProfileGenderInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }}>
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <input type="date" title="Date of Birth" value={profileDobInput} onChange={e => setProfileDobInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <input type="text" placeholder="Height (e.g. 5'9 or 175cm)" value={profileHeightInput} onChange={e => setProfileHeightInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
              <input type="text" placeholder="Weight (e.g. 150 lbs)" value={profileWeightInput} onChange={e => setProfileWeightInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
              <input type="text" placeholder="Blood Type (e.g. O+)" value={profileBloodInput} onChange={e => setProfileBloodInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
            </div>
            
            <input type="text" placeholder="Known Allergies (e.g. Penicillin, Peanuts)" value={profileAllergiesInput} onChange={e => setProfileAllergiesInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
            <input type="text" placeholder="Chronic Conditions (e.g. Hypertension, Diabetes)" value={profileConditionsInput} onChange={e => setProfileConditionsInput(e.target.value)} style={{ padding: "10px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
            
            <button onClick={saveProfile} style={{ background: "#10b981", color: "white", padding: "12px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
              Create Patient Profile
            </button>
          </div>
        </div>
      )}

      <h3 style={{ color: "#334155" }}>Saved Profiles Database</h3>
      {profiles.length === 0 ? <p style={{ color: "#64748b" }}>No profiles saved yet.</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", marginTop: "16px" }}>
          {profiles.map(p => (
            <div key={p.id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", background: activeProfile?.id === p.id ? "#f0fdf4" : "white" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#0f172a" }}>{p.name}</h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#64748b" }}>
                {p.age ? `${p.age} yrs` : ""} {p.gender ? `• ${p.gender}` : ""} {p.dob ? `• DOB: ${p.dob}` : ""}
              </p>
              
              <div style={{ fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
                <strong>Meds:</strong> {p.medications.length > 0 ? p.medications.join(", ") : "None"}
              </div>

              {activeProfile?.id !== p.id ? (
                <button 
                  onClick={() => setActiveProfile(p)}
                  style={{ width: "100%", background: "#3b82f6", color: "white", padding: "8px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Load Patient
                </button>
              ) : (
                <div style={{ textAlign: "center", color: "#10b981", fontWeight: "bold", padding: "8px", border: "1px solid #10b981", borderRadius: "4px" }}>
                  Currently Active
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
