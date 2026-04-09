import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useProjectContext } from "@/context/ProjectContext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const FRAME_W = SCREEN_W * 0.85;
const FRAME_H = FRAME_W * 1.35;
const FRAME_X = (SCREEN_W - FRAME_W) / 2;
const FRAME_Y = (SCREEN_H - FRAME_H) / 2 - 40;
const CORNER = 28;
const BORDER = 3;

const HANDLE_SIZE = 32;

interface Point {
  x: number;
  y: number;
}

interface PhotoState {
  uri: string;
  width: number;
  height: number;
}

function calcDisplayRect(photoW: number, photoH: number) {
  const scaleX = SCREEN_W / photoW;
  const scaleY = SCREEN_H / photoH;
  const scale = Math.min(scaleX, scaleY);
  const dispW = photoW * scale;
  const dispH = photoH * scale;
  const offsetX = (SCREEN_W - dispW) / 2;
  const offsetY = (SCREEN_H - dispH) / 2;
  return { dispW, dispH, offsetX, offsetY, scale };
}

function DocumentFrame() {
  return (
    <View
      style={[
        styles.frame,
        { left: FRAME_X, top: FRAME_Y, width: FRAME_W, height: FRAME_H },
      ]}
    >
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
    </View>
  );
}

function CornerHandle({
  pos,
  panResponder,
}: {
  pos: Point;
  panResponder: ReturnType<typeof PanResponder.create>;
}) {
  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.handle,
        {
          left: pos.x - HANDLE_SIZE / 2,
          top: pos.y - HANDLE_SIZE / 2,
        },
      ]}
    />
  );
}

