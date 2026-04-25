import puppeteer, { type Browser, type Page } from "puppeteer-core";
import type {
  LotteryPurchaseContext,
  LotteryPurchaseHandlerContract,
  LotteryPurchaseResult
} from "@lottery/lottery-handlers";

interface Big8TicketPayload {
  readonly boardNumbers: readonly number[];
  readonly extraNumber: number;
  readonly multiplier: number;
}

interface Big8PurchasePayload {
  readonly contactPhone: string;
  readonly tickets: readonly Big8TicketPayload[];
}

interface Big8TerminalCartHandlerOptions {
  readonly browserUrl?: string;
  readonly pageUrl?: string;
  readonly stepTimeoutMs?: number;
  readonly drawModalWaitMs?: number;
  readonly reloadBeforeRun?: boolean;
}

const DEFAULT_BROWSER_URL = "http://127.0.0.1:9222";
const DEFAULT_PAGE_URL = "https://webapp.cloud.nationallottery.ru/";
const DEFAULT_STEP_TIMEOUT_MS = 8_000;
const DEFAULT_DRAW_MODAL_WAIT_MS = 3_500;
const BIG8_BOARD_REQUIRED = 8;
const BIG8_BOARD_MIN = 1;
const BIG8_BOARD_MAX = 20;
const BIG8_EXTRA_MIN = 1;
const BIG8_EXTRA_MAX = 4;
const BIG8_MULTIPLIER_MIN = 1;
const BIG8_MULTIPLIER_MAX = 10;
const BIG8_PICKER_ROOT =
  "#root > div > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(3)";

export class Big8TerminalCartHandler implements LotteryPurchaseHandlerContract {
  readonly contractVersion = "v1" as const;
  readonly lotteryCode = "bolshaya-8";
  readonly bindingKey = "bolshaya-8-terminal-handler-v1";

  private readonly browserUrl: string;
  private readonly pageUrl: string;
  private readonly stepTimeoutMs: number;
  private readonly drawModalWaitMs: number;
  private readonly reloadBeforeRun: boolean;

  constructor(options: Big8TerminalCartHandlerOptions = {}) {
    this.browserUrl = options.browserUrl?.trim() || DEFAULT_BROWSER_URL;
    this.pageUrl = options.pageUrl?.trim() || DEFAULT_PAGE_URL;
    this.stepTimeoutMs = options.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    this.drawModalWaitMs = options.drawModalWaitMs ?? DEFAULT_DRAW_MODAL_WAIT_MS;
    this.reloadBeforeRun = options.reloadBeforeRun ?? true;
  }

  async purchase(context: LotteryPurchaseContext): Promise<LotteryPurchaseResult> {
    const payload = parseBig8Payload(context.ticketPayload);
    const journal: string[] = [];

    const browser = await puppeteer.connect({
      browserURL: this.browserUrl,
      defaultViewport: null
    });

    try {
      const page = await resolveTerminalPage(browser, this.pageUrl);
      await page.bringToFront();

      if (this.reloadBeforeRun) {
        await page.reload({
          waitUntil: "domcontentloaded",
          timeout: this.stepTimeoutMs
        });
        journal.push("page_reloaded=true");
      }

      await ensureBig8PurchaseScreen(page, journal, this.stepTimeoutMs);
      await selectDraw(page, context.draw.drawId, journal, this.drawModalWaitMs);
      await syncTicketCount(page, payload.tickets.length, journal);

      for (const [index, ticket] of payload.tickets.entries()) {
        await fillTicketSelection(page, index, ticket, journal);
      }

      await proceedToPhoneStep(page, journal, this.stepTimeoutMs);
      await enterPhone(page, payload.contactPhone, journal);
      await clickAddToCart(page, journal, this.stepTimeoutMs);

      const cartSnapshot = await readCartSnapshot(page);
      if (cartSnapshot) {
        journal.push(`cart_snapshot=${cartSnapshot}`);
      }

      await ensureCheckoutReady(page, journal, this.stepTimeoutMs);
      await finalizePurchase(page, journal, this.stepTimeoutMs);
      const purchaseReference = await readPurchaseReference(page, context.requestId);
      journal.push(`purchase_reference=${purchaseReference}`);

      return {
        executionOutcome: "ticket_purchased",
        externalTicketReference: purchaseReference,
        rawTerminalOutput: [
          `[big8-purchase-handler] request=${context.requestId} draw=${context.draw.drawId} tickets=${payload.tickets.length}`,
          ...journal
        ].join(" | ")
      };
    } finally {
      browser.disconnect();
    }
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
      timeout: 5_000
    }
  );
  const page = await targetMatch.page();
  if (!page) {
    throw new Error(`terminal page "${pageUrl}" exists as a target but could not be attached`);
  }
  return page;
}

