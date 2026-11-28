import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { numericFields, selectFields } from "./profileFields.js";

function profileDisplayName(profile) {
  return [profile.name, profile.paternalSurname, profile.maternalSurname]
    .filter(Boolean)
    .join(" ");
}

function localizedValidation(message, t) {
  const fieldKey = message?.field;
  const fieldName = t.panel.fields[fieldKey] || "";
  const translations = t.panel.validation;
  const reason = message?.reason;
  if (reason === "range") {
    const unit = numericFields.find(([key]) => key === fieldKey)?.[5];
    const template = unit ? translations.range : translations.rangeSimple;
    return template
      .replace("{field}", fieldName)
      .replace("{min}", message.min)
      .replace("{max}", message.max)
      .replace("{unit}", unit || "");
  }
  const template = translations[reason] || translations.profile;
  return template.replace("{field}", fieldName || t.panel.yourProfiles);
}

function validateProfileInput(input, t) {
  const label = t.panel.fields[input.name] || t.panel.yourProfiles;
  const validation = t.panel.validation;
  if (
    input.validity.valueMissing ||
    (input.required && input.type === "text" && !input.value.trim())
  ) {
    return validation.required.replace("{field}", label);
  }
  if (input.validity.rangeUnderflow || input.validity.rangeOverflow) {
    const unit = input.dataset.unit;
    const template = unit ? validation.range : validation.rangeSimple;
    return template
      .replace("{field}", label)
      .replace("{min}", input.min)
      .replace("{max}", input.max)
      .replace("{unit}", unit || "");
  }
  if (
    input.validity.badInput ||
    input.validity.typeMismatch ||
    input.validity.stepMismatch
  ) {
    return validation.number.replace("{field}", label);
  }
  const hasControlCharacter = Array.from(input.value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
  if (input.validity.tooLong || hasControlCharacter) {
    return validation.text.replace("{field}", label);
  }
  return "";
}

export function ProfilesPage({
  apiUrl,
  user,
  lang,
  t,
  changeLanguage,
  onSignOut,
  onNavigate,
  onSessionExpired,
  resultsComingSoon = false,
}) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editorMode, setEditorMode] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [deleteProfile, setDeleteProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/profiles`, {
        credentials: "include",
      });
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok) throw new Error(t.panel.connectionError);
      setProfiles(await response.json());
    } catch {
      setError(t.panel.connectionError);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, onSessionExpired, t.panel.connectionError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfiles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfiles]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(lang);
    if (!query) return profiles;
    return profiles.filter((profile) =>
      profileDisplayName(profile).toLocaleLowerCase(lang).includes(query),
    );
  }, [profiles, search, lang]);

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries());
    const payload = {};
    for (const field of ["name", "paternalSurname", "maternalSurname"]) {
      if (field in raw) payload[field] = String(raw[field]).trim();
    }
    if (editorMode === "create") {
      for (const [field] of numericFields) {
        const value = raw[field];
        if (value !== undefined && value !== "") payload[field] = Number(value);
      }
      for (const [field] of selectFields) {
        const value = raw[field];
        if (!value) continue;
        if (["sex", "education", "incomeMonthlyMxn"].includes(field))
          payload[field] = value;
        else payload[field] = value === "true";
      }
    }

    setSaving(true);
    try {
      const editing = editorMode === "edit";
      const endpoint = editing
        ? `${apiUrl}/profiles/${selectedProfile._id}`
        : `${apiUrl}/profiles`;
      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 401) {
          onSessionExpired();
          return;
        }
        const responseBody = response.status === 400
          ? await response.json().catch(() => ({}))
          : {};
        setError(
          response.status === 400
            ? localizedValidation(responseBody, t)
            : response.status === 409
              ? t.panel.duplicate
              : response.status === 404
                ? t.panel.profileNotFound
                : t.panel.saveError,
        );
        return;
      }
      setEditorMode(null);
      setSelectedProfile(null);
      setNotice(editing ? t.panel.profileUpdated : t.panel.profileCreated);
      window.setTimeout(() => setNotice(""), 4000);
      await loadProfiles();
    } catch {
      setError(t.panel.connectionError);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteProfile) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/profiles/${deleteProfile._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok) throw new Error(t.panel.deleteError);
      setProfiles((current) =>
        current.filter((profile) => profile._id !== deleteProfile._id),
      );
      setDeleteProfile(null);
      setNotice(t.panel.profileDeleted);
      window.setTimeout(() => setNotice(""), 4000);
    } catch {
      setError(t.panel.deleteError);
      setDeleteProfile(null);
    } finally {
      setSaving(false);
    }
  }

  if (resultsComingSoon) {
    return (
      <div className="profiles-app">
        <PanelHeader
          user={user}
          lang={lang}
          t={t}
          changeLanguage={changeLanguage}
          onSignOut={onSignOut}
          onNavigate={onNavigate}
        />
        <main className="results-placeholder">
          <span className="profiles-kicker">{t.results.eyebrow}</span>
          <h1>{t.results.title}</h1>
          <p>{t.results.description}</p>
          <button
            className="profile-button profile-button-primary"
            onClick={() => onNavigate("/panel")}
          >
            {t.results.back}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="profiles-app">
      <PanelHeader
        user={user}
        lang={lang}
        t={t}
        changeLanguage={changeLanguage}
        onSignOut={onSignOut}
        onNavigate={onNavigate}
      />
      <main className="profiles-main">
        <section className="profiles-welcome">
          <div>
            <span className="profiles-kicker">{t.panel.kicker}</span>
            <h1>
              {t.panel.greeting} {user.name.split(" ")[0]}.
            </h1>
            <p>{t.panel.intro}</p>
          </div>
          <button
            className="profile-button profile-button-primary create-profile-button"
            onClick={() => {
              setEditorMode("create");
              setSelectedProfile(null);
              setError("");
            }}
          >
            <span className="button-plus" aria-hidden="true">
              +
            </span>
            {t.panel.createProfile}
          </button>
        </section>

        <section
          className="profiles-list-section"
          aria-labelledby="profiles-heading"
        >
          <div className="profiles-list-heading">
            <div>
              <h2 id="profiles-heading">{t.panel.yourProfiles}</h2>
              <p>
                {profiles.length === 1
                  ? t.panel.countOne
                  : t.panel.count.replace("{count}", profiles.length)}
              </p>
            </div>
            {profiles.length > 0 && (
              <label className="profile-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.panel.searchPlaceholder}
                  aria-label={t.panel.searchLabel}
                />
              </label>
            )}
          </div>
          {error && (
            <p className="profile-alert" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="profile-notice" role="status">
              {notice}
            </p>
          )}
          {loading ? (
            <div className="profiles-empty-state">
              <span className="loading-dot" />
              <p>{t.panel.loading}</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="profiles-empty-state">
              <span className="empty-profile-icon" aria-hidden="true">
                ♡
              </span>
              <h3>{t.panel.emptyTitle}</h3>
              <p>{t.panel.emptyText}</p>
              <button
                className="profile-button profile-button-outline"
                onClick={() => setEditorMode("create")}
              >
                {t.panel.createFirst}
              </button>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="profiles-empty-state search-empty">
              <h3>{t.panel.noMatches}</h3>
              <p>{t.panel.noMatchesText}</p>
            </div>
          ) : (
            <div className="profile-cards">
              {filteredProfiles.map((profile) => (
                <ProfileCard
                  key={profile._id}
                  profile={profile}
                  t={t}
                  onView={() => onNavigate(`/resultados/${profile._id}`)}
                  onEdit={() => {
                    setSelectedProfile(profile);
                    setEditorMode("edit");
                    setError("");
                  }}
                  onDelete={() => setDeleteProfile(profile)}
                />
              ))}
            </div>
          )}
        </section>
        <p className="profile-medical-note">{t.panel.medicalNote}</p>
      </main>

      {editorMode && (
        <ProfileEditor
          mode={editorMode}
          profile={selectedProfile}
          saving={saving}
          error={error}
          t={t}
          onClose={() => {
            if (!saving) {
              setEditorMode(null);
              setError("");
            }
          }}
          onSubmit={saveProfile}
        />
      )}
      {deleteProfile && (
        <div
          className="profile-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDeleteProfile(null);
          }}
        >
          <section
            className="profile-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-profile-title"
          >
            <h2 id="delete-profile-title">
              {t.panel.deleteTitle.replace(
                "{name}",
                profileDisplayName(deleteProfile),
              )}
            </h2>
            <p>{t.panel.deleteText}</p>
            {error && (
              <p className="profile-alert" role="alert">
                {error}
              </p>
            )}
            <div className="profile-modal-actions">
              <button
                className="profile-button profile-button-outline"
                disabled={saving}
                onClick={() => setDeleteProfile(null)}
              >
                {t.panel.cancel}
              </button>
              <button
                className="profile-button profile-button-danger"
                disabled={saving}
                onClick={confirmDelete}
              >
                {saving ? t.panel.saving : t.panel.deleteConfirm}
              </button>
            </div>
          </section>
        </div>
      )}
      <footer className="profiles-footer">
        <span>
          swira<span>.</span>
        </span>
        <small>{t.panel.footer}</small>
        <button onClick={onSignOut}>{t.nav.signOut}</button>
      </footer>
    </div>
  );
}

export function PanelHeader({ lang, t, changeLanguage, onSignOut, onNavigate }) {
  return (
    <header className="profiles-header">
      <button
        className="profiles-brand"
        onClick={() => onNavigate("/panel")}
        aria-label={t.panel.backPanel}
      >
        <img
            src={`${import.meta.env.BASE_URL}images/swira-icon.png`}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        <span>
          swira<span>.</span>
        </span>
      </button>
      <div className="profiles-header-right">
        <LanguageDropdown lang={lang} changeLanguage={changeLanguage} t={t} />
        {/* <span className="profiles-account">{user.name}</span> */}
        <button className="profiles-sign-out" onClick={onSignOut}>
          {t.nav.signOut}
        </button>
      </div>
    </header>
  );
}

function ProfileCard({ profile, t, onView, onEdit, onDelete }) {
  const details = [];
  if (profile.age) details.push(t.panel.ageValue.replace("{age}", profile.age));
  if (profile.fastingGlucose) details.push(`${profile.fastingGlucose} mg/dL`);
  if (profile.a1c) details.push(`A1C ${profile.a1c}%`);
  return (
    <article className="profile-card">
      <div className="profile-card-top">
        <span className="profile-avatar" aria-hidden="true">
          {profile.name.trim().charAt(0).toLocaleUpperCase()}
        </span>
        <div className="profile-card-name">
          <h3>{profileDisplayName(profile)}</h3>
          <p>{details.length ? details.join(" · ") : t.panel.noDetails}</p>
        </div>
        <span className="profile-card-heart" aria-hidden="true">
          ♡
        </span>
      </div>
      <div className="profile-card-actions">
        <button
          className="profile-button profile-button-primary"
          onClick={onView}
        >
          {t.panel.viewResults}
        </button>
        <button
          className="profile-button profile-button-quiet"
          onClick={onEdit}
        >
          {t.panel.edit}
        </button>
        <button
          className="profile-button profile-button-quiet profile-delete-action"
          onClick={onDelete}
        >
          {t.panel.delete}
        </button>
      </div>
    </article>
  );
}

export function ProfileEditor({ mode, profile, saving, error, t, onClose, onSubmit }) {
  const isCreate = mode === "create";
  const isHealthUpdate = mode === "health";
  const initial = profile || {};
  const [fieldErrors, setFieldErrors] = useState({});

  function validateLive(event) {
    const input = event.currentTarget;
    const message = validateProfileInput(input, t);
    setFieldErrors((current) => {
      if (!message && !current[input.name]) return current;
      const updated = { ...current };
      if (message) updated[input.name] = message;
      else delete updated[input.name];
      return updated;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const fields = Array.from(event.currentTarget.elements).filter(
      (element) => element.name && typeof element.checkValidity === "function",
    );
    const errors = {};
    let firstInvalid;
    for (const field of fields) {
      const message = validateProfileInput(field, t);
      if (message) {
        errors[field.name] = message;
        firstInvalid ||= field;
      }
    }
    setFieldErrors(errors);
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    onSubmit(event);
  }

  return (
    <div
      className="profile-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="profile-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-editor-title"
      >
        <div className="profile-editor-heading">
          <div>
            <span className="profiles-kicker">
              {isCreate ? t.panel.newProfile : isHealthUpdate ? t.results.update : t.panel.editProfile}
            </span>
            <h2 id="profile-editor-title">
              {isCreate ? t.panel.formTitle : isHealthUpdate ? t.results.updateTitle : t.panel.formEditTitle}
            </h2>
            <p>{isCreate ? t.panel.formIntro : isHealthUpdate ? t.results.updateDescription : t.panel.formEditIntro}</p>
          </div>
          <button
            type="button"
            className="profile-modal-close"
            aria-label={t.panel.close}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form className="profile-form" noValidate onSubmit={handleSubmit}>
          {!isHealthUpdate && <div className="profile-form-grid profile-name-grid">
            <ProfileTextField
              field="name"
              label={t.panel.fields.name}
              initial={initial.name}
              required
              error={fieldErrors.name}
              onChange={validateLive}
              onBlur={validateLive}
            />
            <ProfileTextField
              field="paternalSurname"
              label={t.panel.fields.paternalSurname}
              initial={initial.paternalSurname}
              error={fieldErrors.paternalSurname}
              onChange={validateLive}
              onBlur={validateLive}
            />
            <ProfileTextField
              field="maternalSurname"
              label={t.panel.fields.maternalSurname}
              initial={initial.maternalSurname}
              error={fieldErrors.maternalSurname}
              onChange={validateLive}
              onBlur={validateLive}
            />
          </div>}
          {(isCreate || isHealthUpdate) && (
            <>
              <ProfileFieldGroup
                title={t.panel.recommendedTitle}
                subtitle={t.panel.recommendedSubtitle}
              >
                <div className="profile-form-grid">
                  {numericFields.slice(0, 2).map((field) => (
                    <ProfileNumberField
                      key={field[0]}
                      config={field}
                      t={t}
                      initial={initial[field[0]]}
                      error={fieldErrors[field[0]]}
                      onChange={validateLive}
                      onBlur={validateLive}
                    />
                  ))}
                  {selectFields.slice(0, 2).map((field) => (
                    <ProfileSelectField
                      key={field[0]}
                      config={field}
                      t={t}
                      initial={initial[field[0]]}
                      error={fieldErrors[field[0]]}
                      onChange={validateLive}
                      onBlur={validateLive}
                    />
                  ))}
                </div>
              </ProfileFieldGroup>
              <ProfileFieldGroup
                title={t.panel.optionalTitle}
                subtitle={t.panel.optionalSubtitle}
              >
                <div className="profile-form-grid">
                  {numericFields.slice(2).map((field) => (
                    <ProfileNumberField
                      key={field[0]}
                      config={field}
                      t={t}
                      initial={initial[field[0]]}
                      error={fieldErrors[field[0]]}
                      onChange={validateLive}
                      onBlur={validateLive}
                    />
                  ))}
                  {selectFields.slice(2).map((field) => (
                    <ProfileSelectField
                      key={field[0]}
                      config={field}
                      t={t}
                      initial={initial[field[0]]}
                      error={fieldErrors[field[0]]}
                      onChange={validateLive}
                      onBlur={validateLive}
                    />
                  ))}
                </div>
              </ProfileFieldGroup>
            </>
          )}
          <p className="profile-form-disclaimer">{t.panel.formDisclaimer}</p>
          {error && (
            <p className="profile-alert" role="alert">
              {error}
            </p>
          )}
          <div className="profile-modal-actions">
            <button
              type="button"
              className="profile-button profile-button-outline"
              disabled={saving}
              onClick={onClose}
            >
              {t.panel.cancel}
            </button>
            <button
              type="submit"
              className="profile-button profile-button-primary"
              disabled={saving}
            >
              {saving
                ? t.panel.saving
                  : isCreate
                  ? t.panel.saveProfile
                  : isHealthUpdate
                    ? t.results.saveUpdate
                    : t.panel.saveChanges}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProfileTextField({ field, label, initial = "", required = false, error, onChange, onBlur }) {
  return (
    <label className="profile-field">
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      <input
        type="text"
        name={field}
        defaultValue={initial}
        maxLength="80"
        autoComplete={field === "name" ? "given-name" : "off"}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${field}-error` : undefined}
        onChange={onChange}
        onBlur={onBlur}
      />
      {error && <small className="profile-field-error" id={`${field}-error`}>{error}</small>}
    </label>
  );
}

