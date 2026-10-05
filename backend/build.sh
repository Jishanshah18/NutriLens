#!/usr/bin/env bash
# Exit on error
set -e

echo "=== NutriLens Backend Cloud Build Script ==="
echo "Python version:"
python --version

echo "1. Installing backend dependencies from requirements.txt..."
pip install --upgrade pip
pip install -r requirements.txt

echo "2. Enforcing opencv-python-headless to prevent libGL.so.1 missing GUI dependency on Linux..."
pip uninstall -y opencv-python || true
pip install --no-cache-dir --force-reinstall --no-deps opencv-python-headless

echo "3. Verifying headless OpenCV and ONNX runtime..."
python -c "import cv2; print('OpenCV successfully imported:', cv2.__version__)"
python -c "from rapidocr_onnxruntime import RapidOCR; r = RapidOCR(); print('RapidOCR initialized successfully!')"

echo "=== Build Complete ==="
