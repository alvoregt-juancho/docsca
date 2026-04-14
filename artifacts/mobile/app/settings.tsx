import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { API } from "@/services/api";

export default function SettingsScreen() {
  const router = useRouter();
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const checkServer = async () => {
    setLoading(true);
    try {
      const ok = await API.checkHealth();
      setServerOk(ok);
    } catch {
      setServerOk(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkServer();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={24} color={Colors.primaryForeground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del servidor</Text>
          <View style={styles.card}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.loadingText}>Verificando conexión...</Text>
              </View>
            ) : (
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    serverOk ? styles.dotSuccess : styles.dotError,
                  ]}
                />
                <View style={styles.statusInfo}>
                  <Text
                    style={[
                      styles.statusTitle,
                      { color: serverOk ? Colors.success : Colors.error },
                    ]}
                  >
                    {serverOk ? "Servidor conectado" : "Sin conexión al servidor"}
                  </Text>
                  <Text style={styles.statusNote}>
                    {serverOk
                      ? "OCR con Gemini AI activo. Las fotos se analizan con inteligencia artificial."
                      : "Asegúrate de que el workspace de Replit esté abierto."}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={checkServer}
              disabled={loading}
            >
              <Feather
                name="refresh-cw"
                size={14}
                color={Colors.primary}
                style={loading ? { opacity: 0.4 } : undefined}
              />
              <Text style={[styles.refreshText, loading && { opacity: 0.4 }]}>
                Verificar conexión
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cómo funciona</Text>
          <View style={styles.card}>
            <View style={styles.tipBox}>
              <Feather name="camera" size={14} color={Colors.primary} />
              <Text style={styles.tipText}>
                Toma fotos de las páginas del libro. La app recorta automáticamente al
                marco blanco.
              </Text>
            </View>
            <View style={styles.tipBox}>
              <Feather name="cpu" size={14} color={Colors.primary} />
              <Text style={styles.tipText}>
                Gemini AI lee el texto real de cada foto y detecta el número de página.
              </Text>
            </View>
            <View style={styles.tipBox}>
              <Feather name="file-text" size={14} color={Colors.primary} />
              <Text style={styles.tipText}>
                Exporta a Word, PDF con texto, o PDF con imágenes escaneadas.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Feather name="book" size={20} color={Colors.primary} />
              <View style={styles.aboutInfo}>
                <Text style={styles.aboutName}>DocScan</Text>
                <Text style={styles.aboutVersion}>Versión 1.1.0</Text>
              </View>
            </View>
            <Text style={styles.aboutDesc}>
              Escáner de documentos con OCR inteligente para fotografiar libros y
              exportar a Word y PDF. Captura rápida en lote con procesamiento en
              segundo plano.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.primaryForeground,
  },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  statusRow: { flexDirection: "row", gap: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
  dotSuccess: { backgroundColor: Colors.success },
  dotError: { backgroundColor: Colors.error },
  statusInfo: { flex: 1, gap: 4 },
  statusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusNote: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 18 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  refreshText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },
  tipBox: { flexDirection: "row", backgroundColor: Colors.secondary, borderRadius: 10, padding: 12, gap: 8 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.secondaryForeground, lineHeight: 18 },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  aboutInfo: { gap: 2 },
  aboutName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  aboutVersion: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  aboutDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 19 },
});
