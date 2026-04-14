import puppeteer, { type Browser, type Page } from "puppeteer-core";
import type { DrawDataProvider } from "@lottery/application";
import type { DrawOption } from "@lottery/domain";

interface TerminalDrawRecord {
  readonly drawNumber: string;
  readonly drawDate: string;
  readonly basePrice?: number;
}

interface Big8LiveDrawProviderOptions {
  readonly browserUrl?: string;
  readonly pageUrl?: string;
  readonly modalWaitMs?: number;
  readonly freshnessTtlSeconds?: number;
}

const DEFAULT_BROWSER_URL = "http://127.0.0.1:9222";
const DEFAULT_PAGE_URL = "https://webapp.cloud.nationallottery.ru/";
const DEFAULT_MODAL_WAIT_MS = 2500;
const DEFAULT_FRESHNESS_TTL_SECONDS = 45;

export class Big8LiveDrawProvider implements DrawDataProvider {
  private readonly browserUrl: string;
  private readonly pageUrl: string;
  private readonly modalWaitMs: number;
  private readonly freshnessTtlSeconds: number;

  constructor(options: Big8LiveDrawProviderOptions = {}) {
    this.browserUrl = options.browserUrl?.trim() || DEFAULT_BROWSER_URL;
    this.pageUrl = options.pageUrl?.trim() || DEFAULT_PAGE_URL;
    this.modalWaitMs = options.modalWaitMs ?? DEFAULT_MODAL_WAIT_MS;
    this.freshnessTtlSeconds = options.freshnessTtlSeconds ?? DEFAULT_FRESHNESS_TTL_SECONDS;
  }

  async fetchCurrentDraw(lotteryCode: string) {
    if (lotteryCode !== "bolshaya-8") {
      return null;
    }

    return this.withTerminalPage(async (page) => {
      const terminalDraws = await this.readTerminalDraws(page);
      if (terminalDraws.length === 0) {
        return null;
      }

      const availableDraws = terminalDraws
        .map((draw) => toDrawOption(draw))
        .sort((left, right) => Date.parse(left.drawAt) - Date.parse(right.drawAt));
      const primaryDraw = resolvePrimaryDraw(availableDraws);
      const fetchedAt = new Date().toISOString();

      return {
        drawId: primaryDraw.drawId,
        drawAt: primaryDraw.drawAt,
        fetchedAt,
        freshnessTtlSeconds: this.freshnessTtlSeconds,
        availableDraws
      };
    });
  }

  private async withTerminalPage<T>(run: (page: Page) => Promise<T>): Promise<T> {
    const browser = await puppeteer.connect({
      browserURL: this.browserUrl,
      defaultViewport: null
    });

    try {
      const page = await resolveTerminalPage(browser, this.pageUrl);
      await page.bringToFront();
      return await run(page);
    } finally {
      browser.disconnect();
    }
  }

  private async readTerminalDraws(page: Page): Promise<readonly TerminalDrawRecord[]> {
    const directDraws = await page.evaluate(extractDrawsFromReactProps);
    if (directDraws.length > 0) {
      return directDraws;
    }

    const opened = await page.evaluate(openDrawModalFromPage);
    if (!opened) {
      return [];
    }

    await page.waitForSelector('[role="dialog"]', {
      timeout: this.modalWaitMs
    });

    const modalDraws = await page.evaluate(extractDrawsFromModal);
    await page.keyboard.press("Escape").catch(() => undefined);
    return modalDraws;
  }
}

async function resolveTerminalPage(browser: Browser, pageUrl: string): Promise<Page> {
  const pages = await browser.pages();
  const directMatch = pages.find((page) => page.url().startsWith(pageUrl));
  if (directMatch) {
    return directMatch;
  }

  const targetMatch = await browser.waitForTarget(
    (target) => target.type() === "page" && target.url().startsWith(pageUrl),
    {
      timeout: 5000
    }
  );
  const page = await targetMatch.page();
  if (!page) {
    throw new Error(`terminal page "${pageUrl}" exists as a target but could not be attached`);
  }
  return page;
}

