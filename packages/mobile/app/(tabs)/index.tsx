import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useBarbers, useServices, useShopSettings } from "@/queries/booking";
import { HIGHLIGHT_ICON, useSiteColors, useSiteContent } from "@/queries/content";
import { assetUrl, formatPrice } from "@/lib/format";

export default function Home() {
  const content = useSiteContent();
  const colors = useSiteColors();
  const router = useRouter();
  const services = useServices();
  const barbers = useBarbers();
  const shop = useShopSettings();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Marca */}
        <View style={styles.brandBar}>
          <Image
            source={
              content?.brand.logoUrl
                ? { uri: assetUrl(content.brand.logoUrl) }
                : require("../../assets/logo.png")
            }
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Text style={styles.eyebrow}>{content?.hero.eyebrow ?? "Barbearia Cardoso"}</Text>
          <Text style={[styles.heroTitle, { fontFamily: Fonts.displayBold }]}>
            {content
              ? `${content.hero.title} ${content.hero.titleAccent}`.trim()
              : "Corte com hora marcada, do jeito certo"}
          </Text>
          <Text style={styles.heroText}>
            {content?.hero.text ??
              "Segunda a sexta, 08:00 às 18:00. Escolha serviço, barbeiro e horário em menos de um minuto."}
          </Text>
          <Pressable
            onPress={() => router.push("/agendar")}
            style={[styles.cta, { backgroundColor: "#FFFFFF" }]}
          >
            <Text style={[styles.ctaText, { color: colors.background }]}>
              {content?.hero.primaryCta ?? "Agendar horário"}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.background} />
          </Pressable>
        </View>

        {/* Destaques */}
        {content?.highlights.enabled !== false && (
        <View style={styles.section}>
          {(content?.highlights.items ?? []).map((h) => (
            <View
              key={h.title}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons
                  name={(HIGHLIGHT_ICON[h.icon] ?? "sparkles-outline") as never}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: colors.foreground, fontFamily: Fonts.sansBold, fontSize: 15 }}
                >
                  {h.title}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans }}>
                  {h.text}
                </Text>
              </View>
            </View>
          ))}
        </View>

        )}

        {/* Serviços */}
        {content?.services.enabled !== false && (
        <View style={styles.section}>
          <Text style={[styles.kicker, { color: colors.primary }]}>
            {content?.services.eyebrow ?? "Serviços"}
          </Text>
          <Text
            style={[styles.sectionTitle, { color: colors.foreground, fontFamily: Fonts.display }]}
          >
            {content?.services.title ?? "O que fazemos"}
          </Text>
          {services.isLoading && <ActivityIndicator color={colors.primary} />}
          {services.data?.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push("/agendar")}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {s.imageUrl ? (
                <Image source={{ uri: assetUrl(s.imageUrl) }} style={styles.cardImage} />
              ) : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{ color: colors.foreground, fontFamily: Fonts.display, fontSize: 17 }}
                >
                  {s.name}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 13 }}
                >
                  {s.description}
                </Text>
                <Text style={{ color: colors.primary, fontFamily: Fonts.sansBold }}>
                  {formatPrice(s.priceCents)} · {s.durationMin} min
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        )}

        {/* Equipe */}
        {content?.team.enabled !== false && (
        <View style={styles.section}>
          <Text style={[styles.kicker, { color: colors.primary }]}>
            {content?.team.eyebrow ?? "Equipe"}
          </Text>
          <Text
            style={[styles.sectionTitle, { color: colors.foreground, fontFamily: Fonts.display }]}
          >
            {content?.team.title ?? "Quem cuida do seu corte"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            {barbers.data?.map((b) => (
              <View
                key={b.id}
                style={[
                  styles.barber,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {b.photoUrl ? (
                  <Image source={{ uri: assetUrl(b.photoUrl) }} style={styles.barberPhoto} />
                ) : null}
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Fonts.display,
                    fontSize: 16,
                    marginTop: 10,
                  }}
                >
                  {b.name}
                </Text>
                <Text
                  style={{ color: colors.primary, fontFamily: Fonts.sansMedium, fontSize: 11 }}
                >
                  {b.role?.toUpperCase()}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        )}

        {/* Endereço */}
        <View style={[styles.footer, { backgroundColor: colors.accent }]}>
          <Text style={[styles.footerTitle, { fontFamily: Fonts.display }]}>
            {content?.brand.name ?? "Barbearia Cardoso"}
          </Text>
          {shop.data?.address ? (
            <Text style={styles.footerText}>{shop.data.address}</Text>
          ) : null}
          <Text style={styles.footerText}>
            {content?.footer.hours?.[0]
              ? `${content.footer.hours[0].day} · ${content.footer.hours[0].time}`
              : (shop.data?.hours ?? "Seg a sex · 08:00–18:00")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandBar: { alignItems: "center", backgroundColor: "#000000", paddingBottom: 18, paddingTop: 8 },
  brandLogo: { height: 132, width: 132 },
  hero: { padding: 24, paddingTop: 32, paddingBottom: 34, gap: 12 },
  eyebrow: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  heroTitle: { color: "#FFFFFF", fontSize: 32, lineHeight: 36 },
  heroText: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 21 },
  cta: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  ctaText: { fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "600" },
  section: { padding: 20, gap: 12 },
  kicker: { fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase" },
  sectionTitle: { fontSize: 24, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 3,
    padding: 14,
  },
  iconBox: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", gap: 14, borderWidth: 1, borderRadius: 3, padding: 12 },
  cardImage: { width: 78, height: 78 },
  barber: { width: 150, borderWidth: 1, borderRadius: 3, padding: 12, marginRight: 12 },
  barberPhoto: { width: "100%", height: 150 },
  footer: { margin: 20, padding: 22, gap: 6, borderRadius: 3 },
  footerTitle: { color: "#FFFFFF", fontSize: 20 },
  footerText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
});
