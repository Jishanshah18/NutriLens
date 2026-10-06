FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (including tesseract and OpenCV graphics libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    libgl1 \
    libglib2.0-0 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port (Render sets dynamic $PORT at runtime)
EXPOSE 8000

# Start Uvicorn server dynamically on $PORT (defaults to 8000 for local Docker)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]

