import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useShopSettings } from "@/queries/booking";
import { useSiteColors, useSiteContent } from "@/queries/content";
import { assetUrl } from "@/lib/format";

const FALLBACK_HOURS = [
  { day: "Segunda a sexta", time: "08:00 – 18:00" },
  { day: "Sábado", time: "Fechado" },
  { day: "Domingo", time: "Fechado" },
];

export default function Contato() {
  const content = useSiteContent();
  const colors = useSiteColors();
  const shop = useShopSettings();
  const hours = content?.footer.hours?.length ? content.footer.hours : FALLBACK_HOURS;
  const data = shop.data ?? {};

  const whatsappDigits = (data.whatsapp ?? "").replace(/\D/g, "");

  const items = [
    {
      icon: "logo-whatsapp" as const,
      label: "WhatsApp",
      value: data.phone ?? data.whatsapp ?? "—",
      action: whatsappDigits ? () => Linking.openURL(`https://wa.me/${whatsappDigits}`) : null,
    },
    {
      icon: "location-outline" as const,
      label: "Endereço",
      value: data.address ?? "—",
      action: data.address
        ? () =>
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address!)}`,
            )
        : null,
    },
    {
      icon: "logo-instagram" as const,
      label: "Instagram",
      value: data.instagram ?? "—",
      action: data.instagram
        ? () =>
            Linking.openURL(
              `https://instagram.com/${(data.instagram ?? "").replace(/^@/, "")}`,
            )
        : null,
    },
  ];

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 22 }}>
        <Image
          source={
            content?.brand.logoUrl
              ? { uri: assetUrl(content.brand.logoUrl) }
              : require("../../assets/logo.png")
          }
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <View>
          <Text style={[styles.kicker, { color: colors.primary }]}>Contato</Text>
          <Text style={{ color: colors.foreground, fontFamily: Fonts.displayBold, fontSize: 28 }}>
            {`Fale com ${content?.brand.name ?? "a barbearia"}`}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {items.map((item) => (
            <Pressable
              key={item.label}
              onPress={item.action ?? undefined}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, letterSpacing: 1.6 }}>
                  {item.label.toUpperCase()}
                </Text>
                <Text style={{ color: colors.foreground, fontFamily: Fonts.sansMedium }}>
                  {item.value}
                </Text>
              </View>
              {item.action ? (
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={[styles.hours, { backgroundColor: colors.accent }]}>
          <Text style={{ color: "#FFFFFF", fontFamily: Fonts.display, fontSize: 20 }}>
            {content?.footer.hoursTitle ?? "Horários"}
          </Text>
          {hours.map((h) => (
            <View key={h.day} style={styles.hourRow}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: Fonts.sans }}>
                {h.day}
              </Text>
              <Text style={{ color: "#FFFFFF", fontFamily: Fonts.sansMedium }}>{h.time}</Text>
            </View>
          ))}
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 6 }}>
            {content?.footer.note ?? "Atendimento em blocos de 1h30, apenas com horário marcado."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandLogo: { alignSelf: "center", height: 120, width: 120 },
  kicker: { fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 3,
    padding: 14,
  },
  iconBox: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  hours: { padding: 20, gap: 8, borderRadius: 3 },
  hourRow: { flexDirection: "row", justifyContent: "space-between" },
});
