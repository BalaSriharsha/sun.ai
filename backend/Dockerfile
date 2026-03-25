FROM python:3.11-slim

# Install system dependencies for document parsing (tesseract, ffmpeg, libmagic)
RUN echo 'Acquire::http::Pipeline-Depth "0";' > /etc/apt/apt.conf.d/99custom \
    && echo 'Acquire::Retries "3";' >> /etc/apt/apt.conf.d/99custom \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get update \
    && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    ffmpeg \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Expose port (FastAPI default)
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
