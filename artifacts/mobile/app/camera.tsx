import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
          Esta app necesita acceso a la cámara para fotografiar documentos.
        </Text>
        <TouchableOpacity
          style={styles.permBtn}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permBtnText}>Conceder acceso</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permCancel}
          onPress={() => router.back()}
        >
          <Text style={styles.permCancelText}>Cancelar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        exif: false,
      });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch (err) {
      Alert.alert("Error", "No se pudo tomar la foto");
    }
  };

  const handleConfirm = async () => {
    if (!photoUri || !projectId) return;
    setUploading(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.82,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      const base64 = compressed.base64;
      if (!base64) throw new Error("No se pudo comprimir la imagen");

      await addPage(projectId, base64);
      router.back();
    } catch (err) {
      setUploading(false);
      Alert.alert("Error", (err as Error).message || "No se pudo subir la página");
    }
  };

  const handleRetake = () => setPhotoUri(null);

  if (photoUri) {
    return (
      <View style={styles.preview}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        <SafeAreaView style={styles.previewOverlay} edges={["top", "bottom"]}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Vista previa</Text>
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
        <View
          style={[styles.darkArea, { height: FRAME_Y }]}
        />
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
  frame: {
    position: "absolute",
    borderWidth: 0,
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
  },
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
  cameraUI: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "column",
  },
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
  captureRow: {
    alignItems: "center",
    paddingBottom: 30,
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
  },
  previewHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
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
