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
- `POST /api/sistemaExperto/obtenerGuiaCompleta`

Los endpoints de predicción aceptan los campos del modelo aunque algunos se omitan; los campos ausentes o `null` se convierten en valores faltantes para CatBoost. El endpoint conductual recibe `Age` en años y lo convierte al grupo de edad usado por ese modelo (1 a 13). Educación e ingresos se reciben como códigos ordinales numéricos (`Education` de 1 a 6, `Income` de 1 a 8).

Los endpoints del Sistema Experto reciben `{ "clinico": { ... }, "conductual": { ... } }` con el esquema mostrado en la guía de Swira: la edad conductual va en años, `HighBP` y `Sex` se aceptan en el apartado clínico, y los valores opcionales se pueden omitir o enviar como `null`. La API genera por dentro el esquema CatBoost correspondiente y conserva la edad real para las explicaciones de EYRA. `obtenerGuiaCompleta` devuelve las dos estimaciones, resumen, explicaciones, recomendaciones y datos gráficos en una sola solicitud.

NestJS hace la conversión desde el perfil: edad real para el Sistema Experto y categoría de edad para el modelo conductual; sexo se representa como 0/1 en el modelo de hábitos y como columnas indicadoras en el modelo clínico; educación e ingresos usan el orden numérico de sus opciones. Todos los campos pueden quedar vacíos; en ese caso se genera una guía usando los valores faltantes admitidos por los modelos.

Los resultados son una guía informativa y no sustituyen la valoración de profesionales de la salud.
