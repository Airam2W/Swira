import { useCallback, useEffect, useState, useRef, useSyncExternalStore } from "react";
import "./App.css";
import "./pages/ProfilesPage.css";
import es from "./locales/es.json";
import en from "./locales/en.json";
import { LanguageDropdown } from "./components/LanguageDropdown.jsx";
import { ProfilesPage } from "./pages/ProfilesPage.jsx";

const messages = { es, en };
const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiUrl = (
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"
).replace(/\/$/, "");

function appPath(path) {
  const [pathname, query] = path.split("?");
  return `${appBase}${pathname}${query ? `?${query}` : ""}` || "/";
}

function subscribeToRoute(callback) {
  window.addEventListener("popstate", callback);
  window.addEventListener("swira:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("swira:navigate", callback);
  };
}

function currentRoute() {
  return `${window.location.pathname}${window.location.search}`;
}

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    activity: (
      <>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </>
    ),
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    close: (
      <>
        <path d="m18 6-12 12M6 6l12 12" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function App() {
  const [lang, setLang] = useState(
    () => localStorage.getItem("swira-language") || "es",
  );
  const [authMode, setAuthMode] = useState(() => new URLSearchParams(window.location.search).get("login") === "1" ? "login" : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [contactStatus, setContactStatus] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const t = messages[lang];
  const route = useSyncExternalStore(subscribeToRoute, currentRoute, () => "/");

  const navigate = useCallback((path) => {
    const url = appPath(path);
    window.history.pushState({}, "", url);
    if (url.includes("login=1")) setAuthMode("login");
    window.dispatchEvent(new Event("swira:navigate"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const expireSession = useCallback(() => {
    setUser(null);
    navigate("/?login=1");
  }, [navigate]);

  useEffect(() => {
    const currentPath = window.location.pathname.replace(/\/$/, "");
    const protectedRoute = currentPath.endsWith("/panel") || currentPath.includes("/resultados/");
    fetch(`${apiUrl}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (!protectedRoute) {
            window.history.replaceState({}, "", appPath("/panel"));
            window.dispatchEvent(new Event("swira:navigate"));
          }
        } else if (protectedRoute) {
          window.history.replaceState({}, "", appPath("/?login=1"));
          setAuthMode("login");
          window.dispatchEvent(new Event("swira:navigate"));
        }
      })
      .catch(() => {
        if (protectedRoute) {
          window.history.replaceState({}, "", appPath("/?login=1"));
          setAuthMode("login");
          window.dispatchEvent(new Event("swira:navigate"));
        }
      })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

// Dentro de tu componente (donde ya tienes el estado del menú móvil, ej. menuOpen / setMenuOpen):
const headerRef = useRef(null);

useEffect(() => {
  if (!menuOpen) return;

  const handleClickOutside = (e) => {
    if (headerRef.current && !headerRef.current.contains(e.target)) {
      setMenuOpen(false);
    }
  };

  const handleEscape = (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  };

  document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("touchstart", handleClickOutside);
  document.addEventListener("keydown", handleEscape);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("touchstart", handleClickOutside);
    document.removeEventListener("keydown", handleEscape);
  };
}, [menuOpen]);

  function changeLanguage(value) {
    localStorage.setItem("swira-language", value);
    setLang(value);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/auth/${authMode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = response.status === 409
          ? t.auth.emailExists
          : response.status === 400
            ? t.auth.invalidData
            : response.status === 401 && authMode === "login"
              ? t.auth.invalidCredentials
              : t.auth.error;
        throw new Error(message);
      }
      setUser(result.user);
      setAuthMode(null);
      navigate("/panel");
    } catch (error) {
      const localizedMessages = [t.auth.emailExists, t.auth.invalidData, t.auth.invalidCredentials];
      setAuthError(localizedMessages.includes(error.message) ? error.message : t.auth.error);
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setUser(null);
    window.location.replace(appPath("/"));
  }

  function prepareContactMessage(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = new FormData(form).get("message");
    if (typeof content !== "string" || !content.trim()) {
      setContactStatus(t.about.messageRequired);
      return;
    }
    setContactStatus(t.about.draftReady);
  }

  function openAuth(mode) {
    setAuthError("");
    setAuthMode(mode);
    setMenuOpen(false);
  }

  if (route.replace(/\/$/, "").endsWith("/panel")) {
    if (!authChecked || !user) {
      return <div className="panel-loading" role="status">{t.panel.loading}</div>;
    }
    return (
      <ProfilesPage
        apiUrl={apiUrl}
        user={user}
        lang={lang}
        t={t}
        changeLanguage={changeLanguage}
        onSignOut={signOut}
        onNavigate={navigate}
        onSessionExpired={expireSession}
      />
    );
  }

  if (route.includes("/resultados/") && authChecked && user) {
    return (
      <ProfilesPage
        apiUrl={apiUrl}
        user={user}
        lang={lang}
        t={t}
        changeLanguage={changeLanguage}
        onSignOut={signOut}
        onNavigate={navigate}
        onSessionExpired={expireSession}
        resultsComingSoon
      />
    );
  }

  return (
    <div className="site-shell">
      <header className="site-header" ref={headerRef}>
        <a className="brand" href="#inicio" aria-label="Swira, inicio">
          <img
            src={`${import.meta.env.BASE_URL}images/swira-icon.png`}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <span>
            swira<span className="brand-period">.</span>
          </span>
        </a>
        <button
          className="menu-toggle"
          aria-label={menuOpen ? t.nav.close : t.nav.menu}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
        <nav className={`main-nav ${menuOpen ? "is-open" : ""}`}>
          <a href="#como-funciona" onClick={() => setMenuOpen(false)}>
            {t.nav.how}
          </a>
          <a href="#privacidad" onClick={() => setMenuOpen(false)}>
            {t.nav.privacy}
          </a>
          <a href="#nosotros" onClick={() => setMenuOpen(false)}>
            {t.nav.about}
          </a>
          <label className="language-select">
            <span className="sr-only">{t.nav.language}</span>
            <LanguageDropdown
              lang={lang}
              changeLanguage={changeLanguage}
              t={t}
            />
          </label>
          {user ? (
            <div className="user-menu">
              <span>
                {t.nav.hello}, {user.name.split(" ")[0]}
              </span>
              <button
                className="button button-outline button-small"
                onClick={signOut}
              >
                {t.nav.signOut}
              </button>
            </div>
          ) : (
            <>
              <button className="nav-login" onClick={() => openAuth("login")}>
                {t.nav.login}
              </button>
              <button
                className="button button-primary button-small"
                onClick={() => openAuth("register")}
              >
                {t.nav.register}
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              {t.hero.eyebrow}
            </span>
            <h1>
              {t.hero.title}
              <span>{t.hero.titleAccent}</span>
            </h1>
            <p className="hero-description">{t.hero.description}</p>
            <div className="hero-actions">
              <button
                className="button button-primary button-large"
                onClick={() => openAuth("register")}
              >
                {t.hero.cta}
                <Icon name="arrow" size={18} />
              </button>
              <a className="text-link" href="#como-funciona">
                {t.hero.secondary}
                <span>↓</span>
              </a>
            </div>
            <div className="hero-trust">
              <div className="trust-icon">
                <Icon name="shield" size={17} />
              </div>
              <span>{t.hero.trust}</span>
            </div>
          </div>
          <div className="hero-art" aria-label={t.hero.visualAlt} role="img">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="sun-disc" />
            <img
              className="hero-image-slot"
              src={`${import.meta.env.BASE_URL}images/hero-health.png`}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <div className="health-card">
              <div className="card-topline">
                <span className="card-icon">
                  <Icon name="activity" size={19} />
                </span>
                <span className="card-menu">•••</span>
              </div>
              <p className="card-label">{t.hero.cardLabel}</p>
              <h3>{t.hero.cardTitle}</h3>
              <div className="chart-wrap">
                <svg
                  viewBox="0 0 310 115"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#8ddbc7" stopOpacity=".45" />
                      <stop offset="1" stopColor="#8ddbc7" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 84 C25 79 30 60 54 65 S81 83 105 55 S140 62 163 37 S199 53 225 33 S262 44 284 18 S301 28 310 10 V115 H0Z"
                    fill="url(#chartFill)"
                  />
                  <path
                    d="M0 84 C25 79 30 60 54 65 S81 83 105 55 S140 62 163 37 S199 53 225 33 S262 44 284 18 S301 28 310 10"
                    fill="none"
                    stroke="#3bb89c"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="chart-foot">
                <span>{t.hero.chartCaption}</span>
                <span className="chart-dot" />
                {t.hero.chartStatus}
              </div>
            </div>
            <div className="floating-note note-one">
              <span className="note-icon mint">
                <Icon name="heart" size={17} />
              </span>
              <span>
                <b>{t.hero.noteOneTitle}</b>
                <small>{t.hero.noteOneCaption}</small>
              </span>
            </div>
            <div className="floating-note note-two">
              <span className="note-icon blue">
                <Icon name="shield" size={17} />
              </span>
              <span>
                <b>{t.hero.noteTwoTitle}</b>
                <small>{t.hero.noteTwoCaption}</small>
              </span>
            </div>
            <span className="art-spark spark-one">✳</span>
            <span className="art-spark spark-two">✦</span>
          </div>
        </section>

        <section className="signal-strip">
          <div className="signal-inner">
            <span className="signal-lead">{t.signals.title}</span>
            <span>
              <Icon name="activity" />
              {t.signals.clinical}
            </span>
            <span>
              <Icon name="heart" />
              {t.signals.habits}
            </span>
            <span>
              <Icon name="shield" />
              {t.signals.private}
            </span>
          </div>
        </section>

        <section className="section how-section" id="como-funciona">
          <div className="section-heading">
            <span className="eyebrow">{t.how.eyebrow}</span>
            <h2>
              {t.how.title}
              <span>{t.how.titleAccent}</span>
            </h2>
            <p>{t.how.description}</p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span>
              <div className="step-icon icon-blue">
                <Icon name="activity" size={23} />
              </div>
              <h3>{t.how.step1Title}</h3>
              <p>{t.how.step1Text}</p>
            </article>
            <article className="step-card">
              <span className="step-number">02</span>
              <div className="step-icon icon-green">
                <Icon name="heart" size={23} />
              </div>
              <h3>{t.how.step2Title}</h3>
              <p>{t.how.step2Text}</p>
            </article>
            <article className="step-card">
              <span className="step-number">03</span>
              <div className="step-icon icon-peach">
                <Icon name="arrow" size={23} />
              </div>
              <h3>{t.how.step3Title}</h3>
              <p>{t.how.step3Text}</p>
            </article>
          </div>
        </section>

        <section className="privacy-section" id="privacidad">
          <div className="privacy-visual">
            <div className="privacy-orb">
              <Icon name="lock" size={42} />
            </div>
            <span className="privacy-spark">✳</span>
            <div className="privacy-caption">
              <Icon name="shield" size={16} />
              {t.privacy.visualCaption}
            </div>
          </div>
          <div className="privacy-copy">
            <span className="eyebrow">{t.privacy.eyebrow}</span>
            <h2>
              {t.privacy.title}
              <span>{t.privacy.titleAccent}</span>
            </h2>
            <p>{t.privacy.description}</p>
            <ul>
              <li>
                <Icon name="shield" size={18} />
                {t.privacy.point1}
              </li>
              <li>
                <Icon name="lock" size={18} />
                {t.privacy.point2}
              </li>
              <li>
                <Icon name="heart" size={18} />
                {t.privacy.point3}
              </li>
            </ul>
          </div>
        </section>

        <section className="about-section section" id="nosotros">
          <div>
            <span className="eyebrow">{t.about.eyebrow}</span>
            <h2>
              {t.about.title}
              <span>{t.about.titleAccent}</span>
            </h2>
          </div>
          <div className="about-copy">
            <p>{t.about.description}</p>
            <form
              className="contact-form"
              onSubmit={prepareContactMessage}
              data-recipient="airam2ww@gmail.com"
              data-subject="Mensaje de contacto de Swira"
            >
              <label>
                {t.about.nameLabel}
                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength="80"
                  placeholder={t.about.namePlaceholder}
                />
              </label>
              <label>
                {t.about.emailLabel}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength="254"
                  placeholder={t.about.emailPlaceholder}
                />
              </label>
              <label className="contact-message-field">
                {t.about.messageLabel}
                <textarea
                  name="message"
                  rows="4"
                  maxLength="3000"
                  placeholder={t.about.messagePlaceholder}
                  required
                />
              </label>
              {contactStatus && (
                <p className="contact-status" role="status">
                  {contactStatus}
                </p>
              )}
              <button
                className="button button-primary contact-submit"
                type="submit"
              >
                {t.about.submit}
                <Icon name="arrow" size={16} />
              </button>
              <small className="contact-note">{t.about.note}</small>
            </form>
          </div>
        </section>

        <section className="disclaimer">
          <span className="disclaimer-icon">
            <Icon name="heart" size={18} />
          </span>
          <p>
            <strong>{t.disclaimer.title}</strong> {t.disclaimer.text}
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#inicio">
          <span>
            swira<span className="brand-period">.</span>
          </span>
        </a>
        <span>{t.footer.rights}</span>
        <div>
          <a href="#nosotros">{t.footer.support}</a>
          <a href="#privacidad">{t.footer.privacy}</a>
        </div>
      </footer>

      {authMode && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAuthMode(null);
          }}
        >
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              className="modal-close"
              onClick={() => setAuthMode(null)}
              aria-label={t.auth.close}
            >
              <Icon name="close" />
            </button>
            <div className="auth-brand">
              <span>
                swira<span className="brand-period">.</span>
              </span>
            </div>
            <span className="eyebrow">
              {authMode === "register"
                ? t.auth.createEyebrow
                : t.auth.loginEyebrow}
            </span>
            <h2 id="auth-title">
              {authMode === "register" ? t.auth.createTitle : t.auth.loginTitle}
            </h2>
            <p className="auth-intro">
              {authMode === "register" ? t.auth.createText : t.auth.loginText}
            </p>
            <form onSubmit={submitAuth} className="auth-form">
              {authMode === "register" && (
                <label>
                  {t.auth.name}
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder={t.auth.namePlaceholder}
                    minLength="2"
                    maxLength="80"
                    required
                  />
                </label>
              )}
              <label>
                {t.auth.email}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  maxLength="254"
                  required
                />
              </label>
              <label>
                {t.auth.password}
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    authMode === "register"
                      ? "new-password"
                      : "current-password"
                  }
                  placeholder="••••••••"
                  minLength={authMode === "register" ? 10 : 1}
                  maxLength="128"
                  required
                />
                {authMode === "register" && (
                  <small>{t.auth.passwordHint}</small>
                )}
              </label>
              {authError && (
                <p className="form-error" role="alert">
                  {authError}
                </p>
              )}
              <button
                className="button button-primary button-large form-submit"
                disabled={authLoading}
              >
                {authLoading
                  ? t.auth.loading
                  : authMode === "register"
                    ? t.auth.createButton
                    : t.auth.loginButton}
                <Icon name="arrow" size={18} />
              </button>
            </form>
            <p className="auth-switch">
              {authMode === "register" ? t.auth.hasAccount : t.auth.noAccount}
              <button
                onClick={() => {
                  setAuthError("");
                  setAuthMode(authMode === "register" ? "login" : "register");
                }}
              >
                {authMode === "register" ? t.nav.login : t.nav.register}
              </button>
            </p>
            <p className="auth-legal">
              <Icon name="lock" size={14} />
              {t.auth.legal}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
