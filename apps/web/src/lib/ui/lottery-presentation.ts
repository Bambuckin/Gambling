export interface LotteryPresentation {
  readonly category: string;
  readonly tagline: string;
  readonly accentFrom: string;
  readonly accentTo: string;
}

const FALLBACK_PRESENTATION: LotteryPresentation = {
  category: "Тиражная лотерея",
  tagline: "Собери ставку, подтверди заявку и отправь её в терминальную очередь.",
  accentFrom: "#8b5cf6",
  accentTo: "#6d28d9"
};

const PRESENTATIONS: Readonly<Record<string, LotteryPresentation>> = {
  mechtallion: {
    category: "Флагман",
    tagline: "Еженедельный эфир с крупным джекпотом и расширенным призовым фондом.",
    accentFrom: "#7c3aed",
    accentTo: "#5b21b6"
  },
  "bolshaya-8": {
    category: "Быстрые тиражи",
    tagline: "Три розыгрыша в час с повышенным фондом и агрессивной динамикой.",
    accentFrom: "#a78bfa",
    accentTo: "#7c3aed"
  },
  "velikolepnaya-8": {
    category: "Быстрые тиражи",
    tagline: "Регулярные тиражи с коротким циклом и понятной механикой входа.",
    accentFrom: "#c4b5fd",
    accentTo: "#8b5cf6"
  },
  "super-8": {
    category: "Быстрые тиражи",
    tagline: "Формат 8x20 с усиленным множителем и экспресс-покупкой.",
    accentFrom: "#ddd6fe",
    accentTo: "#a78bfa"
  },
  "top-12": {
    category: "Числовая",
    tagline: "Лотерея с частыми тиражами и акцентом на серийную игру.",
    accentFrom: "#9333ea",
    accentTo: "#6b21a8"
  },
  "twelve-good-deeds": {
    category: "Благотворительная",
    tagline: "Часть средств направляется в социальные проекты и фонды.",
    accentFrom: "#a855f7",
    accentTo: "#7e22ce"
  },
  "lavina-prizov": {
    category: "Моментум",
    tagline: "Плотный поток тиражей с акцентом на частые малые выигрыши.",
    accentFrom: "#8b5cf6",
    accentTo: "#6d28d9"
  },
  premier: {
    category: "Тиражная",
    tagline: "Комфортный ритм розыгрышей для игры сериями.",
    accentFrom: "#b07afc",
    accentTo: "#8338ec"
  },
  turnir: {
    category: "Турнирная",
    tagline: "Серия розыгрышей с соревновательной механикой участия.",
    accentFrom: "#c084fc",
    accentTo: "#9333ea"
  },
  "trizhdy-tri": {
    category: "Бинго",
    tagline: "Компактные тиражи с простым входом и быстрым результатом.",
    accentFrom: "#a855f7",
    accentTo: "#7c3aed"
  },
  "four-by-four": {
    category: "Бинго",
    tagline: "Формат 4x4 с коротким ожиданием статуса и понятной ставкой.",
    accentFrom: "#b07afc",
    accentTo: "#8b5cf6"
  },
  "forsage-75": {
    category: "Бинго",
    tagline: "Быстрые партии для игроков, которые любят плотный темп.",
    accentFrom: "#c084fc",
    accentTo: "#9333ea"
  },
  "pyataya-skorost": {
    category: "Числовая",
    tagline: "Ставки сериями с быстрым оборотом заявок.",
    accentFrom: "#9f7aea",
    accentTo: "#805ad5"
  },
  "five-of-thirty-seven": {
    category: "Числовая",
    tagline: "Классическая механика 5/37 с гибкой глубиной участия.",
    accentFrom: "#9f7aea",
    accentTo: "#6b46c1"
  },
  "pyat-o-pyat": {
    category: "Экспресс",
    tagline: "Плотные тиражи и работа с множителями в одном потоке.",
    accentFrom: "#b794f4",
    accentTo: "#8b5cf6"
  },
  "cvetnye-shary": {
    category: "Кено",
    tagline: "Экспресс-розыгрыши с визуальным форматом цветных шаров.",
    accentFrom: "#d6bcfa",
    accentTo: "#a78bfa"
  },
  "mechtallion-charity": {
    category: "Спецвыпуск",
    tagline: "Партнерский выпуск с благотворительным акцентом.",
    accentFrom: "#c4b5fd",
    accentTo: "#9f7aea"
  }
};

export function resolveLotteryPresentation(code: string): LotteryPresentation {
  return PRESENTATIONS[code] ?? FALLBACK_PRESENTATION;
}

export function listKnownLotteryPresentationCodes(): string[] {
  return Object.keys(PRESENTATIONS);
}
