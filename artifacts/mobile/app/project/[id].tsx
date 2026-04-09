import { Feather } from "@expo/vector-icons";
import { cacheDirectory, downloadAsync } from "expo-file-system/build/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useProjectContext } from "@/context/ProjectContext";
import { API } from "@/services/api";
import type { PageSummary } from "@/types";

function PageRow({ page }: { page: PageSummary }) {
  const numLabel =
    page.detectedPageNumber !== null
      ? `Pág. ${page.detectedPageNumber}`
      : "Sin número";

  if (page.isProcessing) {
    return (
      <View style={styles.pageRow}>
        <View style={styles.pageNumBadge}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
        <View style={styles.pageInfo}>
          <Text style={styles.pageNumText}>Procesando OCR...</Text>
          <Text style={styles.pageMeta}>Fotografía #{page.captureOrder + 1}</Text>
        </View>
      </View>
    );
  }

  if (page.error) {
    return (
      <View style={[styles.pageRow, styles.pageRowError]}>
        <View style={[styles.pageNumBadge, styles.pageNumBadgeError]}>
          <Feather name="alert-circle" size={18} color={Colors.error} />
        </View>
        <View style={styles.pageInfo}>
          <Text style={[styles.pageNumText, { color: Colors.error }]}>
            Error al procesar
          </Text>
          <Text style={styles.pageMeta} numberOfLines={1}>
            {page.error}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pageRow}>
      <View style={styles.pageNumBadge}>
        <Text style={styles.pageNumBadgeText}>{page.captureOrder + 1}</Text>
      </View>
      <View style={styles.pageInfo}>
        <Text style={styles.pageNumText}>{numLabel}</Text>
        <View style={styles.pageMetaRow}>
          <Text style={styles.pageMeta}>{page.wordCount} palabras</Text>
          {page.hasImages && (
            <Feather name="image" size={12} color={Colors.textMuted} />
          )}
          {page.hasTables && (
            <Feather name="grid" size={12} color={Colors.textMuted} />
          )}
        </View>
      </View>
    </View>
  );
}

