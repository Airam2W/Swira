# Servicio de inteligencia artificial de Swira

## Ejecución local

Desde esta carpeta, crea el entorno e instala `requirements.txt`. Copia `.env-example` a `.env`, configura `JWT_SECRET` con el mismo valor privado que usa NestJS y ajusta `AI_ALLOWED_ORIGINS`.

```sh
python -m venv .venv
pip install -r requirements.txt
python app.py
```

En Render, configura como raíz del servicio `backend-swira/AI`, instala `pip install -r requirements.txt` y usa `gunicorn --bind 0.0.0.0:$PORT app:app`. Configura `JWT_SECRET` idéntico al de NestJS y `AI_ALLOWED_ORIGINS` con el dominio del frontend. El endpoint público `GET /health` responde 200 y envía `X-Health-Status: healthy`.

## Rutas protegidas

Todas las rutas `/api/*` requieren el JWT HS256 de NestJS, mediante `Authorization: Bearer <token>` o la cookie `swira_session`.

- `POST /api/modelosAI/obtenerPrediccionClinica`
- `POST /api/modelosAI/obtenerPrediccionConductual`
- `POST /api/sistemaExperto/obtenerResumen`
- `POST /api/sistemaExperto/obtenerExplicaciones`
- `POST /api/sistemaExperto/obtenerRecomendaciones`
- `POST /api/sistemaExperto/obtenerDatosGraficas`

Los dos endpoints de predicción reciben directamente el esquema nativo de los modelos descrito en `modelosAI/validation.py`. Los endpoints del sistema experto reciben `{ "clinico": { ... }, "conductual": { ... } }` con ambos esquemas nativos completos; los valores faltantes se envían como `null`. Las variables del modelo conductual conservan sus códigos originales (por ejemplo, `Age` de 1 a 13, `Education` de 1 a 6 e `Income` de 1 a 8). La API no traduce los campos del formulario de perfiles automáticamente.

Los resultados son una guía informativa y no sustituyen la valoración de profesionales de la salud.
