# AI Detector

Real-time person detection and hand gesture recognition that runs entirely in the browser — no server, no backend, just open and it works.

## Background

I built the first version of this during **AI for India 2.0** by GUVI. That version used COCO-SSD to detect people from a webcam feed — pretty basic, but it got me into how TensorFlow.js actually works in the browser.

After the course I kept working on it. Added MediaPipe Hands for gesture recognition, rewrote the UI, and figured out a bunch of weird canvas + video mirroring bugs along the way. The current version runs both models simultaneously at around 20–30 FPS depending on your machine.

## What it does

- Detects people in the webcam feed using COCO-SSD and draws a bounding box with confidence score
- Tracks hand keypoints using MediaPipe (21 points per hand) and connects them to show the hand skeleton
- Classifies 8 gestures — Thumbs Up, Fist, Peace, Pointing, Call Me, Rock On, Open Hand, All Five
- Shows FPS live so you can see actual performance
- Dark and light mode toggle

## Tech used

- TensorFlow.js — runs the ML models in browser
- COCO-SSD — pre-trained object detection model, used for person detection
- MediaPipe Hands — hand landmark detection, 21 keypoints per hand
- Vanilla JS, HTML, CSS — no frameworks, kept it simple

Everything loads from CDN. No npm, no build step.

## How to run

Just open `index.html` in a browser. Allow camera access when it asks.

If you want to run it locally with live reload, VS Code Live Server works fine.

## Files

```
├── index.html          # markup
├── style.css           # styling, dark/light theme
├── app.js              # all the detection logic
├── model.json          # custom model from GUVI project (original version)
├── model.weights.bin   # weights for the above
└── metadata.json       # model metadata
```

The `model.json` and weights are from the original GUVI version which used a Teachable Machine model. The current version uses COCO-SSD and MediaPipe instead, but I kept the files in the repo.

## Gesture list

| Gesture | Detected as |
|---|---|
| 👍 | Thumbs Up |
| ✊ | Fist |
| ✌️ | Peace |
| ☝️ | Pointing |
| 🤙 | Call Me |
| 🤘 | Rock On |
| 🖐️ | Open Hand |
| 🙌 | All Five |

## Known limitations

- Gesture detection works best when the hand is facing the camera directly. Tilted or sideways hands sometimes misclassify.
- COCO-SSD occasionally picks up phones or other rectangular objects as people, especially at low confidence. I set a 45% threshold to reduce this but it still happens sometimes.
- FPS drops on lower-end machines since both models run every frame.

## Live demo

[priyansh0506.github.io/AI-Detector](https://priyansh0506.github.io/AI-Detector)
