export interface LotteryPresentation {
  readonly category: string;
  readonly tagline: string;
  readonly accentFrom: string;
  readonly accentTo: string;
}

const FALLBACK_PRESENTATION: LotteryPresentation = {
  category: "Тиражная лотерея",
  tagline: "Собери ставку, подтверди заявку и отправь её в терминальную очередь.",
  accentFrom: "#ff7b3b",
  accentTo: "#ff3b2e"
};

const PRESENTATIONS: Readonly<Record<string, LotteryPresentation>> = {
  mechtallion: {
    category: "Флагман",
    tagline: "Еженедельный эфир с крупным джекпотом и расширенным призовым фондом.",
    accentFrom: "#ff8c3a",
    accentTo: "#ff3d2c"
  },
  "bolshaya-8": {
    category: "Быстрые тиражи",
    tagline: "Три розыгрыша в час с повышенным фондом и агрессивной динамикой.",
    accentFrom: "#ffb347",
    accentTo: "#ff4f2e"
  },
  "velikolepnaya-8": {
    category: "Быстрые тиражи",
    tagline: "Регулярные тиражи с коротким циклом и понятной механикой входа.",
    accentFrom: "#ffc06a",
    accentTo: "#ff6433"
  },
  "super-8": {
    category: "Быстрые тиражи",
    tagline: "Формат 8x20 с усиленным множителем и экспресс-покупкой.",
    accentFrom: "#ffd15d",
    accentTo: "#ff6c3d"
  },
  "top-12": {
    category: "Числовая",
    tagline: "Лотерея с частыми тиражами и акцентом на серийную игру.",
    accentFrom: "#f7a540",
    accentTo: "#ff4d28"
  },
  "twelve-good-deeds": {
    category: "Благотворительная",
    tagline: "Часть средств направляется в социальные проекты и фонды.",
    accentFrom: "#ffb36b",
    accentTo: "#ff5c45"
  },
  "lavina-prizov": {
    category: "Моментум",
    tagline: "Плотный поток тиражей с акцентом на частые малые выигрыши.",
    accentFrom: "#ff9e4a",
    accentTo: "#ff3d2e"
  },
  premier: {
    category: "Тиражная",
    tagline: "Комфортный ритм розыгрышей для игры сериями.",
    accentFrom: "#ffaf5e",
    accentTo: "#ff5537"
  },
  turnir: {
    category: "Турнирная",
    tagline: "Серия розыгрышей с соревновательной механикой участия.",
    accentFrom: "#ffbf64",
    accentTo: "#ff5b2f"
  },
  "trizhdy-tri": {
    category: "Бинго",
    tagline: "Компактные тиражи с простым входом и быстрым результатом.",
    accentFrom: "#ff9958",
    accentTo: "#ff4a35"
  },
  "four-by-four": {
    category: "Бинго",
    tagline: "Формат 4x4 с коротким ожиданием статуса и понятной ставкой.",
    accentFrom: "#ffab61",
    accentTo: "#ff5633"
  },
  "forsage-75": {
    category: "Бинго",
    tagline: "Быстрые партии для игроков, которые любят плотный темп.",
    accentFrom: "#ffb66a",
    accentTo: "#ff5a35"
  },
  "pyataya-skorost": {
    category: "Числовая",
    tagline: "Ставки сериями с быстрым оборотом заявок.",
    accentFrom: "#ff9f5c",
    accentTo: "#ff4c2e"
  },
  "five-of-thirty-seven": {
    category: "Числовая",
    tagline: "Классическая механика 5/37 с гибкой глубиной участия.",
    accentFrom: "#ff9f53",
    accentTo: "#ff4e2f"
  },
  "pyat-o-pyat": {
    category: "Экспресс",
    tagline: "Плотные тиражи и работа с множителями в одном потоке.",
    accentFrom: "#ffb05f",
    accentTo: "#ff5731"
  },
  "cvetnye-shary": {
    category: "Кено",
    tagline: "Экспресс-розыгрыши с визуальным форматом цветных шаров.",
    accentFrom: "#ffcd76",
    accentTo: "#ff6b40"
  },
  "mechtallion-charity": {
    category: "Спецвыпуск",
    tagline: "Партнерский выпуск с благотворительным акцентом.",
    accentFrom: "#ffc27f",
    accentTo: "#ff7047"
  }
};

export function resolveLotteryPresentation(code: string): LotteryPresentation {
  return PRESENTATIONS[code] ?? FALLBACK_PRESENTATION;
}

export function listKnownLotteryPresentationCodes(): string[] {
  return Object.keys(PRESENTATIONS);
}
