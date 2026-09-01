# SoulCast IV (soulcast-iv)

## 📌 Visão Geral
Aplicação local com interface web para conversão de vídeos/GIFs em frames binarizados (1-bit / monocromáticos) otimizados para microcontroladores e pequenos displays OLED/LCD (SSD1306, SH1106, U8g2, etc.).

## 🎯 Objetivos & Funcionalidades Principais
1. **Execução Local Descomplicada:**
   - Script de inicialização único (`run.sh` / `run.bat` ou ambiente virtual Python) para abrir a interface web local.
2. **Pipeline de Upload & Configuração:**
   - Upload de vídeo (`.mp4`, `.mkv`, `.webm`, `.gif`).
   - Seletor de resolução alvo (Presets: 128x64, 128x32, 64x48, ou Custom).
   - Controle de FPS de saída (ex: 5 a 30 FPS).
   - Modo de redimensionamento (Fit/Letterbox vs Crop).
3. **Processamento de Imagem & Binarização:**
   - Sliders em tempo real: Brilho, Contraste, Gamma e Inversão de Cores.
   - Algoritmos de Binarização/Dithering:
     - Threshold Simples / Otsu
     - Floyd-Steinberg Dithering
     - Atkinson Dithering
     - Bayer Matrix (Ordered Dithering)
4. **Live Preview Instantâneo:**
   - O usuário escolhe um frame de amostra do vídeo e visualiza o resultado simulado em 1-bit antes de rodar o lote completo.
5. **Exportação:**
   - `.zip` contendo os frames enumerados (`frame_0001.bmp`/`.png` 1-bit).
   - Opcional: Arquivo `.h` C/C++ contendo matriz de bytes em `PROGMEM` ou `.bin` raw.

## 🛠️ Stack Técnica Sugerida
- **Backend:** Python (FastAPI ou Flask) + OpenCV / Pillow / FFmpeg.
- **Frontend:** Interface web leve, responsiva e com preview via HTML5 Canvas.