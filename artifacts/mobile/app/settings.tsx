import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { API, saveCredentials, clearCredentials, CREDS_STORAGE_KEY, type GcpCredentials } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ConfigStatus {
  configured: boolean;
  projectId: string | null;
  processorId: string | null;
  location: string;
  note: string;
  userCredsActive: boolean;
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={inpStyles.container}>
      <Text style={inpStyles.label}>{label}</Text>
      <TextInput
        style={[inpStyles.input, multiline && inpStyles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gcpProjectId, setGcpProjectId] = useState("");
  const [processorId, setProcessorId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsLoaded, setCredsLoaded] = useState(false);

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
    AsyncStorage.getItem(CREDS_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const creds = JSON.parse(raw) as GcpCredentials;
            setGcpProjectId(creds.gcpProjectId || "");
            setProcessorId(creds.processorId || "");
            setServiceAccountJson(creds.serviceAccountJson || "");
          } catch {}
        }
      })
      .finally(() => setCredsLoaded(true));
  }, []);

  const handleSaveCreds = async () => {
    if (!gcpProjectId.trim() || !processorId.trim() || !serviceAccountJson.trim()) {
      Alert.alert("Datos incompletos", "Por favor completa todos los campos de credenciales.");
      return;
    }
    try {
      JSON.parse(serviceAccountJson.trim());
    } catch {
      Alert.alert("JSON inválido", "El JSON de cuenta de servicio no tiene el formato correcto.");
      return;
    }
    setSavingCreds(true);
    try {
      await saveCredentials({
        gcpProjectId: gcpProjectId.trim(),
        processorId: processorId.trim(),
        serviceAccountJson: serviceAccountJson.trim(),
      });
      await checkConfig();
      Alert.alert("Guardado", "Credenciales guardadas. Se usarán en el siguiente escaneo.");
    } finally {
      setSavingCreds(false);
    }
  };

  const handleClearCreds = async () => {
    Alert.alert(
      "Borrar credenciales",
      "¿Borrar tus credenciales de Google Cloud? El app usará el modo de demostración.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            await clearCredentials();
            setGcpProjectId("");
            setProcessorId("");
            setServiceAccountJson("");
            await checkConfig();
          },
        },
      ],
    );
  };

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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* OCR Status */}
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
                      (config.configured || config.userCredsActive)
                        ? styles.dotSuccess
                        : styles.dotWarning,
                    ]}
                  />
                  <View style={styles.statusInfo}>
                    <Text
                      style={[
                        styles.statusTitle,
                        {
                          color:
                            config.configured || config.userCredsActive
                              ? Colors.success
                              : Colors.warning,
                        },
                      ]}
                    >
                      {config.userCredsActive
                        ? "Credenciales de usuario activas"
                        : config.configured
                          ? "Google Document AI configurado"
                          : "Usando OCR de demostración"}
                    </Text>
                    <Text style={styles.statusNote}>
                      {config.userCredsActive
                        ? "Tus credenciales de Google Cloud se envían con cada escaneo."
                        : config.note}
                    </Text>
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

          {/* User credentials form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credenciales de Google Cloud</Text>
            <View style={styles.card}>
              <Text style={styles.setupIntro}>
                Ingresa tus credenciales para usar Google Document AI real. Se guardan
                localmente en el dispositivo y se envían con cada escaneo.
              </Text>

              {credsLoaded && (
                <>
                  <LabeledInput
                    label="Google Cloud Project ID"
                    value={gcpProjectId}
                    onChangeText={setGcpProjectId}
                    placeholder="my-gcp-project-id"
                  />
                  <LabeledInput
                    label="Processor ID"
                    value={processorId}
                    onChangeText={setProcessorId}
                    placeholder="abc123def456..."
                  />
                  <LabeledInput
                    label="Service Account JSON"
                    value={serviceAccountJson}
                    onChangeText={setServiceAccountJson}
                    placeholder='{"type":"service_account","project_id":"..."}'
                    multiline
                  />

                  <View style={styles.credActions}>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleSaveCreds}
                      disabled={savingCreds}
                      activeOpacity={0.8}
                    >
                      {savingCreds ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Feather name="save" size={16} color="#FFF" />
                      )}
                      <Text style={styles.saveBtnText}>Guardar</Text>
                    </TouchableOpacity>

                    {(gcpProjectId || processorId || serviceAccountJson) && (
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={handleClearCreds}
                        activeOpacity={0.8}
                      >
                        <Feather name="trash-2" size={16} color={Colors.error} />
                        <Text style={styles.clearBtnText}>Borrar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              <View style={styles.tipBox}>
                <Feather name="info" size={14} color={Colors.primary} />
                <Text style={styles.tipText}>
                  Sin credenciales la app funciona con datos de muestra. Obtén una API
                  Key en console.cloud.google.com → Credenciales.
                </Text>
              </View>
            </View>
          </View>

          {/* Server config details */}
          {config?.configured && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Config del servidor</Text>
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

          {/* About */}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inpStyles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});

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
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  statusRow: { flexDirection: "row", gap: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
  dotSuccess: { backgroundColor: Colors.success },
  dotWarning: { backgroundColor: Colors.warning },
  dotError: { backgroundColor: Colors.error },
  statusInfo: { flex: 1, gap: 4 },
  statusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusNote: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 18 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  refreshText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },
  setupIntro: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 20 },
  credActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  clearBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.error },
  tipBox: { flexDirection: "row", backgroundColor: Colors.secondary, borderRadius: 10, padding: 12, gap: 8 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.secondaryForeground, lineHeight: 18 },
  detailRow: { paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  detailLabel: { width: 90, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  detailValue: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  aboutInfo: { gap: 2 },
  aboutName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  aboutVersion: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  aboutDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 19 },
});
