import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useProjectContext } from "@/context/ProjectContext";
import type { Project } from "@/types";

function ProjectCard({
  project,
  onPress,
  onDelete,
}: {
  project: Project;
  onPress: () => void;
  onDelete: () => void;
}) {
  const pageCount = project.pages.length;
  const processingCount = project.pages.filter((p) => p.isProcessing).length;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      <View style={styles.cardIcon}>
        <Feather name="book" size={26} color={Colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {project.name}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaText}>
            {pageCount} {pageCount === 1 ? "página" : "páginas"}
          </Text>
          {processingCount > 0 && (
            <View style={styles.processingBadge}>
              <ActivityIndicator size="small" color={Colors.warning} />
              <Text style={styles.processingText}>Procesando...</Text>
            </View>
          )}
          {project.documentId && processingCount === 0 && (
            <View style={styles.readyBadge}>
              <Feather name="check-circle" size={12} color={Colors.success} />
              <Text style={styles.readyText}>Listo para descargar</Text>
            </View>
          )}
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textLight} />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { projects, loaded, deleteProject } = useProjectContext();

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "Eliminar proyecto",
      `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => deleteProject(id),
        },
      ],
    );
  };

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="book-open" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sin proyectos</Text>
          <Text style={styles.emptyText}>
            Presiona el botón + para comenzar a escanear un libro o documento
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/project/${item.id}`)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/new-project")}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={30} color={Colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 100, gap: 10 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 14,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardMetaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  processingBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  processingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.warning,
  },
  readyBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  readyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.success,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 24,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
});
