import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelHeader, ProfileEditor } from "./ProfilesPage.jsx";
import { numericFields, selectFields } from "./profileFields.js";
import "./ResultsPage.css";

function displayName(profile) {
  return [profile?.name, profile?.paternalSurname, profile?.maternalSurname].filter(Boolean).join(" ");
}

function formatDate(value, lang) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-MX", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

function RiskCard({ title, value, icon, t }) {
  const score = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <article className="result-score-card">
      <div className="result-score-heading">
        <span className="result-score-icon" aria-hidden="true">{icon}</span>
        <span>{title}</span>
      </div>
      <strong>{Number.isFinite(value) ? `${value.toFixed(2)}%` : "—"}</strong>
      <div className="result-score-track" role="img" aria-label={`${title}: ${score.toFixed(0)}%`}>
        <span style={{ width: `${score}%` }} />
      </div>
      <small>{t.results.scoreCaption}</small>
    </article>
  );
}

function ClinicalChart({ data, t }) {
  const values = data?.radar?.values ?? [];
  const impact = { bajo: 28, low: 28, medio: 60, medium: 60, alto: 92, high: 92 };
  if (!values.length) return <p className="results-muted">{t.results.noChartData}</p>;
  return (
    <>
    <div className="chart-legend" aria-label={t.results.chartLegend}>
      <span><i className="impact-bajo" />{t.results.legendLow}</span>
      <span><i className="impact-medio" />{t.results.legendMedium}</span>
      <span><i className="impact-alto" />{t.results.legendHigh}</span>
    </div>
    <div className="clinical-chart" role="list">
      {values.map((item) => {
        const level = String(item.impact ?? "bajo").toLocaleLowerCase();
        const barWidth = item.value === null || item.value === undefined ? 0 : impact[level] ?? 28;
        return (
          <div className="clinical-chart-row" role="listitem" key={item.label}>
            <div className="clinical-chart-label">
              <span>{item.label}</span>
              <strong>{item.value === null || item.value === undefined ? t.results.noData : `${item.value} ${item.unit ?? ""}`}</strong>
            </div>
            <div className="clinical-chart-track" aria-hidden="true">
              <span className={`impact-${level}`} style={{ width: `${barWidth}%` }} />
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

function BehaviorChart({ data, t }) {
  const factors = data?.risk_factors ?? [];
  if (!factors.length) return <p className="results-muted">{t.results.noBehaviorFactors}</p>;
  const sizes = { bajo: 32, low: 32, medio: 62, medium: 62, alto: 92, high: 92 };
  return (
    <>
    <div className="chart-legend" aria-label={t.results.chartLegend}>
      <span><i className="impact-bajo" />{t.results.legendLow}</span>
      <span><i className="impact-medio" />{t.results.legendMedium}</span>
      <span><i className="impact-alto" />{t.results.legendHigh}</span>
    </div>
    <div className="behavior-chart" role="list">
      {factors.map((factor) => {
        const level = String(factor.impact ?? "medio").toLocaleLowerCase();
        return (
          <div className="behavior-chart-row" role="listitem" key={factor.name}>
            <span>{factor.name}</span>
            <div className="clinical-chart-track" aria-hidden="true">
              <span className={`impact-${level}`} style={{ width: `${sizes[level] ?? 62}%` }} />
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

export function ResultsPage({ apiUrl, profileId, user, lang, t, changeLanguage, onSignOut, onNavigate, onSessionExpired }) {
  const [profile, setProfile] = useState(null);
  const [guide, setGuide] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResponse, guideResponse] = await Promise.all([
        fetch(`${apiUrl}/profiles/${profileId}`, { credentials: "include" }),
        fetch(`${apiUrl}/profiles/${profileId}/guides`, { method: "POST", credentials: "include" }),
      ]);
      if (profileResponse.status === 401 || guideResponse.status === 401) {
        onSessionExpired();
        return;
      }
      if (!profileResponse.ok || !guideResponse.ok) throw new Error(t.results.loadError);
      const [profileData, guideData] = await Promise.all([profileResponse.json(), guideResponse.json()]);
      setProfile(guideData.profile ?? profileData);
      setGuide(guideData.guide ?? null);
      setHistory(guideData.history ?? []);
      if (guideData.reused) setNotice(t.results.reused);
      else setNotice("");
    } catch {
      setError(t.results.loadError);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, profileId, onSessionExpired, t.results.loadError, t.results.reused]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadResults(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadResults]);

  const profileAge = useMemo(() => profile?.age ? t.results.age.replace("{age}", profile.age) : "", [profile, t.results.age]);
  async function saveHealthData(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = {};
    for (const [field] of numericFields) payload[field] = raw[field] === "" ? null : Number(raw[field]);
    for (const [field, kind] of selectFields) {
      const value = raw[field] ?? "";
      payload[field] = !value ? null : kind === "yesNo" ? value === "true" : value;
    }
    try {
      const response = await fetch(`${apiUrl}/profiles/${profileId}/health-data`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok) throw new Error(t.results.updateError);
      const data = await response.json();
      setProfile(data.profile ?? profile);
      setGuide(data.guide ?? null);
      setHistory(data.history ?? []);
      setEditorOpen(false);
      setNotice(data.reused ? t.results.reused : t.results.updated);
    } catch {
      setError(t.results.updateError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/profiles/${profileId}`, { method: "DELETE", credentials: "include" });
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok) throw new Error(t.results.deleteError);
      onNavigate("/panel");
    } catch {
      setError(t.results.deleteError);
      setDeleteOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profiles-app">
      <PanelHeader user={user} lang={lang} t={t} changeLanguage={changeLanguage} onSignOut={onSignOut} onNavigate={onNavigate} />
      <main className="results-main">
        <button className="results-back" onClick={() => onNavigate("/panel")}>← {t.results.back}</button>
        {loading ? (
          <section className="results-loading" role="status"><span className="loading-dot" /><p>{t.results.loading}</p></section>
        ) : error && !profile ? (
          <section className="results-message"><h1>{t.results.loadTitle}</h1><p>{error}</p><button className="profile-button profile-button-primary" onClick={loadResults}>{t.results.retry}</button></section>
        ) : (
          <>
            <section className="results-welcome">
              <div>
                <span className="profiles-kicker">{t.results.eyebrow}</span>
                <h1>{t.results.greeting.replace("{name}", profile?.name ?? "")}</h1>
                <p>{[profileAge, profile?.sex ? (profile.sex === "male" ? t.panel.male : t.panel.female) : ""].filter(Boolean).join(" · ") || t.results.profileDetails}</p>
              </div>
              <div className="results-actions">
                <button className="profile-button profile-button-primary" onClick={() => { setError(""); setEditorOpen(true); }}>{t.results.update}</button>
                <button className="profile-button results-delete-button" onClick={() => setDeleteOpen(true)}>🗑️ {t.results.deleteProfile}</button>
              </div>
            </section>
            {error && <p className="profile-alert" role="alert">{error}</p>}
            {notice && <p className="profile-notice" role="status">{notice}</p>}
            {!guide ? (
              <section className="results-empty-guide">
                <span aria-hidden="true">🌿</span>
                <h2>{t.results.noGuideTitle}</h2>
                <p>{t.results.noGuideText}</p>
                <button className="profile-button profile-button-primary" onClick={loadResults}>{t.results.retry}</button>
              </section>
            ) : (
              <>
                <section className="results-score-grid" aria-label={t.results.scoreSection}>
                  <RiskCard title={t.results.clinical} value={guide.clinicalProbability} icon="🩺" t={t} />
                  <RiskCard title={t.results.behavioral} value={guide.behavioralProbability} icon="🌿" t={t} />
                </section>
                <p className="results-date">{t.results.lastUpdated}: <time dateTime={guide.refreshedAt}>{formatDate(guide.refreshedAt, lang)}</time></p>
                <section className="results-section results-summary">
                  <span className="results-section-icon" aria-hidden="true">📊</span>
                  <div><h2>{t.results.summaryTitle}</h2><p>{guide.summary || t.results.noSummary}</p></div>
                </section>
                <section className="results-content-grid">
                  <article className="results-section results-explanations">
                    <h2>{t.results.explanationsTitle}</h2>
                    {guide.explanations?.length ? <ul className="results-copy-list">{guide.explanations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p className="results-muted">{t.results.noExplanations}</p>}
                  </article>
                  <article className="results-section results-recommendations">
                    <h2>{t.results.recommendationsTitle}</h2>
                    {guide.recommendations?.length ? <ul className="results-copy-list">{guide.recommendations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p className="results-muted">{t.results.noRecommendations}</p>}
                  </article>
                </section>
                <section className="results-section">
                  <div className="results-section-heading"><div><h2>{t.results.chartsTitle}</h2><p>{t.results.chartsIntro}</p></div></div>
                  <div className="results-chart-grid">
                    <article className="results-chart-card"><h3>{t.results.clinicalChart}</h3><ClinicalChart data={guide.chartData} t={t} /></article>
                    <article className="results-chart-card"><h3>{t.results.behavioralChart}</h3><BehaviorChart data={guide.chartData} t={t} /></article>
                  </div>
                </section>
              </>
            )}
            <section className="results-section results-history">
              <div className="results-section-heading"><div><h2>{t.results.historyTitle}</h2><p>{t.results.historyIntro}</p></div></div>
              {history.length ? <ol className="results-history-list">{history.map((item, index) => (
                <li className={index === 0 ? "is-latest" : ""} key={item.id}>
                  <time dateTime={item.refreshedAt || item.generatedAt}>🗓️ {formatDate(item.refreshedAt || item.generatedAt, lang)}{index === 0 && <span className="history-latest-tag">{t.results.latest}</span>}</time>
                  <span>🩺 {t.results.clinicalShort}<strong>{item.clinicalProbability.toFixed(2)}%</strong></span>
                  <span>🌿 {t.results.behavioralShort}<strong>{item.behavioralProbability.toFixed(2)}%</strong></span>
                </li>
              ))}</ol> : <p className="results-muted">{t.results.noHistory}</p>}
            </section>
            <aside className="results-disclaimer"><span aria-hidden="true">💚</span><p><strong>{t.results.disclaimerTitle}</strong> {t.results.disclaimerText}</p></aside>
          </>
        )}
      </main>
      {editorOpen && profile && <ProfileEditor mode="health" profile={profile} saving={saving} error={error} t={t} onClose={() => !saving && setEditorOpen(false)} onSubmit={saveHealthData} />}
      {deleteOpen && <div className="profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDeleteOpen(false); }}>
        <section className="profile-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="results-delete-title">
          <h2 id="results-delete-title">{t.results.deleteTitle.replace("{name}", displayName(profile))}</h2>
          <p>{t.results.deleteText}</p>
          <div className="profile-modal-actions">
            <button className="profile-button profile-button-outline" disabled={saving} onClick={() => setDeleteOpen(false)}>{t.panel.cancel}</button>
            <button className="profile-button profile-button-danger results-confirm-delete" disabled={saving} onClick={deleteProfile}>{saving ? t.panel.saving : t.results.deleteConfirm}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
