# SoulCast IV

A lightweight, stateless 1-bit video and GIF conversion engine optimized for microcontrollers and monochrome OLED/LCD displays (SSD1306, SH1106, ST7920, SSD1309).

---

## 1. Overview

SoulCast IV extracts frames from video sources (MP4, MKV, AVI, WebM, MOV) and animated GIFs, applies configurable spatial dithering algorithms (Floyd-Steinberg, Bayer Ordered Dithering, or Direct Thresholding), and packs the resulting 1-bit monochrome data into memory-efficient C/C++ arrays (`PROGMEM`) and ZIP archives.

---

## 2. Binary Format Specification

### Pixel Encoding
- **Color Depth:** 1-bit monochrome (0 = Black / Pixel Off, 1 = White / Pixel On).
- **Bit Order:** Most Significant Bit (MSB) first.
  - Bit 7 represents the leftmost pixel of an 8-pixel group.
  - Bit 0 represents the rightmost pixel of an 8-pixel group.
- **Byte Organization:** Row-major (horizontal scanline packing).

### Memory Footprint Formula
$$\text{Bytes per Frame} = \left\lceil \frac{\text{Width}}{8} \right\rceil \times \text{Height}$$

For standard resolutions:
- **128 x 64:** 16 bytes/row $\times$ 64 rows = **1,024 bytes / frame**
- **128 x 32:** 16 bytes/row $\times$ 32 rows = **512 bytes / frame**
- **96 x 16:** 12 bytes/row $\times$ 16 rows = **192 bytes / frame**

---

## 3. Generated Header Structure

The generated C/C++ header (`soulcast_<name>.h`) contains metadata constants and a 2D array stored in flash memory:

```c
#ifndef SOULCAST_ANIMATION_H
#define SOULCAST_ANIMATION_H

#include <stdint.h>
#ifdef __AVR__
  #include <avr/pgmspace.h>
#elif defined(ESP8266) || defined(ESP32)
  #include <pgmspace.h>
#else
  #define PROGMEM
#endif

#define ANIMATION_FRAME_WIDTH   128
#define ANIMATION_FRAME_HEIGHT  64
#define ANIMATION_FRAME_COUNT   595
#define ANIMATION_FPS           10
#define ANIMATION_FRAME_SIZE    1024

const uint8_t PROGMEM animation_frames[ANIMATION_FRAME_COUNT][ANIMATION_FRAME_SIZE] = {
  // --- Frame 0 ---
  {
    0x00, 0x00, 0xAA, 0x55, ...
  },
  // --- Frame 1 ---
  {
    0x00, 0x00, 0x55, 0xAA, ...
  }
};

#endif // SOULCAST_ANIMATION_H
```

---

## 4. Hardware Implementation Examples

### 4.1. STM32 (C / STM32 HAL)

Using a standard SSD1306 OLED driver over I2C or SPI:

```c
#include "main.h"
#include "ssd1306.h"
#include "soulcast_animation.h"

void Play_Animation(void) {
    uint32_t frame_delay_ms = 1000 / ANIMATION_FPS;
    
    for (uint16_t i = 0; i < ANIMATION_FRAME_COUNT; i++) {
        uint32_t start_time = HAL_GetTick();
        
        // Draw monochrome bitmap to display buffer
        // Signature: ssd1306_DrawBitmap(x, y, data, width, height, color)
        ssd1306_DrawBitmap(0, 0, animation_frames[i], ANIMATION_FRAME_WIDTH, ANIMATION_FRAME_HEIGHT, White);
        ssd1306_UpdateScreen();
        
        // Maintain fixed framerate
        while ((HAL_GetTick() - start_time) < frame_delay_ms) {
            // Non-blocking wait or low-power yield
        }
    }
}
```

If using `u8g2` on STM32:

```c
#include "u8g2.h"
#include "soulcast_animation.h"

extern u8g2_t u8g2;

void Render_Frame(uint16_t frame_idx) {
    u8g2_ClearBuffer(&u8g2);
    u8g2_DrawXBM(&u8g2, 0, 0, ANIMATION_FRAME_WIDTH, ANIMATION_FRAME_HEIGHT, animation_frames[frame_idx]);
    u8g2_SendBuffer(&u8g2);
}
```

---

### 4.2. ESP32 (Arduino / ESP-IDF)

Using `Adafruit_SSD1306` over I2C:

```cpp
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "soulcast_animation.h"

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
    Wire.begin(21, 22); // SDA, SCL for ESP32
    display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS);
    display.clearDisplay();
}

void loop() {
    const unsigned long frame_period = 1000 / ANIMATION_FPS;
    
    for (int i = 0; i < ANIMATION_FRAME_COUNT; i++) {
        unsigned long t0 = millis();
        
        display.clearDisplay();
        // Adafruit_GFX drawBitmap accepts horizontal MSB packed byte arrays in PROGMEM
        display.drawBitmap(0, 0, animation_frames[i], ANIMATION_FRAME_WIDTH, ANIMATION_FRAME_HEIGHT, SSD1306_WHITE);
        display.display();
        
        unsigned long elapsed = millis() - t0;
        if (elapsed < frame_period) {
            delay(frame_period - elapsed);
        }
    }
}
```

---

### 4.3. Arduino AVR (Uno, Nano, Mega)

For AVR microcontrollers with limited RAM, arrays stored in flash require reading through `pgm_read_byte`:

```cpp
#include <avr/pgmspace.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "soulcast_animation.h"

// For large animations exceeding AVR flash limits (e.g., >30KB on Uno),
// consider trimming frame count or lowering framerate.

void draw_frame_avr(Adafruit_SSD1306 &disp, uint16_t frame_index) {
    disp.clearDisplay();
    disp.drawBitmap(0, 0, animation_frames[frame_index], ANIMATION_FRAME_WIDTH, ANIMATION_FRAME_HEIGHT, WHITE);
    disp.display();
}
```

---

## 5. Dithering Algorithms

| Algorithm | Best Used For | Visual Characteristic |
| :--- | :--- | :--- |
| **Floyd-Steinberg** | Photographic content, realistic shading | Error diffusion, organic continuous gradients |
| **Bayer (Ordered)** | High-contrast animations, retro/pixel art | Regular 4x4 matrix grid pattern, stable between frames |
| **Direct Threshold** | Text, line art, vector shapes | Pure black/white cut at 50% luminance, zero noise |

---

## 6. Running the SoulCast IV Web Tool Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- FFmpeg installed and accessible in system `PATH`

### Backend Setup (Virtual Environment)
```bash
cd backend

# 1. Create and activate virtual environment
# On Linux/macOS:
python3 -m venv venv
source venv/bin/activate

# On Windows (PowerShell / Command Prompt):
python -m venv venv
.\venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start development server
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```