import type { DrawOption, DrawSnapshot, LotteryFormFieldDefinition, LotteryRegistryEntry } from "@lottery/domain";

interface LotterySeedDefinition {
  readonly lotteryCode: string;
  readonly sourceSlug: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly baseAmountMinor: number;
  readonly drawIntervalMinutes: number;
  readonly freshnessTtlSeconds: number;
  readonly formSchemaVersion: string;
  readonly formFields: readonly LotteryFormFieldDefinition[];
}

const DEFAULT_LOTTERY_SEED_DEFINITIONS: readonly LotterySeedDefinition[] = [
  seed({
    lotteryCode: "mechtallion",
    sourceSlug: "mechtallion",
    title: "Мечталлион",
    enabled: true,
    baseAmountMinor: 100,
    drawIntervalMinutes: 7 * 24 * 60,
    freshnessTtlSeconds: 24 * 60 * 60,
    formSchemaVersion: "v2-mechtallion",
    formFields: [drawCountField({ max: 8 }), textField("ticket_note", "Комментарий к билету")]
  }),
  seed({
    lotteryCode: "bolshaya-8",
    sourceSlug: "digital-8x20-big8",
    title: "Большая 8",
    enabled: true,
    baseAmountMinor: 25_000,
    drawIntervalMinutes: 20,
    freshnessTtlSeconds: 60 * 30,
    formSchemaVersion: "v3-big8-live",
    formFields: [textField("ticket_payload", "Big 8 payload")]
  }),
  seed({
    lotteryCode: "velikolepnaya-8",
    sourceSlug: "digital-8x20",
    title: "Великолепная 8",
    enabled: true,
    baseAmountMinor: 60,
    drawIntervalMinutes: 20,
    freshnessTtlSeconds: 60 * 30,
    formSchemaVersion: "v2-8x20",
    formFields: [drawCountField({ max: 40 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "super-8",
    sourceSlug: "digital-8x20-super8",
    title: "Супер 8",
    enabled: true,
    baseAmountMinor: 70,
    drawIntervalMinutes: 20,
    freshnessTtlSeconds: 60 * 30,
    formSchemaVersion: "v2-super8",
    formFields: [drawCountField({ max: 30 }), multiplierField()]
  }),
  seed({
    lotteryCode: "top-12",
    sourceSlug: "digital-12x24",
    title: "Топ 12",
    enabled: true,
    baseAmountMinor: 50,
    drawIntervalMinutes: 15,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-top12",
    formFields: [drawCountField({ max: 60 }), numbersModeField()]
  }),
  seed({
    lotteryCode: "twelve-good-deeds",
    sourceSlug: "digital-12x24-2",
    title: "12 Добрых дел",
    enabled: true,
    baseAmountMinor: 40,
    drawIntervalMinutes: 60,
    freshnessTtlSeconds: 60 * 40,
    formSchemaVersion: "v2-12dd",
    formFields: [drawCountField({ max: 20 }), charityShareField()]
  }),
  seed({
    lotteryCode: "lavina-prizov",
    sourceSlug: "digital-4x20",
    title: "Лавина призов",
    enabled: true,
    baseAmountMinor: 30,
    drawIntervalMinutes: 15,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-lavina",
    formFields: [drawCountField({ max: 70 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "premier",
    sourceSlug: "digital-4x20-premier",
    title: "Премьер",
    enabled: true,
    baseAmountMinor: 45,
    drawIntervalMinutes: 30,
    freshnessTtlSeconds: 60 * 30,
    formSchemaVersion: "v2-premier",
    formFields: [drawCountField({ max: 20 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "turnir",
    sourceSlug: "turnir",
    title: "Турнир",
    enabled: true,
    baseAmountMinor: 50,
    drawIntervalMinutes: 30,
    freshnessTtlSeconds: 60 * 30,
    formSchemaVersion: "v2-turnir",
    formFields: [drawCountField({ max: 20 }), multiplierField()]
  }),
  seed({
    lotteryCode: "trizhdy-tri",
    sourceSlug: "bingo-3x3",
    title: "Трижды три",
    enabled: true,
    baseAmountMinor: 25,
    drawIntervalMinutes: 10,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-3x3",
    formFields: [drawCountField({ max: 50 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "four-by-four",
    sourceSlug: "bingo-4x4-2",
    title: "4х4",
    enabled: true,
    baseAmountMinor: 25,
    drawIntervalMinutes: 15,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-4x4",
    formFields: [drawCountField({ max: 60 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "forsage-75",
    sourceSlug: "bingo-75",
    title: "Форсаж 75",
    enabled: true,
    baseAmountMinor: 30,
    drawIntervalMinutes: 15,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-forsage75",
    formFields: [drawCountField({ max: 40 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "pyataya-skorost",
    sourceSlug: "digital-5x36",
    title: "Пятая скорость",
    enabled: true,
    baseAmountMinor: 35,
    drawIntervalMinutes: 15,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-5x36",
    formFields: [drawCountField({ max: 50 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "five-of-thirty-seven",
    sourceSlug: "digital-5x37",
    title: "5 из 37",
    enabled: true,
    baseAmountMinor: 35,
    drawIntervalMinutes: 15,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-5x37",
    formFields: [drawCountField({ max: 50 }), ticketPackField()]
  }),
  seed({
    lotteryCode: "pyat-o-pyat",
    sourceSlug: "digital-5x50-5-5",
    title: "Пять-О-Пять",
    enabled: true,
    baseAmountMinor: 55,
    drawIntervalMinutes: 10,
    freshnessTtlSeconds: 60 * 20,
    formSchemaVersion: "v2-5o5",
    formFields: [drawCountField({ max: 30 }), multiplierField()]
  }),
  seed({
    lotteryCode: "cvetnye-shary",
    sourceSlug: "keno-colored_balls",
    title: "Цветные шары",
    enabled: true,
    baseAmountMinor: 20,
    drawIntervalMinutes: 5,
    freshnessTtlSeconds: 60 * 15,
    formSchemaVersion: "v2-colored-balls",
    formFields: [drawCountField({ max: 80 }), selectField("palette", "Палитра", ["classic", "sunset", "neon"], "classic")]
  }),
  seed({
    lotteryCode: "mechtallion-charity",
    sourceSlug: "mechtallion-bf-galchonok",
    title: "Мечталлион × Галчонок",
    enabled: false,
    baseAmountMinor: 120,
    drawIntervalMinutes: 7 * 24 * 60,
    freshnessTtlSeconds: 24 * 60 * 60,
    formSchemaVersion: "v2-mechtallion-charity",
    formFields: [drawCountField({ max: 8 }), charityShareField()]
  })
];

export function createDefaultLotteryRegistryEntries(): LotteryRegistryEntry[] {
  return DEFAULT_LOTTERY_SEED_DEFINITIONS.map((definition, index) => ({
    lotteryCode: definition.lotteryCode,
    title: definition.title,
    enabled: definition.enabled,
    displayOrder: (index + 1) * 10,
    formSchemaVersion: definition.formSchemaVersion,
    formFields: definition.formFields.map(cloneField),
    pricing: {
      strategy: "fixed",
      baseAmountMinor: definition.baseAmountMinor
    },
    handlers: {
      purchaseHandler: `handlers.${definition.lotteryCode}.purchase.v1`,
      resultHandler: `handlers.${definition.lotteryCode}.result.v1`
    }
  }));
}

export function createDefaultDrawSnapshots(now: Date = new Date()): DrawSnapshot[] {
  const nowTime = now.getTime();

  return DEFAULT_LOTTERY_SEED_DEFINITIONS.filter((definition) => definition.enabled).map((definition, index) => {
    const drawAt = new Date(nowTime + definition.drawIntervalMinutes * 60 * 1000 * (index + 1)).toISOString();
    const fetchedAtOffsetMs =
      index === 1
        ? definition.freshnessTtlSeconds * 1000 * 2
        : index === 2
          ? definition.freshnessTtlSeconds * 1000 + 60 * 1000
          : 5 * 60 * 1000;
    const fetchedAt = new Date(nowTime - fetchedAtOffsetMs).toISOString();

    return {
      lotteryCode: definition.lotteryCode,
      drawId: `${definition.sourceSlug}-draw-${String(index + 1).padStart(3, "0")}`,
      drawAt,
      fetchedAt,
      freshnessTtlSeconds: definition.freshnessTtlSeconds,
      ...(definition.lotteryCode === "bolshaya-8"
        ? {
            availableDraws: buildDefaultBig8DrawOptions(definition.sourceSlug, nowTime)
          }
        : {})
    } satisfies DrawSnapshot;
  });
}

export function listDefaultTerminalHandlerCodes(): string[] {
  return DEFAULT_LOTTERY_SEED_DEFINITIONS.filter((definition) => definition.enabled).map(
    (definition) => definition.lotteryCode
  );
}

export function listDefaultLotteryTitles(): string[] {
  return DEFAULT_LOTTERY_SEED_DEFINITIONS.map((definition) => definition.title);
}

function cloneField(field: LotteryFormFieldDefinition): LotteryFormFieldDefinition {
  return {
    ...field,
    ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {})
  };
}

function buildDefaultBig8DrawOptions(sourceSlug: string, nowTime: number): readonly DrawOption[] {
  return Array.from({ length: 3 }, (_, index) => {
    const drawTime = new Date(nowTime + (index + 1) * 20 * 60 * 1000);
    const drawId = `${sourceSlug}-live-${String(index + 1).padStart(2, "0")}`;
    return {
      drawId,
      drawAt: drawTime.toISOString(),
      label: `№${drawId} | ${drawTime.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} | 250 ₽`,
      priceMinor: 25_000
    } satisfies DrawOption;
  });
}

function seed(input: LotterySeedDefinition): LotterySeedDefinition {
  return input;
}

function drawCountField(options: { readonly max: number }): LotteryFormFieldDefinition {
  return {
    fieldKey: "draw_count",
    label: "Количество тиражей",
    type: "number",
    required: true,
    min: 1,
    max: options.max,
    step: 1,
    defaultValue: 1
  };
}

function textField(fieldKey: string, label: string): LotteryFormFieldDefinition {
  return {
    fieldKey,
    label,
    type: "text",
    required: false,
    placeholder: "По желанию"
  };
}

function ticketPackField(): LotteryFormFieldDefinition {
  return selectField("ticket_pack", "Пакет билетов", ["single", "five", "ten"], "single");
}

function multiplierField(): LotteryFormFieldDefinition {
  return selectField("multiplier", "Множитель", ["x1", "x2", "x5"], "x1");
}

function numbersModeField(): LotteryFormFieldDefinition {
  return selectField("numbers_mode", "Режим выбора", ["manual", "quick_pick"], "quick_pick");
}

function charityShareField(): LotteryFormFieldDefinition {
  return selectField("charity_share", "Отчисление в фонд", ["standard", "extended"], "standard");
}

function selectField(
  fieldKey: string,
  label: string,
  values: readonly string[],
  defaultValue: string
): LotteryFormFieldDefinition {
  return {
    fieldKey,
    label,
    type: "select",
    required: true,
    defaultValue,
    options: values.map((value) => ({
      value,
      label: value
    }))
  };
}
