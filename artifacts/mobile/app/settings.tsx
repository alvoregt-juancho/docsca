import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { API } from "@/services/api";

interface ConfigStatus {
  configured: boolean;
  projectId: string | null;
  processorId: string | null;
  location: string;
  note: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await API.checkConfig();
      setConfig(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConfig();
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de OCR</Text>
          <View style={styles.card}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.loadingText}>Verificando conexión...</Text>
              </View>
            ) : error ? (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, styles.dotError]} />
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusTitle, { color: Colors.error }]}>
                    Sin conexión al servidor
                  </Text>
                  <Text style={styles.statusNote}>{error}</Text>
                </View>
              </View>
            ) : config ? (
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    config.configured ? styles.dotSuccess : styles.dotWarning,
                  ]}
                />
                <View style={styles.statusInfo}>
                  <Text
                    style={[
                      styles.statusTitle,
                      {
                        color: config.configured
                          ? Colors.success
                          : Colors.warning,
                      },
                    ]}
                  >
                    {config.configured
                      ? "Google Document AI configurado"
                      : "Usando OCR de demostración"}
                  </Text>
                  <Text style={styles.statusNote}>{config.note}</Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={checkConfig}
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

        {config && !config.configured && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cómo activar el OCR real</Text>
            <View style={styles.card}>
              <Text style={styles.setupIntro}>
                Para usar Google Document AI (OCR de producción), necesitas
                configurar tres variables de entorno en el servidor:
              </Text>

              {[
                {
                  name: "GOOGLE_CLOUD_PROJECT_ID",
                  desc: "ID de tu proyecto en Google Cloud",
                },
                {
                  name: "GOOGLE_DOCUMENT_AI_PROCESSOR_ID",
                  desc: "ID del procesador Document AI (tipo: Document OCR)",
                },
                {
                  name: "GOOGLE_APPLICATION_CREDENTIALS_JSON",
                  desc: "Contenido JSON de la clave de cuenta de servicio",
                },
                {
                  name: "GOOGLE_CLOUD_LOCATION",
                  desc: 'Región del procesador (ej. "us" o "eu"), predeterminado: us',
                },
              ].map((item, i) => (
                <View
                  key={item.name}
                  style={[styles.envItem, i > 0 && styles.envItemBorder]}
                >
                  <Text style={styles.envName}>{item.name}</Text>
                  <Text style={styles.envDesc}>{item.desc}</Text>
                </View>
              ))}

              <View style={styles.tipBox}>
                <Feather name="info" size={14} color={Colors.primary} />
                <Text style={styles.tipText}>
                  Sin estas variables, la app funciona con datos de muestra
                  para que puedas probar el flujo completo.
                </Text>
              </View>
            </View>
          </View>
        )}

        {config && config.configured && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalles de configuración</Text>
            <View style={styles.card}>
              {[
                { label: "Proyecto", value: config.projectId || "—" },
                { label: "Procesador", value: config.processorId || "—" },
                { label: "Región", value: config.location || "us" },
              ].map((item, i) => (
                <View
                  key={item.label}
                  style={[styles.detailRow, i > 0 && styles.detailRowBorder]}
                >
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Feather name="book" size={20} color={Colors.primary} />
              <View style={styles.aboutInfo}>
                <Text style={styles.aboutName}>DocScan</Text>
                <Text style={styles.aboutVersion}>Versión 1.0.0</Text>
              </View>
            </View>
            <Text style={styles.aboutDesc}>
              Escáner de documentos con OCR para fotografiar libros y exportar a
              Word y PDF con números de página detectados automáticamente.
            </Text>
          </View>
        </View>
      </ScrollView>
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
  scroll: { flex: 1 },
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  statusRow: {
    flexDirection: "row",
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    flexShrink: 0,
  },
  dotSuccess: { backgroundColor: Colors.success },
  dotWarning: { backgroundColor: Colors.warning },
  dotError: { backgroundColor: Colors.error },
  statusInfo: { flex: 1, gap: 4 },
  statusTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  statusNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  refreshText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  setupIntro: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 20,
  },
  envItem: { paddingVertical: 10, gap: 4 },
  envItemBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  envName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  envDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  tipBox: {
    flexDirection: "row",
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.secondaryForeground,
    lineHeight: 18,
  },
  detailRow: { paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  detailLabel: {
    width: 90,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aboutInfo: { gap: 2 },
  aboutName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  aboutVersion: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  aboutDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 19,
  },
});
