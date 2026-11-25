"""Flask entry point for the Swira AI service."""
import os
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from modelosAI.routes import modelos_ai
from sistemaExperto.routes import sistema_experto
from sistemaExperto.security import require_jwt

load_dotenv()


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 32 * 1024
    app.config["JSON_AS_ASCII"] = False

    origins = [item.strip() for item in os.getenv(
        "AI_ALLOWED_ORIGINS", os.getenv("FRONTEND_URL", "http://localhost:5173")
    ).split(",") if item.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "OPTIONS"])
    app.register_blueprint(modelos_ai, url_prefix="/api/modelosAI")
    app.register_blueprint(sistema_experto, url_prefix="/api/sistemaExperto")

    @app.get("/health")
    def health():
        response = jsonify({"status": "ok", "service": "swira-ai"})
        response.headers["X-Health-Status"] = "healthy"
        response.headers["Cache-Control"] = "no-store"
        return response, 200

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        messages = {400: "Revisa la información enviada.", 401: "Inicia sesión para continuar.",
                    404: "No encontramos esa dirección.", 413: "La solicitud es demasiado grande.",
                    415: "Envía la información en formato JSON."}
        return jsonify({"error": {"message": messages.get(error.code, "No se pudo completar la solicitud.")}}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(_error):
        app.logger.exception("Unhandled AI service error")
        return jsonify({"error": {"message": "No pudimos procesar la solicitud. Inténtalo más tarde."}}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
