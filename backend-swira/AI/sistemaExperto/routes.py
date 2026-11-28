import math
from pathlib import Path
from flask import Blueprint, jsonify
from catboost import CatBoostClassifier
from modelosAI.validation import EXPERT_CLINICAL, EXPERT_BEHAVIORAL, read_json, validate_and_error
from sistema_experto.eyra import getEYRAnalysis, unificarData
from sistema_experto.graphics import getMetrics
from sistema_experto.modelSUnificate import clinicPrediction, conductualPrediction
from .security import require_jwt

sistema_experto = Blueprint("sistema_experto", __name__)

def _validated_history(payload):
    if set(payload) != {"clinico", "conductual"}:
        return None, (jsonify(error={"message": "Incluye los apartados clinico y conductual."}), 400)
    clinic, error = validate_and_error(payload["clinico"], EXPERT_CLINICAL, "datos clínicos")
    if error: return None, error
    behavior, error = validate_and_error(payload["conductual"], EXPERT_BEHAVIORAL, "datos conductuales")
    if error: return None, error
    for behavior_key, clinic_key in (("Age", "edad"), ("BMI", "imc"), ("Sex", "Sex")):
        if _is_missing(behavior.get(behavior_key)) and not _is_missing(clinic.get(clinic_key)):
            behavior[behavior_key] = clinic[clinic_key]
    return {"clinico": clinic, "conductual": behavior}, None

def _value(data, key):
    value = data.get(key)
    return math.nan if value is None or (isinstance(value, (int, float)) and math.isnan(value)) else value

def _is_missing(value):
    return value is None or (isinstance(value, (int, float)) and math.isnan(value))

def _json_safe(value):
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return None if not math.isfinite(float(value)) else value
    return value

def _age_band(age):
    if _is_missing(age) or age < 18:
        return math.nan
    if age < 25:
        return 1
    if age >= 80:
        return 13
    return int((age - 25) // 5 + 2)

def _model_inputs(history):
    clinic = history["clinico"]
    behavior = history["conductual"]
    sex = _value(clinic, "Sex")
    if _is_missing(sex):
        sex = _value(behavior, "Sex")
    man = _value(clinic, "sexo_Hombre")
    woman = _value(clinic, "sexo_Mujer")
    if _is_missing(man) and not _is_missing(sex):
        man, woman = sex, 1 - sex
    clinical_model = {
        "edad": _value(clinic, "edad"), "Peso": _value(clinic, "Peso"),
        "Estatura": _value(clinic, "Estatura"), "imc": _value(clinic, "imc"),
        "glu_suero": _value(clinic, "glu_suero"), "hb1ac": _value(clinic, "hb1ac"),
        "insulina": _value(clinic, "insulina"), "trig": _value(clinic, "trig"),
        "col_hdl": _value(clinic, "col_hdl"), "col_ldl": _value(clinic, "col_ldl"),
        "ac_urico": _value(clinic, "ac_urico"), "sexo_Hombre": man, "sexo_Mujer": woman,
    }
    behavioral_model = {
        "PhysActivity": _value(behavior, "PhysActivity"), "Smoker": _value(behavior, "Smoker"),
        "HighBP": _value(clinic, "HighBP"), "Fruits": _value(behavior, "Fruits"),
        "BMI": _value(behavior, "BMI"), "Sex": sex, "Age": _age_band(_value(behavior, "Age")),
        "Veggies": _value(behavior, "Veggies"), "HvyAlcoholConsump": _value(behavior, "HvyAlcoholConsump"),
        "DiffWalk": _value(behavior, "DiffWalk"), "MentHlth": _value(behavior, "MentHlth"),
        "AnyHealthcare": _value(behavior, "AnyHealthcare"), "NoDocbcCost": _value(behavior, "NoDocbcCost"),
        "Education": _value(behavior, "Education"), "Income": _value(behavior, "Income"),
    }
    return clinical_model, behavioral_model

def _compute_expert(history):
    clinical_model_input, behavioral_model_input = _model_inputs(history)
    clinical_probability = clinicPrediction(clinical_model_input)
    behavioral_probability = conductualPrediction(behavioral_model_input)
    model_dir = Path(__file__).resolve().parents[1] / "sistema_experto"
    clinical_model = CatBoostClassifier()
    clinical_model.load_model(str(model_dir / "clinicModel.cbm"))
    behavioral_model = CatBoostClassifier()
    behavioral_model.load_model(str(model_dir / "conductualModel.cbm"))

    expert_result = getEYRAnalysis(
        unificarData(history), clinical_probability, behavioral_probability,
        clinical_model, behavioral_model,
    )
    chart_behavior = dict(history["conductual"])
    chart_behavior["HighBP"] = history["clinico"].get("HighBP")
    chart_data = _json_safe(getMetrics(history["clinico"], chart_behavior))
    return expert_result, chart_data, clinical_probability, behavioral_probability

def _analysis(key):
    payload, error = read_json()
    if error: return error
    history, error = _validated_history(payload)
    if error: return error
    result, _, _, _ = _compute_expert(history)
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
    _, chart_data, _, _ = _compute_expert(history)
    return jsonify({"datosGraficas": chart_data})

@sistema_experto.post("/obtenerGuiaCompleta")
@require_jwt
def obtener_guia_completa():
    payload, error = read_json()
    if error: return error
    history, error = _validated_history(payload)
    if error: return error
    analysis, chart_data, clinical_probability, behavioral_probability = _compute_expert(history)
    return jsonify({
        "prediccionClinica": clinical_probability,
        "prediccionConductual": behavioral_probability,
        "resumen": analysis["analisis"],
        "explicaciones": analysis["explicaciones"],
        "recomendaciones": analysis["recomendaciones"],
        "datosGraficas": chart_data,
    })
