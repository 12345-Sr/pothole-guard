# Machine Learning Model Integration Guide — PotholeGuard

This document details the production computer vision pipeline for replacing the `MockDetectionEngine` with a custom-trained edge neural network (YOLOv8-Nano / MobileNet-SSD) quantized for low-latency mobile inference on Android and iOS.

---

## 1. Dataset Preparation & Negative Hard Mining

An effective pothole detection model requires distinguishing authentic asphalt voids from everyday road artifacts (shadows, tar patches, manhole covers, speed bumps, and oil slicks).

### Class Taxonomy
1. `pothole` (Primary detection target: asphalt cavity with visible rim and crater depression)
2. `crack` (Auxiliary hazard: spiderweb / longitudinal road distress)
3. `manhole` (Negative hard example: circular/rectangular cast iron fixtures)
4. `speed_bump` (Negative hard example: raised asphalt or rumble strips)

### Recommended Datasets
- **CRACK500 / RDD2022 (Road Damage Dataset)**: >40,000 multi-national road damage images.
- **Roboflow Pothole Universe**: Annotated road cavities under diverse weather (rain, dawn, dusk).
- **Synthetic Negative Pool**: Overcast road shadows from trees, high-speed asphalt tire marks.

---

## 2. Annotation Format

Use the standard YOLO normalized bounding box format (`class_id center_x center_y width height` in $[0, 1]$):

```
# Sample annotation: 00412.txt
0 0.482012 0.710452 0.245102 0.142081
```

---

## 3. Training with Ultralytics YOLOv8-Nano

YOLOv8n is selected for its optimal balance of mAP@50 (0.79+) and sub-35ms CPU latency on mid-tier mobile hardware.

```bash
# Python training script (backend/.venv)
pip install ultralytics onnx

yolo detect train \
  data=pothole_dataset.yaml \
  model=yolov8n.pt \
  epochs=100 \
  imgsz=640 \
  batch=32 \
  device=0 \
  name=pothole_yolov8n
```

---

## 4. Quantization & Conversion to Mobile Formats

Float32 models require too much memory and power for sustained mobile driving sessions. Convert to **FP16** or **INT8** TensorFlow Lite:

```python
from ultralytics import YOLO

model = YOLO("runs/detect/pothole_yolov8n/weights/best.pt")

# Export to TFLite INT8 quantized format
model.export(
    format="tflite",
    imgsz=[360, 640],
    int8=True,
    nms=True
)
```

The resulting `best_saved_model/best_int8.tflite` is placed in:
`assets/models/pothole_yolov8n.tflite`

---

## 5. React Native Native Bridge Integration

In React Native, integrate the model using either `react-native-fast-tflite` or `react-native-executorch`:

```typescript
// Example using VisionCamera + fast-tflite FrameProcessor
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameProcessor } from 'react-native-vision-camera';

export function usePotholeDetector() {
  const model = useTensorflowModel(require('../assets/models/pothole_yolov8n.tflite'));

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (model.state !== 'loaded') return;
    const outputs = model.model.runSync([frame]);
    // Outputs decoded into { detected, confidence, boundingBox }
  }, [model]);

  return { frameProcessor };
}
```

---

## 6. Depth Estimation Engineering Note

> [!NOTE]
> Single monocular RGB cameras cannot reliably measure true millimeter pothole depth due to perspective projection ambiguity. 
> To estimate depth in future iterations:
> - **Stereo Camera**: Disparity map triangulating depression depth.
> - **LiDAR / Time-of-Flight (ToF)**: Available on iPad Pro / iPhone Pro devices for direct 3D point cloud measurements.
> - **Monocular Depth Neural Networks**: Models such as MiDaS or Depth-Anything-V2 run at 3–5 FPS on device to estimate relative crater topography.