async function ensureBig8PurchaseScreen(page: Page, journal: string[], timeoutMs: number): Promise<void> {
  if (await page.$("#button-select-draw")) {
    journal.push("screen=big8_purchase");
    return;
  }

  const opened = await page.evaluate(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button'], li, div"));
    const byText = candidates.find((candidate) => normalize(candidate.textContent ?? "").includes("большая 8"));
    if (byText) {
      byText.click();
      return true;
    }

    const fallbackPath = document.querySelector<SVGPathElement>(
      "#root div div div div:nth-of-type(2) ul:nth-of-type(2) div:nth-of-type(10) path:nth-of-type(11)"
    );
    if (fallbackPath) {
      const target =
        fallbackPath.closest<HTMLElement>("button, [role='button'], div") ??
        (fallbackPath as unknown as HTMLElement);
      target.click();
      return true;
    }

    return false;
  });
  if (!opened) {
    throw new Error("unable to open the 'Большая 8' terminal screen");
  }

  await page.waitForSelector("#button-select-draw", {
    timeout: timeoutMs
  });
  journal.push("screen=big8_purchase_opened");
}

async function selectDraw(
  page: Page,
  drawId: string,
  journal: string[],
  drawModalWaitMs: number
): Promise<void> {
  await page.waitForSelector("#button-select-draw", {
    timeout: drawModalWaitMs
  });
  await page.click("#button-select-draw");

  await page.waitForSelector('[role="dialog"]', {
    timeout: drawModalWaitMs
  });

  const selected = await page.evaluate((inputDrawId) => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) {
      return false;
    }

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const normalizedDrawId = normalize(inputDrawId);
    const numericHint = normalizedDrawId.match(/\d+/g)?.at(-1) ?? "";

    const checkboxes = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const byExactId = checkboxes.find((checkbox) => normalize(checkbox.id) === normalizedDrawId);
    const byNumericId = !byExactId && numericHint
      ? checkboxes.find((checkbox) => normalize(checkbox.id).includes(numericHint))
      : null;
    const byLabel = Array.from(dialog.querySelectorAll<HTMLElement>("label")).find((label) => {
      const text = normalize(label.textContent ?? "");
      return text.includes(normalizedDrawId) || Boolean(numericHint && text.includes(numericHint));
    });

    const directTarget = byExactId ?? byNumericId;
    if (directTarget) {
      const escapedId = directTarget.id.replace(/["\\]/g, "\\$&");
      const label =
        directTarget.closest<HTMLElement>("label") ??
        dialog.querySelector<HTMLElement>(`label[for="${escapedId}"]`);
      if (label) {
        label.click();
        return true;
      }
      directTarget.click();
      return true;
    }

    if (byLabel) {
      byLabel.click();
      return true;
    }

    return false;
  }, drawId);
  if (!selected) {
    throw new Error(`draw "${drawId}" could not be selected in terminal modal`);
  }

  const confirmed = await page.evaluate(() => {
    const direct = document.querySelector<HTMLElement>("#button-modal-select-draws");
    if (direct) {
      direct.click();
      return true;
    }

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const button = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']")).find((node) =>
      normalize(node.textContent ?? "").includes("выбрать")
    );
    if (button) {
      button.click();
      return true;
    }

    return false;
  });
  if (!confirmed) {
    throw new Error("draw modal confirm button was not found");
  }

  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), {
    timeout: drawModalWaitMs
  });
  journal.push(`draw_selected=${drawId}`);
}

