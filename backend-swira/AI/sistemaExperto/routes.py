from flask import Blueprint, jsonify
from modelosAI.validation import CLINICAL, BEHAVIORAL, read_json, validate_and_error
from sistema_experto.modelSUnificate import getEYRA, getMetricas
from .security import require_jwt

sistema_experto = Blueprint("sistema_experto", __name__)

def _validated_history(payload):
    if set(payload) != {"clinico", "conductual"}:
        return None, (jsonify(error={"message": "Incluye los apartados clinico y conductual."}), 400)
    clinic, error = validate_and_error(payload["clinico"], CLINICAL, "datos clínicos")
    if error: return None, error
    behavior, error = validate_and_error(payload["conductual"], BEHAVIORAL, "datos conductuales")
    if error: return None, error
    return {"clinico": clinic, "conductual": behavior}, None

def _analysis(key):
    payload, error = read_json()
    if error: return error
    history, error = _validated_history(payload)
    if error: return error
    result = getEYRA(history)
    return jsonify({key: result[{"obtenerResumen": "analisis", "obtenerExplicaciones": "explicaciones",
                                "obtenerRecomendaciones": "recomendaciones"}[key]]})

@sistema_experto.post("/obtenerResumen")
@require_jwt
def obtener_resumen(): return _analysis("obtenerResumen")

@sistema_experto.post("/obtenerExplicaciones")
@require_jwt
def obtener_explicaciones(): return _analysis("obtenerExplicaciones")

@sistema_experto.post("/obtenerRecomendaciones")
@require_jwt
def obtener_recomendaciones(): return _analysis("obtenerRecomendaciones")

@sistema_experto.post("/obtenerDatosGraficas")
@require_jwt
def obtener_datos_graficas():
    payload, error = read_json()
    if error: return error
    history, error = _validated_history(payload)
    if error: return error
    metric_history = {
        section: {key: (None if value != value else value)
                  for key, value in values.items()}
        for section, values in history.items()
    }
    return jsonify({"datosGraficas": getMetricas(metric_history)})
