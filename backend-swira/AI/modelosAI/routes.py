import math
from flask import Blueprint, jsonify
from sistema_experto.modelSUnificate import clinicPrediction, conductualPrediction
from .validation import CLINICAL, BEHAVIORAL_REQUEST, read_json, validate_and_error
from sistemaExperto.security import require_jwt

modelos_ai = Blueprint("modelos_ai", __name__)

@modelos_ai.post("/obtenerPrediccionClinica")
@require_jwt
def obtener_prediccion_clinica():
    payload, error = read_json()
    if error: return error
    data, error = validate_and_error(payload, CLINICAL, "datos clínicos")
    if error: return error
    data = {key: (math.nan if value is None else value) for key, value in data.items()}
    return jsonify({"prediccionClinica": clinicPrediction(data)})

@modelos_ai.post("/obtenerPrediccionConductual")
@require_jwt
def obtener_prediccion_conductual():
    payload, error = read_json()
    if error: return error
    data, error = validate_and_error(payload, BEHAVIORAL_REQUEST, "datos conductuales")
    if error: return error
    age = data["Age"]
    if age is None:
        age = math.nan
    if not math.isnan(age):
        if age < 18:
            data["Age"] = float("nan")
        elif age < 25:
            data["Age"] = 1
        elif age >= 80:
            data["Age"] = 13
        else:
            data["Age"] = int((age - 25) // 5 + 2)
    data = {key: (math.nan if value is None else value) for key, value in data.items()}
    return jsonify({"prediccionConductual": conductualPrediction(data)})