async function syncTicketCount(page: Page, desiredCount: number, journal: string[]): Promise<void> {
  if (desiredCount <= 0) {
    throw new Error("ticket list must contain at least one ticket");
  }

  if (desiredCount === 1) {
    journal.push("ticket_count=1");
    return;
  }

  const synced = await page.evaluate((count) => {
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const controls = Array.from(document.querySelectorAll<HTMLElement>("div, section, article"));

    const counterContainer = controls.find((container) => {
      const text = normalize(container.textContent ?? "");
      if (!text.includes("билет")) {
        return false;
      }

      const buttons = Array.from(container.querySelectorAll<HTMLElement>("button"));
      const hasPlus = buttons.some((button) => {
        const value = (button.textContent ?? "").trim();
        return value === "+" || value === "＋";
      });
      const hasMinus = buttons.some((button) => {
        const value = (button.textContent ?? "").trim();
        return value === "-" || value === "−";
      });
      return hasPlus && hasMinus;
    });

    if (!counterContainer) {
      return false;
    }

    const buttons = Array.from(counterContainer.querySelectorAll<HTMLElement>("button"));
    const plus = buttons.find((button) => {
      const value = (button.textContent ?? "").trim();
      return value === "+" || value === "＋";
    });
    const minus = buttons.find((button) => {
      const value = (button.textContent ?? "").trim();
      return value === "-" || value === "−";
    });
    if (!plus || !minus) {
      return false;
    }

    for (let index = 0; index < 15; index += 1) {
      minus.click();
    }
    for (let index = 1; index < count; index += 1) {
      plus.click();
    }

    return true;
  }, desiredCount);

  if (!synced) {
    throw new Error(`unable to sync ticket count for ${desiredCount} tickets`);
  }

  journal.push(`ticket_count=${desiredCount}`);
}

async function fillTicketSelection(
  page: Page,
  ticketIndex: number,
  ticket: Big8TicketPayload,
  journal: string[]
): Promise<void> {
  const boardContainerSelector = `${BIG8_PICKER_ROOT} > div:nth-of-type(${ticketIndex * 2 + 1}) > div`;
  const extraContainerSelector = `${BIG8_PICKER_ROOT} > div:nth-of-type(${ticketIndex * 2 + 2}) > div`;

  await page.waitForSelector(boardContainerSelector, {
    timeout: 5_000
  });
  await page.waitForSelector(extraContainerSelector, {
    timeout: 5_000
  });

  const updated = await page.evaluate(
    ({ boardSelector, extraSelector, boardNumbers, extraNumber, boardMin, boardMax, extraMin, extraMax }) => {
      const boardRoot = document.querySelector<HTMLElement>(boardSelector);
      const extraRoot = document.querySelector<HTMLElement>(extraSelector);
      if (!boardRoot || !extraRoot) {
        return false;
      }

      const normalize = (value: string) => value.trim();
      const isActive = (node: HTMLElement): boolean => {
        const className = typeof node.className === "string" ? node.className.toLowerCase() : "";
        return (
          node.getAttribute("aria-pressed") === "true" ||
          node.getAttribute("aria-checked") === "true" ||
          className.includes("active") ||
          className.includes("selected") ||
          className.includes("checked")
        );
      };

      const toNumberMap = (container: HTMLElement, min: number, max: number): Map<number, HTMLElement> => {
        const map = new Map<number, HTMLElement>();
        const candidates = Array.from(container.querySelectorAll<HTMLElement>("button, div"));
        for (const candidate of candidates) {
          const value = Number(normalize(candidate.textContent ?? ""));
          if (!Number.isInteger(value) || value < min || value > max || map.has(value)) {
            continue;
          }
          map.set(value, candidate);
        }
        return map;
      };

      const boardMap = toNumberMap(boardRoot, boardMin, boardMax);
      const extraMap = toNumberMap(extraRoot, extraMin, extraMax);
      if (boardMap.size < boardMax || extraMap.size < extraMax) {
        return false;
      }

      const targetBoardSet = new Set(boardNumbers);
      for (const [value, node] of boardMap.entries()) {
        const shouldBeActive = targetBoardSet.has(value);
        if (isActive(node) !== shouldBeActive) {
          node.click();
        }
      }

      for (const [value, node] of extraMap.entries()) {
        const shouldBeActive = value === extraNumber;
        if (isActive(node) !== shouldBeActive) {
          node.click();
        }
      }

      return true;
    },
    {
      boardSelector: boardContainerSelector,
      extraSelector: extraContainerSelector,
      boardNumbers: [...ticket.boardNumbers],
      extraNumber: ticket.extraNumber,
      boardMin: BIG8_BOARD_MIN,
      boardMax: BIG8_BOARD_MAX,
      extraMin: BIG8_EXTRA_MIN,
      extraMax: BIG8_EXTRA_MAX
    }
  );

  if (!updated) {
    throw new Error(`unable to set board values for ticket ${ticketIndex + 1}`);
  }

  await syncTicketMultiplier(page, ticketIndex, ticket.multiplier);

  journal.push(
    `ticket_${ticketIndex + 1}=board:${ticket.boardNumbers.join(",")};extra:${ticket.extraNumber};x${ticket.multiplier}`
  );
}