function ProfileFieldGroup({ title, subtitle, children }) {
  return (
    <section className="profile-field-group">
      <div className="profile-field-group-heading">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ProfileNumberField({ config, t, initial, error, onChange, onBlur }) {
  const [field, , min, max, step, unit] = config;
  return (
    <label className="profile-field">
      <span>
        {t.panel.fields[field]}
        {unit ? <small> ({unit})</small> : null}
      </span>
      <input
        type="number"
        name={field}
        defaultValue={initial ?? ""}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        placeholder={`${min}–${max}`}
        data-unit={unit}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${field}-error` : undefined}
        onChange={onChange}
        onBlur={onBlur}
      />
      {error && <small className="profile-field-error" id={`${field}-error`}>{error}</small>}
    </label>
  );
}

function ProfileSelectField({ config, t, initial, error, onChange, onBlur }) {
  const [field, kind] = config;
  const options =
    kind === "yesNo"
      ? [
          ["true", t.panel.yes],
          ["false", t.panel.no],
        ]
      : kind === "sex"
        ? [
            ["male", t.panel.male],
            ["female", t.panel.female],
          ]
        : kind === "education"
          ? t.panel.educationOptions
          : t.panel.incomeOptions;
  let initialValue = initial;
  if (typeof initial === "boolean") initialValue = String(initial);
  return (
    <label className="profile-field">
      <span>{t.panel.fields[field]}</span>
      <select name={field} defaultValue={initialValue || ""} aria-invalid={Boolean(error)} aria-describedby={error ? `${field}-error` : undefined} onChange={onChange} onBlur={onBlur}>
        <option value="">{t.panel.preferNot}</option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error && <small className="profile-field-error" id={`${field}-error`}>{error}</small>}
    </label>
  );
}
