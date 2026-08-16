import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import {
  useAvailability,
  useBarbers,
  useCreateBooking,
  useSchedule,
  useServices,
} from "@/queries/booking";
import {
  dayMonth,
  formatDateLong,
  formatPrice,
  maskPhone,
  nextOpenDays,
  weekdayShort,
} from "@/lib/format";

interface Success {
  service: string;
  barber: string;
  date: string;
  range: string;
  whatsappUrl: string | null;
}

export default function Agendar() {
  const colors = useColors();
  const services = useServices();
  const barbers = useBarbers();
  const createBooking = useCreateBooking();

  const schedule = useSchedule();
  const days = useMemo(() => nextOpenDays(12, schedule.data), [schedule.data]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [barberId, setBarberId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(days[0] ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const availability = useAvailability(date, barberId ?? undefined);
  const service = services.data?.find((s) => s.id === serviceId);

  // A lista de dias muda quando o painel libera/fecha datas — mantém a
  // seleção sempre em um dia que ainda aceita agendamento.
  useEffect(() => {
    if (days.length > 0 && !days.includes(date)) {
      setDate(days[0]);
      setSlot(null);
    }
  }, [days, date]);

  const ready =
    serviceId !== null &&
    barberId !== null &&
    Boolean(date && slot) &&
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length >= 10;

  function submit() {
    if (!ready || !serviceId || !barberId || !slot) return;
    setError(null);
    createBooking.mutate(
      {
        serviceId,
        barberId,
        date,
        slot: slot as "08:00",
        customerName: name.trim(),
        customerPhone: phone.trim(),
      },
      {
        onSuccess: (res) => {
          setSuccess({
            service: res.service.name,
            barber: res.barber.name,
            date: res.appointment.date,
            range: res.range,
            whatsappUrl: res.whatsappUrl,
          });
          if (res.whatsappUrl) Linking.openURL(res.whatsappUrl).catch(() => {});
        },
        onError: (err: unknown) => {
          setError(
            err instanceof Error ? err.message : "Não foi possível concluir o agendamento.",
          );
          setSlot(null);
          availability.refetch();
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
            <Ionicons name="checkmark" size={34} color="#FFFFFF" />
          </View>
          <Text style={[styles.successTitle, { fontFamily: Fonts.displayBold }]}>
            Horário reservado
          </Text>
          <Text style={styles.successText}>
            {success.service} com {success.barber}
            {"\n"}
            {formatDateLong(success.date)} · {success.range}
          </Text>
          {success.whatsappUrl ? (
            <Pressable
              onPress={() => Linking.openURL(success.whatsappUrl!)}
              style={styles.successBtn}
            >
              <Ionicons name="logo-whatsapp" size={17} color={colors.foreground} />
              <Text style={[styles.successBtnText, { color: colors.foreground }]}>
                Confirmar no WhatsApp
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setSuccess(null);
              setSlot(null);
              setName("");
              setPhone("");
            }}
            style={[styles.successBtn, styles.successBtnGhost]}
          >
            <Text style={[styles.successBtnText, { color: "#FFFFFF" }]}>Novo agendamento</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 26 }}
        >
          <View>
            <Text style={[styles.kicker, { color: colors.primary }]}>Agendamento</Text>
            <Text
              style={{ color: colors.foreground, fontFamily: Fonts.displayBold, fontSize: 28 }}
            >
              Escolha seu horário
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, marginTop: 4 }}>
              Seg a sex, blocos de 1h30. Horários ocupados ficam indisponíveis.
            </Text>
          </View>

          {/* 1 serviço */}
          <View style={{ gap: 10 }}>
            <Step n={1} label="Serviço" colors={colors} />
            {services.isLoading && <ActivityIndicator color={colors.primary} />}
            {services.data?.map((s) => {
              const active = serviceId === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setServiceId(s.id)}
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
                        fontSize: 15,
                      }}
                    >
                      {s.name}
                    </Text>
                    <Text
                      style={{
                        color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground,
                        fontFamily: Fonts.sans,
                        fontSize: 12,
                      }}
                    >
                      {s.durationMin} min
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: active ? "#FFFFFF" : colors.primary,
                      fontFamily: Fonts.sansBold,
                    }}
                  >
                    {formatPrice(s.priceCents)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 2 barbeiro */}
          <View style={{ gap: 10 }}>
            <Step n={2} label="Barbeiro" colors={colors} />
            <View style={styles.chips}>
              {barbers.data?.map((b) => {
                const active = barberId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setBarberId(b.id);
                      setSlot(null);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.accent : colors.card,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? colors.accentForeground : colors.foreground,
                        fontFamily: Fonts.sansMedium,
                        fontSize: 13,
                      }}
                    >
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 3 data */}
          <View style={{ gap: 10 }}>
            <Step n={3} label="Data" colors={colors} />
            {!schedule.data && (
              <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans }}>
                {schedule.isError
                  ? "Não foi possível carregar os dias de atendimento."
                  : "Carregando os dias de atendimento…"}
              </Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {days.map((iso) => {
                const active = date === iso;
                return (
                  <Pressable
                    key={iso}
                    onPress={() => {
                      setDate(iso);
                      setSlot(null);
                    }}
                    style={[
                      styles.day,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground,
                        fontSize: 11,
                        fontFamily: Fonts.sansMedium,
                      }}
                    >
                      {weekdayShort(iso)}
                    </Text>
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : colors.foreground,
                        fontFamily: Fonts.sansBold,
                        fontSize: 14,
                      }}
                    >
                      {dayMonth(iso)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 4 horário */}
          <View style={{ gap: 10 }}>
            <Step n={4} label="Horário" colors={colors} />
            {availability.isFetching ? (
              <ActivityIndicator color={colors.primary} />
            ) : availability.data?.closed ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans }}>
                {availability.data.reason}
              </Text>
            ) : (
              <View style={styles.chips}>
                {availability.data?.slots.map((s) => {
                  const active = slot === s.slot;
                  return (
                    <Pressable
                      key={s.slot}
                      disabled={!s.available}
                      onPress={() => setSlot(s.slot)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : s.available
                              ? colors.card
                              : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                          opacity: s.available ? 1 : 0.55,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active
                            ? "#FFFFFF"
                            : s.available
                              ? colors.foreground
                              : colors.mutedForeground,
                          fontFamily: Fonts.sansMedium,
                          fontSize: 13,
                        }}
                      >
                        {s.range}
                      </Text>
                      {!s.available ? (
                        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                          {s.reason}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* 5 dados */}
          <View style={{ gap: 10 }}>
            <Step n={5} label="Seus dados" colors={colors} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
              ]}
            />
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(maskPhone(v))}
              placeholder="(11) 90000-0000"
              keyboardType="number-pad"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
              ]}
            />
          </View>

          {error ? (
            <Text style={{ color: colors.destructive, fontFamily: Fonts.sans }}>{error}</Text>
          ) : null}

          <View style={[styles.summary, { backgroundColor: colors.accent }]}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, letterSpacing: 2 }}>
              TOTAL
            </Text>
            <Text style={{ color: "#FFFFFF", fontFamily: Fonts.displayBold, fontSize: 24 }}>
              {service ? formatPrice(service.priceCents) : "—"}
            </Text>
          </View>

          <Pressable
            disabled={!ready || createBooking.isPending}
            onPress={submit}
            style={[
              styles.submit,
              { backgroundColor: colors.primary, opacity: !ready || createBooking.isPending ? 0.45 : 1 },
            ]}
          >
            {createBooking.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={17} color="#FFFFFF" />
            )}
            <Text style={styles.submitText}>Confirmar agendamento</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({
  n,
  label,
  colors,
}: {
  n: number;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
        <Text style={{ color: "#FFFFFF", fontSize: 11, fontFamily: Fonts.sansBold }}>{n}</Text>
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 11,
          letterSpacing: 2.2,
          textTransform: "uppercase",
          fontFamily: Fonts.sansBold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", marginBottom: 4 },
  stepBadge: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 14, paddingVertical: 10 },
  day: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: "center",
    minWidth: 74,
  },
  input: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 3,
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
  successTitle: { color: "#FFFFFF", fontSize: 28, textAlign: "center" },
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
  successBtnText: { fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "600" },
});