async function syncTicketMultiplier(page: Page, ticketIndex: number, targetMultiplier: number): Promise<void> {
  if (targetMultiplier === 1) {
    return;
  }

  const synced = await page.evaluate(
    ({ index, target }) => {
      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
      const hasCounterButtons = (container: HTMLElement): boolean => {
        const buttons = Array.from(container.querySelectorAll<HTMLElement>("button"));
        const hasPlus = buttons.some((button) => {
          const value = (button.textContent ?? "").trim();
          return value === "+" || value === "пј‹";
        });
        const hasMinus = buttons.some((button) => {
          const value = (button.textContent ?? "").trim();
          return value === "-" || value === "в€’";
        });
        return hasPlus && hasMinus;
      };
      const readMultiplier = (container: HTMLElement): number | null => {
        const text = normalize(container.textContent ?? "");
        const xMatch = text.match(/x\s*(\d{1,2})/i);
        if (xMatch) {
          return Number(xMatch[1]);
        }

        const fallback = text.match(/(\d{1,2})/);
        if (!fallback) {
          return null;
        }
        return Number(fallback[1]);
      };
      const resolveButtons = (container: HTMLElement): { plus: HTMLElement; minus: HTMLElement } | null => {
        const buttons = Array.from(container.querySelectorAll<HTMLElement>("button"));
        const plus = buttons.find((button) => {
          const value = (button.textContent ?? "").trim();
          return value === "+" || value === "пј‹";
        });
        const minus = buttons.find((button) => {
          const value = (button.textContent ?? "").trim();
          return value === "-" || value === "в€’";
        });
        if (!plus || !minus) {
          return null;
        }
        return { plus, minus };
      };

      const candidates = Array.from(document.querySelectorAll<HTMLElement>("div, section, article"))
        .filter((container) => {
          if (!hasCounterButtons(container)) {
            return false;
          }

          const text = normalize(container.textContent ?? "");
          return text.includes("x") || text.includes("множ") || text.includes("multiplier");
        });

      if (candidates.length === 0) {
        return false;
      }

      const container = candidates[Math.min(index, candidates.length - 1)];
      if (!container) {
        return false;
      }

      const controls = resolveButtons(container);
      if (!controls) {
        return false;
      }

      let current = readMultiplier(container) ?? 1;
      if (!Number.isFinite(current) || current < 1) {
        current = 1;
      }

      if (current > target) {
        for (let step = current; step > target; step -= 1) {
          controls.minus.click();
        }
      } else if (current < target) {
        for (let step = current; step < target; step += 1) {
          controls.plus.click();
        }
      }

      const actual = readMultiplier(container) ?? target;
      return actual === target;
    },
    {
      index: ticketIndex,
      target: targetMultiplier
    }
  );

  if (!synced) {
    throw new Error(`unable to set multiplier x${targetMultiplier} for ticket ${ticketIndex + 1}`);
  }
}

async function proceedToPhoneStep(page: Page, journal: string[], timeoutMs: number): Promise<void> {
  const clicked = await page.evaluate(() => {
    const direct = document.querySelector<HTMLElement>("#to-add-phone");
    if (direct) {
      direct.click();
      return true;
    }

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const button = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']")).find((node) =>
      normalize(node.textContent ?? "").includes("далее")
    );
    if (button) {
      button.click();
      return true;
    }

    return false;
  });
  if (!clicked) {
    throw new Error("unable to advance from ticket picker to phone step");
  }

  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector("#add-to-cart-button") ||
          document.querySelector("#btn-buy") ||
          document.querySelector("input[type='tel'], input[name*='phone'], input[id*='phone']")
      ),
    {
      timeout: timeoutMs
    }
  );
  journal.push("phone_step=open");
}

