from flask import Blueprint, jsonify
from sistema_experto.modelSUnificate import clinicPrediction, conductualPrediction
from .validation import CLINICAL, BEHAVIORAL, read_json, validate_and_error
from sistemaExperto.security import require_jwt

modelos_ai = Blueprint("modelos_ai", __name__)

@modelos_ai.post("/obtenerPrediccionClinica")
@require_jwt
def obtener_prediccion_clinica():
    payload, error = read_json()
    if error: return error
    data, error = validate_and_error(payload, CLINICAL, "datos clínicos")
    if error: return error
    return jsonify({"prediccionClinica": clinicPrediction(data)})

@modelos_ai.post("/obtenerPrediccionConductual")
@require_jwt
def obtener_prediccion_conductual():
    payload, error = read_json()
    if error: return error
    data, error = validate_and_error(payload, BEHAVIORAL, "datos conductuales")
    if error: return error
    return jsonify({"prediccionConductual": conductualPrediction(data)})