async function downloadFile(
  url: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const localUri = `${cacheDirectory ?? "/tmp/"}${filename}`;
  const result = await downloadAsync(url, localUri, {
    headers: { Accept: mimeType },
  });
  if (result.status !== 200) {
    throw new Error(`Descarga fallida: ${result.status}`);
  }
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Compartir no disponible en este dispositivo");
  }
  await Sharing.shareAsync(result.uri, {
    mimeType,
    dialogTitle: `Guardar ${filename}`,
    UTI: filename.endsWith(".docx") ? "org.openxmlformats.wordprocessingml.document" : "com.adobe.pdf",
  });
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getProject, generateDocument } = useProjectContext();

  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<"word" | "pdf" | null>(null);

  const project = getProject(id);

  if (!project) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Proyecto no encontrado</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backBtnText}>Regresar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const readyPages = project.pages.filter((p) => !p.isProcessing && !p.error);
  const processingPages = project.pages.filter((p) => p.isProcessing);
  const canGenerate = readyPages.length > 0 && processingPages.length === 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      await generateDocument(project.id);
    } catch (err) {
      Alert.alert(
        "Error",
        `No se pudo generar el documento: ${(err as Error).message}`,
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format: "word" | "pdf") => {
    if (!project.documentId) return;
    setDownloading(format);
    try {
      const url = API.getDownloadUrl(project.documentId, format, project.name);
      const filename = `${project.name.replace(/[^a-zA-Z0-9\s]/g, "").trim()}.${format === "word" ? "docx" : "pdf"}`;
      const mimeType =
        format === "word"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";
      await downloadFile(url, filename, mimeType);
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={24} color={Colors.primaryForeground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project.name}
        </Text>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/camera",
              params: { projectId: project.id },
            })
          }
          style={styles.headerAdd}
        >
          <Feather name="camera" size={22} color={Colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{project.pages.length}</Text>
            <Text style={styles.statLabel}>Páginas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{readyPages.length}</Text>
            <Text style={styles.statLabel}>Procesadas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {project.documentId ? "✓" : "—"}
            </Text>
            <Text style={styles.statLabel}>Generado</Text>
          </View>
        </View>

        {project.pages.length === 0 ? (
          <View style={styles.emptyPages}>
            <Feather name="camera" size={40} color={Colors.textLight} />
            <Text style={styles.emptyPagesTitle}>Sin páginas</Text>
            <Text style={styles.emptyPagesText}>
              Usa el botón de cámara para fotografiar páginas del libro
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Páginas capturadas</Text>
            <View style={styles.pageList}>
              {project.pages.map((page) => (
                <PageRow key={page.id} page={page} />
              ))}
            </View>
          </View>
        )}

        {project.pages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Generar documento</Text>

            {processingPages.length > 0 && (
              <View style={styles.infoBox}>
                <ActivityIndicator size="small" color={Colors.warning} />
                <Text style={styles.infoBoxText}>
                  Esperando que {processingPages.length} página
                  {processingPages.length > 1 ? "s" : ""} termine
                  {processingPages.length > 1 ? "n" : ""} de procesar...
                </Text>
              </View>
            )}

            {!project.documentId ? (
              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  (!canGenerate || generating) && styles.generateBtnDisabled,
                ]}
                onPress={handleGenerate}
                disabled={!canGenerate || generating}
                activeOpacity={0.8}
              >
                {generating ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={Colors.primaryForeground}
                    />
                    <Text style={styles.generateBtnText}>Generando...</Text>
                  </>
                ) : (
                  <>
                    <Feather
                      name="file-text"
                      size={20}
                      color={Colors.primaryForeground}
                    />
                    <Text style={styles.generateBtnText}>
                      Generar Word y PDF
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.downloadSection}>
                <View style={styles.successBanner}>
                  <Feather
                    name="check-circle"
                    size={18}
                    color={Colors.success}
                  />
                  <Text style={styles.successText}>
                    Documento listo para descargar
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.downloadBtn, styles.downloadWord]}
                  onPress={() => handleDownload("word")}
                  disabled={downloading !== null}
                  activeOpacity={0.8}
                >
                  {downloading === "word" ? (
                    <ActivityIndicator
                      size="small"
                      color={Colors.primaryForeground}
                    />
                  ) : (
                    <Feather
                      name="file-text"
                      size={20}
                      color={Colors.primaryForeground}
                    />
                  )}
                  <Text style={styles.downloadBtnText}>
                    {downloading === "word"
                      ? "Descargando..."
                      : "Descargar Word (.docx)"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.downloadBtn, styles.downloadPdf]}
                  onPress={() => handleDownload("pdf")}
                  disabled={downloading !== null}
                  activeOpacity={0.8}
                >
                  {downloading === "pdf" ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="file" size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.downloadBtnText}>
                    {downloading === "pdf"
                      ? "Descargando..."
                      : "Descargar PDF"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.regenerateBtn}
                  onPress={handleGenerate}
                  disabled={!canGenerate || generating}
                >
                  <Text style={styles.regenerateBtnText}>
                    Regenerar documento
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: {
    color: Colors.primaryForeground,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerBack: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.primaryForeground,
  },
  headerAdd: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 20 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statNum: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyPages: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyPagesTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  emptyPagesText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    textAlign: "center",
    lineHeight: 20,
  },
  pageList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pageRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageRowError: { backgroundColor: Colors.errorLight },
  pageNumBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumBadgeError: { backgroundColor: Colors.errorLight },
  pageNumBadgeText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  pageInfo: { flex: 1 },
  pageNumText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  pageMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  pageMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.warning,
    lineHeight: 18,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 18,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  generateBtnDisabled: {
    backgroundColor: Colors.textLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  generateBtnText: {
    color: Colors.primaryForeground,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  downloadSection: { gap: 10 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  successText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.success,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  downloadWord: { backgroundColor: "#2563EB" },
  downloadPdf: { backgroundColor: "#DC2626" },
  downloadBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  regenerateBtn: {
    alignItems: "center",
    padding: 12,
  },
  regenerateBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
});