async function enterPhone(page: Page, contactPhone: string, journal: string[]): Promise<void> {
  const directInput = await page.evaluate((digits) => {
    const input = document.querySelector<HTMLInputElement>(
      "input[type='tel'], input[name*='phone'], input[id*='phone'], input[placeholder*='тел']"
    );
    if (!input) {
      return false;
    }

    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = digits;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, contactPhone);

  if (!directInput) {
    const cleared = await page.evaluate(() => {
      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
      const clearButton = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']")).find(
        (node) => {
          const text = normalize(node.textContent ?? "");
          const label = normalize(node.getAttribute("aria-label") ?? "");
          return text.includes("стер") || text.includes("очист") || label.includes("backspace");
        }
      );
      if (!clearButton) {
        return false;
      }

      for (let index = 0; index < 18; index += 1) {
        clearButton.click();
      }
      return true;
    });
    if (cleared) {
      journal.push("phone_cleared=keypad");
    }

    for (const digit of contactPhone) {
      const clicked = await page.evaluate((currentDigit) => {
        const button = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']")).find(
          (node) => (node.textContent ?? "").trim() === currentDigit
        );
        if (!button) {
          return false;
        }
        button.click();
        return true;
      }, digit);
      if (!clicked) {
        throw new Error(`unable to type phone digit "${digit}" from terminal keypad`);
      }
    }
  }

  journal.push(`phone_entered=***${contactPhone.slice(-4)}`);
}

async function clickAddToCart(page: Page, journal: string[], timeoutMs: number): Promise<void> {
  const clicked = await page.evaluate(() => {
    const selectors = ["#add-to-cart-button", "#btn-buy"];
    for (const selector of selectors) {
      const target = document.querySelector<HTMLElement>(selector);
      if (target) {
        target.click();
        return true;
      }
    }

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const byText = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']")).find((node) =>
      normalize(node.textContent ?? "").includes("добавить в корзину")
    );
    if (byText) {
      byText.click();
      return true;
    }

    return false;
  });
  if (!clicked) {
    throw new Error("terminal add-to-cart button was not found");
  }

  await sleep(500);
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector("button.sc-bkUKrm") ||
          document.querySelector("[data-testid*='cart']") ||
          document.querySelector("#cart")
      ),
    {
      timeout: timeoutMs
    }
  );
  journal.push("cart_action=added_to_cart");
}

async function readCartSnapshot(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const cartButton =
      document.querySelector<HTMLElement>("button.sc-bkUKrm") ??
      document.querySelector<HTMLElement>("[data-testid*='cart']") ??
      document.querySelector<HTMLElement>("#cart");
    if (!cartButton) {
      return null;
    }

    return (cartButton.textContent ?? "").replace(/\s+/g, " ").trim() || "cart_button_visible";
  });
}

async function ensureCheckoutReady(page: Page, journal: string[], timeoutMs: number): Promise<void> {
  const alreadyReady = await page.evaluate(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const selectors = [
      "#checkout-button",
      "#submit-order-button",
      "#complete-purchase-button",
      "#payment-button"
    ];
    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    const positiveTerms = [
      "оплат",
      "к оплате",
      "оформ",
      "подтверд",
      "купить",
      "заверш",
      "continue",
      "confirm",
      "checkout",
      "submit order",
      "pay"
    ];
    const negativeTerms = ["добавить в корзину", "корзин", "случайные", "очистить", "назад", "удалить"];
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"));
    return candidates.some((node) => {
      const text = normalize(node.textContent ?? "");
      const id = normalize(node.id);
      const label = normalize(node.getAttribute("aria-label") ?? "");
      const combined = `${text} ${id} ${label}`.trim();
      if (!combined) {
        return false;
      }

      const hasPositive = positiveTerms.some((term) => combined.includes(term));
      const hasNegative = negativeTerms.some((term) => combined.includes(term));
      return hasPositive && !hasNegative;
    });
  });
  if (alreadyReady) {
    journal.push("checkout_surface=ready");
    return;
  }

  const opened = await page.evaluate(() => {
    const direct =
      document.querySelector<HTMLElement>("button.sc-bkUKrm") ??
      document.querySelector<HTMLElement>("[data-testid*='cart']") ??
      document.querySelector<HTMLElement>("#cart");
    if (direct) {
      direct.click();
      return true;
    }

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const clickableNodes = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button'], div"));
    const candidate = clickableNodes.find((node) => {
      const text = normalize(node.textContent ?? "");
      const label = normalize(node.getAttribute("aria-label") ?? "");
      return text.includes("корзин") || label.includes("корзин") || text === "cart" || label === "cart";
    });
    if (candidate) {
      candidate.click();
      return true;
    }

    return false;
  });
  if (!opened) {
    throw new Error("unable to open terminal cart view for checkout");
  }

  await page.waitForFunction(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const selectors = [
      "#checkout-button",
      "#submit-order-button",
      "#complete-purchase-button",
      "#payment-button"
    ];
    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    const positiveTerms = [
      "оплат",
      "к оплате",
      "оформ",
      "подтверд",
      "купить",
      "заверш",
      "continue",
      "confirm",
      "checkout",
      "submit order",
      "pay"
    ];
    const negativeTerms = ["добавить в корзину", "корзин", "случайные", "очистить", "назад", "удалить"];
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"));
    return candidates.some((node) => {
      const text = normalize(node.textContent ?? "");
      const id = normalize(node.id);
      const label = normalize(node.getAttribute("aria-label") ?? "");
      const combined = `${text} ${id} ${label}`.trim();
      if (!combined) {
        return false;
      }

      const hasPositive = positiveTerms.some((term) => combined.includes(term));
      const hasNegative = negativeTerms.some((term) => combined.includes(term));
      return hasPositive && !hasNegative;
    });
  }, {
    timeout: timeoutMs
  });
  journal.push("checkout_surface=open");
}

