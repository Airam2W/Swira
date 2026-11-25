import os
from functools import wraps
from flask import jsonify, request
import jwt

def _token_from_request():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return request.cookies.get("swira_session")

def require_jwt(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        secret = os.getenv("JWT_SECRET", "")
        if len(secret) < 32:
            return jsonify(error={"message": "El servicio de autenticación aún no está configurado."}), 503
        token = _token_from_request()
        if not token:
            return jsonify(error={"message": "Inicia sesión para continuar."}), 401
        try:
            claims = jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "iat", "sub"]})
            if not isinstance(claims.get("sub"), str) or not claims["sub"]:
                raise jwt.InvalidTokenError("invalid subject")
        except jwt.ExpiredSignatureError:
            return jsonify(error={"message": "Tu sesión venció. Inicia sesión nuevamente."}), 401
        except jwt.InvalidTokenError:
            return jsonify(error={"message": "La sesión no es válida. Inicia sesión nuevamente."}), 401
        request.user = {"id": claims["sub"], "email": claims.get("email")}
        return view(*args, **kwargs)
    return wrapped
