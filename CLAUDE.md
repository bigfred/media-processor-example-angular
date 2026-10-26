# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Angular 18 (standalone components, zone.js) example app for `@pexip/media-processor`. It shows the webcam feed in a `<video>` and applies a selectable effect: `none`, `blur`, or `overlay` (background replacement).

## Commands

- `npm start` — dev server at http://localhost:4200
- `npm run build` — production build to `dist/media-processor-example`
- `npm test` — Karma + Jasmine in Chrome
- Single spec file: `npx ng test --include src/app/app.component.spec.ts` (or use `fit`/`fdescribe`)
- Type-check only: `npx tsc -p tsconfig.app.json --noEmit`

There is no linter configured. The README mentions `npm run update-selfie-segmenter`, but that script does not exist in `package.json`. The default spec's "should render title" test expects an `<h1>` that the template doesn't have.

## Architecture

- `src/app/video-processor.ts` — `getVideoProcessor(effect)` builds and `open()`s a `VideoProcessor` and returns `{ processor, transformer }`: a MediaPipe segmenter (`createSegmenter`) → `createCanvasTransform` (the effect) → a track processor (`MediaStreamTrackProcessor` if available, else the fallback). Delegate is GPU on Chromium, CPU otherwise.
- `src/app/app.component.ts` — all UI logic. Gets the camera via `getUserMedia`, creates a single processor for the component's lifetime, and binds `processor.process(localStream)` output to the video's `[srcObject]`. Effect changes just set `transformer.effects` (applies on the next frame) — no teardown. `closeAll()` tears everything down on destroy / `beforeunload` / non-persisted `pagehide`.

### Runtime assets (served from `public/` at the site root)

The library loads these by absolute URL, so paths in `video-processor.ts` must match `public/`:
- `/wasm/` — MediaPipe tasks-vision WASM (passed to `FilesetResolver.forVisionTasks()`)
- `/models/selfie_segmenter.tflite` — segmentation model
- `/workers/mediaWorker.js` — worker the segmenter runs in
- `/backgrounds/background.png` — image for the `overlay` effect

### `VideoProcessor` lifecycle (from the library source in `node_modules/@pexip/media-processor/dist/main/video/`)

- `close()` stops the output stream's tracks and closes the transformers, but the segmenter's `close()` only posts a message — it does **not** terminate its `Worker`. Reopening a closed processor makes the segmenter's `open()` spawn a *new* `Worker`, leaking the old one. So don't close-and-reuse processors.
- `destroy()` calls `close()`, then destroys the segmenter (`worker.terminate()`) — a destroyed processor cannot be reused. The app only calls it from `closeAll()`.
- `process()` throws if called while already processing; close first.