async function finalizePurchase(page: Page, journal: string[], timeoutMs: number): Promise<void> {
  const maxSteps = 4;

  for (let step = 0; step < maxSteps; step += 1) {
    if (
      await page.evaluate(() => {
        const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
        const text = normalize(document.body?.innerText ?? "");
        if (!text) {
          return false;
        }

        const successTerms = [
          "успеш",
          "оформлен",
          "оформлена",
          "заказ принят",
          "заказ оформ",
          "билет куплен",
          "покупка заверш",
          "оплата прошла",
          "оплачено"
        ];
        if (successTerms.some((term) => text.includes(term))) {
          return true;
        }

        const selectors = [
          "#checkout-button",
          "#submit-order-button",
          "#complete-purchase-button",
          "#payment-button"
        ];
        for (const selector of selectors) {
          if (document.querySelector(selector)) {
            return false;
          }
        }

        return !text.includes("добавить в корзину");
      })
    ) {
      journal.push("checkout_result=success_signal_visible");
      return;
    }

    const clickedAction = await page.evaluate(() => {
      const selectors = [
        "#checkout-button",
        "#submit-order-button",
        "#complete-purchase-button",
        "#payment-button"
      ];
      for (const selector of selectors) {
        const node = document.querySelector<HTMLElement>(selector);
        if (node) {
          node.click();
          return node.textContent?.replace(/\s+/g, " ").trim() || node.id || "checkout_button";
        }
      }

      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
      const positiveTerms = [
        "оплат",
        "к оплате",
        "оформ",
        "подтверд",
        "купить",
        "заверш",
        "continue",
        "confirm",
        "checkout",
        "submit order",
        "pay"
      ];
      const negativeTerms = ["добавить в корзину", "корзин", "случайные", "очистить", "назад", "удалить"];
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"));
      const candidate =
        candidates.find((node) => {
          const text = normalize(node.textContent ?? "");
          const id = normalize(node.id);
          const label = normalize(node.getAttribute("aria-label") ?? "");
          const combined = `${text} ${id} ${label}`.trim();
          if (!combined) {
            return false;
          }

          const hasPositive = positiveTerms.some((term) => combined.includes(term));
          const hasNegative = negativeTerms.some((term) => combined.includes(term));
          return hasPositive && !hasNegative;
        }) ?? null;

      if (!candidate) {
        return null;
      }

      candidate.click();
      return candidate.textContent?.replace(/\s+/g, " ").trim() || candidate.id || "checkout_button";
    });
    if (!clickedAction) {
      break;
    }

    journal.push(`checkout_action=${clickedAction}`);
    await sleep(900);
  }

  await page.waitForFunction(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const text = normalize(document.body?.innerText ?? "");
    if (!text) {
      return false;
    }

    const successTerms = [
      "успеш",
      "оформлен",
      "оформлена",
      "заказ принят",
      "заказ оформ",
      "билет куплен",
      "покупка заверш",
      "оплата прошла",
      "оплачено"
    ];
    if (successTerms.some((term) => text.includes(term))) {
      return true;
    }

    const selectors = [
      "#checkout-button",
      "#submit-order-button",
      "#complete-purchase-button",
      "#payment-button"
    ];
    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return false;
      }
    }

    return !text.includes("добавить в корзину");
  }, {
    timeout: timeoutMs
  });
  journal.push("checkout_result=success_signal_visible");
}

