# Python API image. Build from the repository root:  docker build -f api/Dockerfile .
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/api
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api/app.py .
EXPOSE 5000
# --preload creates tables / the first admin once, before the workers start.
CMD ["gunicorn", "--preload", "-w", "2", "-b", "0.0.0.0:5000", "--timeout", "60", "app:app"]