export default function CameraScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { addPage } = useProjectContext();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [uploading, setUploading] = useState(false);

  // Perspective selection state (screen pixel coordinates)
  const [corners, setCorners] = useState({
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    bl: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
  });

  const displayRect = photo
    ? calcDisplayRect(photo.width, photo.height)
    : null;

  const cornersRef = useRef(corners);
  cornersRef.current = corners;

  const startRef = useRef({
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    bl: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
  });

  function makePR(key: "tl" | "tr" | "bl" | "br") {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current[key] = { ...cornersRef.current[key] };
      },
      onPanResponderMove: (_, gs) => {
        if (!displayRect) return;
        const sx = startRef.current[key].x + gs.dx;
        const sy = startRef.current[key].y + gs.dy;
        const clampedX = Math.max(
          displayRect.offsetX,
          Math.min(displayRect.offsetX + displayRect.dispW, sx),
        );
        const clampedY = Math.max(
          displayRect.offsetY,
          Math.min(displayRect.offsetY + displayRect.dispH, sy),
        );
        setCorners((prev) => ({
          ...prev,
          [key]: { x: clampedX, y: clampedY },
        }));
      },
    });
  }

  const panResponders = useRef({
    tl: makePR("tl"),
    tr: makePR("tr"),
    bl: makePR("bl"),
    br: makePR("br"),
  }).current;

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: "#111" }]}>
        <Feather name="camera-off" size={60} color="#999" />
        <Text style={styles.permTitle}>Acceso a cámara necesario</Text>
        <Text style={styles.permText}>
          Esta app necesita la cámara para fotografiar documentos.
        </Text>
        <TouchableOpacity
          style={styles.permBtn}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permBtnText}>Conceder acceso</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permCancel} onPress={() => router.back()}>
          <Text style={styles.permCancelText}>Cancelar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        exif: false,
      });
      if (!result) return;
      const { uri, width, height } = result;
      const rect = calcDisplayRect(width, height);
      const margin = 0.06;
      setPhoto({ uri, width, height });
      setCorners({
        tl: { x: rect.offsetX + rect.dispW * margin, y: rect.offsetY + rect.dispH * margin },
        tr: { x: rect.offsetX + rect.dispW * (1 - margin), y: rect.offsetY + rect.dispH * margin },
        bl: { x: rect.offsetX + rect.dispW * margin, y: rect.offsetY + rect.dispH * (1 - margin) },
        br: { x: rect.offsetX + rect.dispW * (1 - margin), y: rect.offsetY + rect.dispH * (1 - margin) },
      });
    } catch {
      Alert.alert("Error", "No se pudo tomar la foto");
    }
  };

  const handleConfirm = async () => {
    if (!photo || !projectId || !displayRect) return;
    setUploading(true);
    try {
      const { offsetX, offsetY, scale } = displayRect;

      // Convert screen corner positions to image pixel coordinates
      function toImg(pt: Point): Point {
        return {
          x: (pt.x - offsetX) / scale,
          y: (pt.y - offsetY) / scale,
        };
      }

      const imgTL = toImg(corners.tl);
      const imgTR = toImg(corners.tr);
      const imgBL = toImg(corners.bl);
      const imgBR = toImg(corners.br);

      // Calculate average tilt angle from top + bottom edges for perspective correction
      const topAngle = Math.atan2(imgTR.y - imgTL.y, imgTR.x - imgTL.x);
      const bottomAngle = Math.atan2(imgBR.y - imgBL.y, imgBR.x - imgBL.x);
      const tiltDeg = -((topAngle + bottomAngle) / 2) * (180 / Math.PI);

      // After rotation, recalculate corner positions in the new image space
      const rad = (tiltDeg * Math.PI) / 180;
      const cosR = Math.abs(Math.cos(rad));
      const sinR = Math.abs(Math.sin(rad));
      const newW = photo.width * cosR + photo.height * sinR;
      const newH = photo.width * sinR + photo.height * cosR;
      const ox = (newW - photo.width) / 2;
      const oy = (newH - photo.height) / 2;
      const cx = photo.width / 2;
      const cy = photo.height / 2;

      function rotPt(p: Point): Point {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return {
          x: dx * Math.cos(rad) - dy * Math.sin(rad) + cx + ox,
          y: dx * Math.sin(rad) + dy * Math.cos(rad) + cy + oy,
        };
      }

      const pts = [imgTL, imgTR, imgBL, imgBR].map(rotPt);
      const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))));
      const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))));
      const maxX = Math.min(newW, Math.ceil(Math.max(...pts.map((p) => p.x))));
      const maxY = Math.min(newH, Math.ceil(Math.max(...pts.map((p) => p.y))));
      const cropW = Math.max(1, maxX - minX);
      const cropH = Math.max(1, maxY - minY);

      const actions: Parameters<typeof manipulateAsync>[1] = [];
      if (Math.abs(tiltDeg) > 0.5) {
        actions.push({ rotate: tiltDeg });
      }
      actions.push({
        crop: { originX: minX, originY: minY, width: cropW, height: cropH },
      });
      actions.push({ resize: { width: 1200 } });

      const result = await manipulateAsync(photo.uri, actions, {
        compress: 0.82,
        format: SaveFormat.JPEG,
        base64: true,
      });

      const base64 = result.base64;
      if (!base64) throw new Error("No se pudo comprimir la imagen");

      await addPage(projectId, base64);
      router.back();
    } catch (err) {
      setUploading(false);
      Alert.alert(
        "Error",
        (err as Error).message || "No se pudo procesar la página",
      );
    }
  };

  const handleRetake = () => setPhoto(null);

  if (photo && displayRect) {
    return (
      <View style={styles.preview}>
        <Image
          source={{ uri: photo.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />

        {/* Perspective selection overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Dimmed overlay outside selection */}
          <View
            style={[
              styles.selectionOverlay,
              {
                left: corners.tl.x,
                top: corners.tl.y,
                right: SCREEN_W - corners.br.x,
                bottom: SCREEN_H - corners.br.y,
              },
            ]}
            pointerEvents="none"
          />

          {(["tl", "tr", "bl", "br"] as const).map((key) => (
            <CornerHandle
              key={key}
              pos={corners[key]}
              panResponder={panResponders[key]}
            />
          ))}
        </View>

        <SafeAreaView style={styles.previewOverlay} edges={["top", "bottom"]}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Ajusta el documento</Text>
            <Text style={styles.previewHint}>
              Arrastra las esquinas azules para alinear el documento
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {uploading ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="large" color={Colors.primaryForeground} />
              <Text style={styles.uploadingText}>Subiendo y procesando...</Text>
            </View>
          ) : (
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={handleRetake}
                activeOpacity={0.8}
              >
                <Feather name="rotate-ccw" size={20} color="#FFFFFF" />
                <Text style={styles.retakeBtnText}>Repetir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Feather name="check" size={22} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.camera}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <View style={styles.overlay}>
        <View style={[styles.darkArea, { height: FRAME_Y }]} />
        <View style={{ flexDirection: "row", height: FRAME_H }}>
          <View style={[styles.darkArea, { width: FRAME_X }]} />
          <View style={{ width: FRAME_W, height: FRAME_H }} />
          <View style={[styles.darkArea, { width: FRAME_X }]} />
        </View>
        <View style={[styles.darkArea, { flex: 1 }]} />
      </View>
      <DocumentFrame />
      <SafeAreaView style={styles.cameraUI} edges={["top", "bottom"]}>
        <View style={styles.cameraHeader}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.cameraHint}>Centra el documento</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.captureRow}>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={handleCapture}
            activeOpacity={0.8}
          >
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  permTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  permText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#999",
    textAlign: "center",
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  permCancel: { marginTop: 4 },
  permCancelText: {
    color: "#666",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  camera: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  darkArea: { backgroundColor: "rgba(0,0,0,0.6)" },
  frame: { position: "absolute" },
  corner: { position: "absolute", width: CORNER, height: CORNER },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: BORDER,
    borderLeftWidth: BORDER,
    borderColor: "#FFFFFF",
    borderTopLeftRadius: 4,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: BORDER,
    borderRightWidth: BORDER,
    borderColor: "#FFFFFF",
    borderTopRightRadius: 4,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: BORDER,
    borderLeftWidth: BORDER,
    borderColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: BORDER,
    borderRightWidth: BORDER,
    borderColor: "#FFFFFF",
    borderBottomRightRadius: 4,
  },
  cameraUI: { ...StyleSheet.absoluteFillObject },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraHint: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captureRow: { alignItems: "center", paddingBottom: 30 },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
  preview: { flex: 1, backgroundColor: "#000" },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    pointerEvents: "box-none",
  },
  previewHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    gap: 4,
  },
  previewTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  previewHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  selectionOverlay: {
    position: "absolute",
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: "transparent",
  },
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  uploadingBox: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    marginHorizontal: 40,
    borderRadius: 16,
    padding: 24,
    gap: 14,
    marginBottom: 40,
  },
  uploadingText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
    textAlign: "center",
  },
  previewActions: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingBottom: 30,
    gap: 14,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  retakeBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  confirmBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