async function readPurchaseReference(page: Page, requestId: string): Promise<string> {
  const extracted = await page.evaluate(() => {
    const normalizedBody = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
    if (!normalizedBody) {
      return null;
    }

    const patterns = [
      /(?:билет|заказ|номер|чек)[^A-ZА-Я0-9#№-]{0,24}(?:№|#)?\s*([A-ZА-Я0-9-]{6,})/i,
      /(?:№|#)\s*([A-ZА-Я0-9-]{6,})/i
    ];

    for (const pattern of patterns) {
      const match = normalizedBody.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  });

  return extracted?.trim() || `${requestId}:terminal-purchased`;
}

function parseBig8Payload(input: unknown): Big8PurchasePayload {
  if (!input || typeof input !== "object") {
    throw new Error("big8 payload must be an object");
  }

  const record = input as Record<string, unknown>;
  const contactPhone =
    typeof record.contactPhone === "string" ? record.contactPhone.replace(/\D/g, "") : "";
  if (contactPhone.length < 10 || contactPhone.length > 15) {
    throw new Error("big8 payload must contain contactPhone with 10-15 digits");
  }

  const rawTickets = Array.isArray(record.tickets) ? record.tickets : null;
  if (!rawTickets || rawTickets.length === 0) {
    throw new Error("big8 payload must contain at least one ticket");
  }

  const tickets = rawTickets.map((rawTicket, index) => parseTicket(rawTicket, index));

  return {
    contactPhone,
    tickets
  };
}

async function sleep(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

function parseTicket(input: unknown, index: number): Big8TicketPayload {
  if (!input || typeof input !== "object") {
    throw new Error(`big8 ticket #${index + 1} must be an object`);
  }

  const record = input as Record<string, unknown>;
  const boardNumbers = Array.isArray(record.boardNumbers)
    ? record.boardNumbers
        .filter((value): value is number => Number.isInteger(value))
        .map((value) => Math.trunc(value))
    : null;
  const extraNumber = Number.isInteger(record.extraNumber) ? Math.trunc(record.extraNumber as number) : NaN;
  const multiplier = Number.isInteger(record.multiplier) ? Math.trunc(record.multiplier as number) : NaN;

  if (!boardNumbers || boardNumbers.length !== BIG8_BOARD_REQUIRED) {
    throw new Error(`big8 ticket #${index + 1} must contain exactly ${BIG8_BOARD_REQUIRED} board numbers`);
  }

  const uniqueBoardNumbers = [...new Set(boardNumbers)];
  if (uniqueBoardNumbers.length !== boardNumbers.length) {
    throw new Error(`big8 ticket #${index + 1} board numbers must be unique`);
  }
  if (uniqueBoardNumbers.some((value) => value < BIG8_BOARD_MIN || value > BIG8_BOARD_MAX)) {
    throw new Error(
      `big8 ticket #${index + 1} board numbers must be in range ${BIG8_BOARD_MIN}-${BIG8_BOARD_MAX}`
    );
  }

  if (!Number.isInteger(extraNumber) || extraNumber < BIG8_EXTRA_MIN || extraNumber > BIG8_EXTRA_MAX) {
    throw new Error(`big8 ticket #${index + 1} extra number must be in range ${BIG8_EXTRA_MIN}-${BIG8_EXTRA_MAX}`);
  }
  if (
    !Number.isInteger(multiplier) ||
    multiplier < BIG8_MULTIPLIER_MIN ||
    multiplier > BIG8_MULTIPLIER_MAX
  ) {
    throw new Error(`big8 ticket #${index + 1} multiplier must be in range ${BIG8_MULTIPLIER_MIN}-${BIG8_MULTIPLIER_MAX}`);
  }

  return {
    boardNumbers: uniqueBoardNumbers.sort((left, right) => left - right),
    extraNumber,
    multiplier
  };
}