function extractDrawsFromReactProps(): TerminalDrawRecord[] {
  const elements = Array.from(document.querySelectorAll("*"));
  for (const element of elements) {
    const reactFiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber"));
    if (!reactFiberKey) {
      continue;
    }

    let fiber: unknown = (element as unknown as Record<string, unknown>)[reactFiberKey];
    let depth = 0;
    while (fiber && depth < 60) {
      const maybeProps = (fiber as { memoizedProps?: unknown }).memoizedProps;
      const props = maybeProps && typeof maybeProps === "object" ? (maybeProps as Record<string, unknown>) : null;
      if (
        props &&
        typeof props.onUpdateDraws === "function" &&
        Array.isArray(props.draws) &&
        props.draws.length > 0
      ) {
        return props.draws
          .map((draw) => sanitizeTerminalDraw(draw))
          .filter((draw): draw is TerminalDrawRecord => draw !== null);
      }

      fiber = (fiber as { return?: unknown }).return;
      depth += 1;
    }
  }

  return [];
}

function openDrawModalFromPage(): boolean {
  const existingDialog = document.querySelector('[role="dialog"]');
  if (existingDialog) {
    return true;
  }

  const trigger = Array.from(document.querySelectorAll("p")).find((node) => {
    const text = (node.textContent ?? "").trim();
    return text.includes("№") && /\d{1,2}:\d{2}/.test(text);
  });

  if (trigger instanceof HTMLElement) {
    trigger.click();
    return true;
  }

  return false;
}

function extractDrawsFromModal(): TerminalDrawRecord[] {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) {
    return [];
  }

  return Array.from(dialog.querySelectorAll('input[type="checkbox"]'))
    .map((checkbox) => {
      const input = checkbox as HTMLInputElement;
      const drawNumber = input.id?.trim();
      if (!drawNumber || !/^\d{4,}$/.test(drawNumber)) {
        return null;
      }

      const labelNode =
        input.closest("label") ??
        dialog.querySelector(`label[for="${drawNumber.replace(/"/g, '\\"')}"]`);
      const labelText = (labelNode?.textContent ?? "").trim();
      const drawDate = extractIsoLikeDate(labelText);

      if (!drawDate) {
        return null;
      }

      return {
        drawNumber,
        drawDate
      } satisfies TerminalDrawRecord;
    })
    .filter((draw): draw is TerminalDrawRecord => draw !== null);
}

function sanitizeTerminalDraw(input: unknown): TerminalDrawRecord | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const drawNumber =
    typeof record.drawNumber === "number" || typeof record.drawNumber === "string"
      ? String(record.drawNumber).trim()
      : "";
  const drawDate = typeof record.drawDate === "string" ? record.drawDate : "";
  const basePrice =
    typeof record.basePrice === "number" && Number.isFinite(record.basePrice) ? record.basePrice : undefined;

  if (!drawNumber || Number.isNaN(Date.parse(drawDate))) {
    return null;
  }

  return {
    drawNumber,
    drawDate: new Date(drawDate).toISOString(),
    ...(basePrice !== undefined ? { basePrice } : {})
  };
}

function extractIsoLikeDate(labelText: string): string | null {
  const match = labelText.match(/(\d{2})\.(\d{2})[^\d]+(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const now = new Date();
  const [, day, month, hours, minutes] = match;
  const candidate = new Date(
    now.getFullYear(),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    0,
    0
  );

  return candidate.toISOString();
}

function toDrawOption(draw: TerminalDrawRecord): DrawOption {
  const drawDate = new Date(draw.drawDate);
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(drawDate);

  return {
    drawId: draw.drawNumber,
    drawAt: drawDate.toISOString(),
    label:
      typeof draw.basePrice === "number"
        ? `№${draw.drawNumber} | ${formatted} | ${draw.basePrice} ₽`
        : `№${draw.drawNumber} | ${formatted}`,
    ...(typeof draw.basePrice === "number" ? { priceMinor: Math.round(draw.basePrice * 100) } : {})
  };
}

function resolvePrimaryDraw(draws: readonly DrawOption[]): DrawOption {
  const now = Date.now();
  return draws.find((draw) => Date.parse(draw.drawAt) >= now) ?? draws[0]!;
}
