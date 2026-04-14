import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

interface QueuedPhoto {
  id: string;
  base64: string;
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

export default function CameraScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { addPage } = useProjectContext();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const processingRef = useRef(false);
  const queueRef = useRef<QueuedPhoto[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || !projectId) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      if (!item) break;

      try {
        await addPage(projectId, item.base64);
      } catch {}

      setQueue((prev) => prev.filter((p) => p.id !== item.id));
      setUploadedCount((c) => c + 1);
    }

    processingRef.current = false;
  }, [projectId, addPage]);

  useEffect(() => {
    if (queue.length > 0 && !processingRef.current) {
      processQueue();
    }
  }, [queue.length, processQueue]);

  const cropToFrame = async (uri: string, photoW: number, photoH: number): Promise<string> => {
    const scaleToFill = Math.max(SCREEN_W / photoW, SCREEN_H / photoH);

    const visibleW = SCREEN_W / scaleToFill;
    const visibleH = SCREEN_H / scaleToFill;
    const cropOffsetX = (photoW - visibleW) / 2;
    const cropOffsetY = (photoH - visibleH) / 2;

    const framePhotoX = Math.max(0, Math.round(cropOffsetX + FRAME_X / scaleToFill));
    const framePhotoY = Math.max(0, Math.round(cropOffsetY + FRAME_Y / scaleToFill));
    const framePhotoW = Math.min(Math.round(FRAME_W / scaleToFill), photoW - framePhotoX);
    const framePhotoH = Math.min(Math.round(FRAME_H / scaleToFill), photoH - framePhotoY);

    const result = await manipulateAsync(
      uri,
      [
        {
          crop: {
            originX: framePhotoX,
            originY: framePhotoY,
            width: framePhotoW,
            height: framePhotoH,
          },
        },
        { resize: { width: 1800 } },
      ],
      { compress: 0.92, format: SaveFormat.JPEG, base64: true },
    );

    if (!result.base64) throw new Error("No se pudo recortar la imagen");
    return result.base64;
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      if (!result) {
        setCapturing(false);
        return;
      }

      const base64 = await cropToFrame(result.uri, result.width, result.height);

      const id = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setQueue((prev) => [...prev, { id, base64 }]);
    } catch {
      Alert.alert("Error", "No se pudo tomar la foto. Intenta de nuevo.");
    }
    setCapturing(false);
  };

  const handleDone = () => {
    if (queue.length > 0 && processingRef.current) {
      setUploading(true);
      const interval = setInterval(() => {
        if (queueRef.current.length === 0) {
          clearInterval(interval);
          setUploading(false);
          router.back();
        }
      }, 500);
    } else {
      router.back();
    }
  };

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

  if (uploading) {
    return (
      <View style={[styles.centered, { backgroundColor: "#111" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.uploadingText}>
          Subiendo {queue.length} foto{queue.length !== 1 ? "s" : ""} restante{queue.length !== 1 ? "s" : ""}...
        </Text>
        <Text style={styles.uploadingSubtext}>
          {uploadedCount} procesada{uploadedCount !== 1 ? "s" : ""}
        </Text>
      </View>
    );
  }

  const totalCaptured = queue.length + uploadedCount;

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
            onPress={handleDone}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.cameraHint}>Centra la página en el marco</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1 }} />

        {totalCaptured > 0 && (
          <View style={styles.counterRow}>
            <View style={styles.counterBadge}>
              <Feather name="check-circle" size={16} color="#22C55E" />
              <Text style={styles.counterText}>
                {totalCaptured} foto{totalCaptured !== 1 ? "s" : ""} capturada{totalCaptured !== 1 ? "s" : ""}
              </Text>
            </View>
            {queue.length > 0 && (
              <View style={styles.processingBadge}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.processingText}>
                  Procesando... ({uploadedCount}/{totalCaptured})
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.captureRow}>
          {totalCaptured > 0 && (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={handleDone}
              activeOpacity={0.8}
            >
              <Feather name="check" size={20} color="#FFFFFF" />
              <Text style={styles.doneBtnText}>Listo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
            onPress={handleCapture}
            activeOpacity={0.8}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.captureBtnInner} />
            )}
          </TouchableOpacity>
          <View style={{ width: totalCaptured > 0 ? 80 : 0 }} />
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
  counterRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
    flexWrap: "wrap",
  },
  counterBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  counterText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  processingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37,99,235,0.8)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  processingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 30,
    gap: 20,
  },
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
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22C55E",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 6,
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  uploadingText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  uploadingSubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#999",
    textAlign: "center",
  },
});
