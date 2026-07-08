@echo off
cd /d "%~dp0"
set HF_HUB_OFFLINE=1
set TRANSFORMERS_OFFLINE=1
title Handbuch-Assistent (SHK-Demo)
echo ============================================
echo   Handbuch-Assistent - SHK-Demo
echo ============================================
echo.
if not exist "index\embeddings.npy" (
  echo Erster Start: Index ueber die Handbuecher wird gebaut...
  python rag.py --build --corpus shk-corpus
  echo.
)
echo Demo startet - der Browser oeffnet gleich.
echo (Dieses Fenster schliessen, um die Demo zu stoppen.)
echo.
python -m streamlit run app_shk.py
pause
