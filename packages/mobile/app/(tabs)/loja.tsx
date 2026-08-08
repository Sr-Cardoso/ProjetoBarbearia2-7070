import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { Fonts } from "@/constants/theme";
import { useCreateOrder, useLinkableAppointments, useProducts } from "@/queries/shop";
import { assetUrl, formatPrice } from "@/lib/format";

interface Success {
  orderId: number;
  totalCents: number;
  whatsappUrl: string | null;
  appointment: { date: string; range: string } | null;
}

/** Loja da barbearia: carrinho no app, pagamento no WhatsApp ou no salão. */
export default function Loja() {
  const colors = useColors();
  const catalog = useProducts();
  const createOrder = useCreateOrder();

  const [category, setCategory] = useState<string>("Todos");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const appointments = useLinkableAppointments(phone);

  const items = useMemo(() => {
    const all = catalog.data?.items ?? [];
    return category === "Todos" ? all : all.filter((item) => item.category === category);
  }, [catalog.data, category]);

  const lines = useMemo(() => {
    const all = catalog.data?.items ?? [];
    return Object.entries(cart)
      .map(([id, quantity]) => ({
        product: all.find((item) => item.id === Number(id)),
        quantity,
      }))
      .filter((line) => line.product && line.quantity > 0);
  }, [cart, catalog.data]);

  const totalCents = lines.reduce(
    (sum, line) => sum + (line.product?.priceCents ?? 0) * line.quantity,
    0,
  );
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const ready = count > 0 && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;

  function bump(id: number, delta: number, max: number) {
    setCart((current) => {
      const next = Math.min(Math.max((current[id] ?? 0) + delta, 0), max);
      const copy = { ...current };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  function submit() {
    if (!ready) return;
    setError(null);
    createOrder.mutate(
      {
        items: lines.map((line) => ({ productId: line.product!.id, quantity: line.quantity })),
        customerName: name.trim(),
        customerPhone: phone.trim(),
        notes: notes.trim() || undefined,
        appointmentId,
      },
      {
        onSuccess: (res) => {
          setSuccess({
            orderId: res.order.id,
            totalCents: res.totalCents,
            whatsappUrl: res.whatsappUrl,
            appointment: res.appointment
              ? { date: res.appointment.date, range: res.appointment.range }
              : null,
          });
          setCart({});
          setAppointmentId(null);
          setNotes("");
          if (res.whatsappUrl) Linking.openURL(res.whatsappUrl).catch(() => {});
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
          catalog.refetch();
        },
      },
    );
  }

  if (success) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ flex: 1, backgroundColor: colors.primary }}
      >
        <View style={styles.successBox}>
          <View style={styles.successIcon}>
            <Ionicons name="bag-check" size={32} color="#FFFFFF" />
          </View>
          <Text style={[styles.successTitle, { fontFamily: Fonts.displayBold }]}>
            Pedido #{success.orderId} enviado
          </Text>
          <Text style={styles.successText}>
            Total {formatPrice(success.totalCents)}
            {"\n"}
            {success.appointment
              ? `Separamos para o seu horário de ${success.appointment.date
                  .split("-")
                  .reverse()
                  .join("/")} às ${success.appointment.range}.`
              : "Combine o pagamento e a retirada pelo WhatsApp."}
          </Text>
          {success.whatsappUrl ? (
            <Pressable
              onPress={() => Linking.openURL(success.whatsappUrl!)}
              style={styles.successBtn}
            >
              <Ionicons name="logo-whatsapp" size={17} color={colors.foreground} />
              <Text style={[styles.successBtnText, { color: colors.foreground }]}>
                Falar no WhatsApp
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setSuccess(null)}
            style={[styles.successBtn, styles.successBtnGhost]}
          >
            <Text style={[styles.successBtnText, { color: "#FFFFFF" }]}>Voltar à loja</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const categories = ["Todos", ...(catalog.data?.categories ?? [])];

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 22 }}
        >
          <View>
            <Text style={[styles.kicker, { color: colors.primary }]}>Loja</Text>
            <Text
              style={{ color: colors.foreground, fontFamily: Fonts.displayBold, fontSize: 28 }}
            >
              Produtos da barbearia
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, marginTop: 4 }}>
              Monte o pedido aqui e pague no WhatsApp ou no salão. Se você tem horário marcado, os
              produtos entram na sua comanda.
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((item) => {
              const active = category === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.chip,
                    {
                      marginRight: 8,
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? "#FFFFFF" : colors.foreground,
                      fontFamily: Fonts.sansMedium,
                      fontSize: 13,
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {catalog.isLoading && <ActivityIndicator color={colors.primary} />}

          <View style={{ gap: 12 }}>
            {items.map((product) => {
              const quantity = cart[product.id] ?? 0;
              return (
                <View
                  key={product.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {product.imageUrl ? (
                    <Image
                      source={{ uri: assetUrl(product.imageUrl) }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: colors.secondary }]} />
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: Fonts.sansBold,
                        fontSize: 15,
                      }}
                    >
                      {product.name}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts.sans,
                        fontSize: 12,
                      }}
                    >
                      {product.description}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: colors.primary, fontFamily: Fonts.sansBold }}>
                        {formatPrice(product.priceCents)}
                      </Text>
                      {product.listPriceCents ? (
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontFamily: Fonts.sans,
                            fontSize: 12,
                            textDecorationLine: "line-through",
                          }}
                        >
                          {formatPrice(product.listPriceCents)}
                        </Text>
                      ) : null}
                    </View>

                    {product.inStock ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Pressable
                          onPress={() => bump(product.id, -1, product.stock)}
                          style={[styles.step, { borderColor: colors.border }]}
                        >
                          <Ionicons name="remove" size={14} color={colors.foreground} />
                        </Pressable>
                        <Text style={{ color: colors.foreground, fontFamily: Fonts.sansBold }}>
                          {quantity}
                        </Text>
                        <Pressable
                          onPress={() => bump(product.id, 1, product.stock)}
                          style={[styles.step, { borderColor: colors.border }]}
                        >
                          <Ionicons name="add" size={14} color={colors.foreground} />
                        </Pressable>
                      </View>
                    ) : (
                      <Text
                        style={{
                          color: colors.warning,
                          fontFamily: Fonts.sansMedium,
                          fontSize: 12,
                        }}
                      >
                        Sem estoque
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            {!catalog.isLoading && items.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans }}>
                Nenhum produto nesta categoria.
              </Text>
            ) : null}
          </View>

          {count > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={[styles.section, { color: colors.foreground }]}>Seu pedido</Text>
              <View
                style={[styles.cart, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {lines.map((line) => (
                  <View key={line.product!.id} style={styles.cartRow}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, flex: 1 }}>
                      {line.quantity}× {line.product!.name}
                    </Text>
                    <Text style={{ color: colors.foreground, fontFamily: Fonts.sansMedium }}>
                      {formatPrice(line.product!.priceCents * line.quantity)}
                    </Text>
                  </View>
                ))}
                <View style={[styles.cartRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, flex: 1 }}>
                    Total
                  </Text>
                  <Text
                    style={{ color: colors.foreground, fontFamily: Fonts.displayBold, fontSize: 20 }}
                  >
                    {formatPrice(totalCents)}
                  </Text>
                </View>
              </View>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
                ]}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="WhatsApp (00) 00000-0000"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
                ]}
              />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Observação (opcional)"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
                ]}
              />

              {appointments.data && appointments.data.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={[styles.section, { color: colors.foreground }]}>
                    Somar na comanda de um horário
                  </Text>
                  {appointments.data.map((appointment) => {
                    const active = appointmentId === appointment.id;
                    return (
                      <Pressable
                        key={appointment.id}
                        onPress={() => setAppointmentId(active ? null : appointment.id)}
                        style={[
                          styles.option,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: active ? "#FFFFFF" : colors.foreground,
                              fontFamily: Fonts.sansBold,
                              fontSize: 14,
                            }}
                          >
                            {appointment.date.split("-").reverse().join("/")} · {appointment.range}
                          </Text>
                          <Text
                            style={{
                              color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground,
                              fontFamily: Fonts.sans,
                              fontSize: 12,
                            }}
                          >
                            {appointment.serviceName} com {appointment.barberName} ·{" "}
                            {formatPrice(appointment.servicePriceCents + totalCents)} no total
                          </Text>
                        </View>
                        {active ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {error ? (
                <Text style={{ color: colors.destructive, fontFamily: Fonts.sans }}>{error}</Text>
              ) : null}

              <Pressable
                disabled={!ready || createOrder.isPending}
                onPress={submit}
                style={[
                  styles.submit,
                  {
                    backgroundColor: colors.primary,
                    opacity: !ready || createOrder.isPending ? 0.45 : 1,
                  },
                ]}
              >
                {createOrder.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="bag-handle" size={17} color="#FFFFFF" />
                )}
                <Text style={styles.submitText}>Enviar pedido</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", marginBottom: 4 },
  section: { fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase", fontWeight: "600" },
  chip: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 14, paddingVertical: 10 },
  card: {
    flexDirection: "row",
    gap: 14,
    borderWidth: 1,
    borderRadius: 3,
    padding: 12,
  },
  thumb: { width: 84, height: 96, borderRadius: 2 },
  step: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cart: { borderWidth: 1, borderRadius: 3, padding: 14, gap: 8 },
  cartRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
  },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  successBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  successIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  successTitle: { color: "#FFFFFF", fontSize: 26, textAlign: "center" },
  successText: {
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
  },
  successBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignSelf: "stretch",
  },
  successBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  successBtnText: {
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontWeight: "600",
  },
});
