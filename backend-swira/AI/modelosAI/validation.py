import math
from flask import jsonify, request

CLINICAL = {
    "edad": (0, 120), "Peso": (2, 350), "Estatura": (0.5, 2.5), "imc": (8, 100),
    "glu_suero": (20, 800), "hb1ac": (2, 25), "insulina": (0, 3000),
    "trig": (10, 10000), "col_hdl": (1, 300), "col_ldl": (1, 1000),
    "ac_urico": (0, 30), "sexo_Hombre": (0, 1), "sexo_Mujer": (0, 1),
}
BEHAVIORAL = {
    "PhysActivity": (0, 1), "Smoker": (0, 1), "HighBP": (0, 1), "Fruits": (0, 1),
    "BMI": (12, 98), "Sex": (0, 1), "Age": (1, 13), "Veggies": (0, 1),
    "HvyAlcoholConsump": (0, 1), "DiffWalk": (0, 1), "MentHlth": (0, 30),
    "AnyHealthcare": (0, 1), "NoDocbcCost": (0, 1), "Education": (1, 6), "Income": (1, 8),
}
BEHAVIORAL_REQUEST = {**BEHAVIORAL, "Age": (0, 120)}
EXPERT_CLINICAL = {
    "edad": (0, 120), "imc": (8, 100), "glu_suero": (20, 800), "hb1ac": (2, 25),
    "insulina": (0, 3000), "trig": (10, 10000), "col_hdl": (1, 300), "col_ldl": (1, 1000),
    "ac_urico": (0, 30), "HighBP": (0, 1), "Sex": (0, 1), "Peso": (2, 350),
    "Estatura": (0.5, 2.5), "sexo_Hombre": (0, 1), "sexo_Mujer": (0, 1),
}
EXPERT_BEHAVIORAL = {**BEHAVIORAL_REQUEST, "BMI": (12, 98)}
INTEGER_FIELDS = {"edad", "sexo_Hombre", "sexo_Mujer", "PhysActivity", "Smoker", "HighBP",
                  "Fruits", "Sex", "Age", "Veggies", "HvyAlcoholConsump", "DiffWalk",
                  "MentHlth", "AnyHealthcare", "NoDocbcCost", "Education", "Income"}

def validate_feature_object(value, schema, label):
    if not isinstance(value, dict):
        return None, f"{label}: envía un objeto con los datos solicitados."
    extra = [key for key in value if key not in schema]
    if extra:
        return None, f"El campo {extra[0]} no forma parte de los datos aceptados."
    cleaned = {}
    for key, (minimum, maximum) in schema.items():
        raw = value.get(key)
        if raw is None:
            cleaned[key] = None
            continue
        if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
            return None, f"El campo {key} debe ser un número válido o null."
        if raw < minimum or raw > maximum:
            return None, f"El campo {key} debe estar entre {minimum} y {maximum}."
        if key in INTEGER_FIELDS and not float(raw).is_integer():
            return None, f"El campo {key} debe ser un número entero."
        if minimum == 0 and maximum == 1 and raw not in (0, 1):
            return None, f"El campo {key} solo acepta 0, 1 o null."
        cleaned[key] = raw
    return cleaned, None

def read_json():
    if not request.is_json:
        return None, (jsonify(error={"message": "Envía la información en formato JSON."}), 415)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, (jsonify(error={"message": "Revisa la información enviada; debe ser un objeto JSON."}), 400)
    return payload, None

def validate_and_error(value, schema, label):
    cleaned, error = validate_feature_object(value, schema, label)
    if error is None and schema in (CLINICAL, EXPERT_CLINICAL):
        man, woman = cleaned["sexo_Hombre"], cleaned["sexo_Mujer"]
        if man == 1 and woman == 1:
            return None, (jsonify(error={"message": "Elige una sola opción para sexo: hombre o mujer."}), 400)
    return (cleaned, None) if error is None else (None, (jsonify(error={"message": error}), 400))
