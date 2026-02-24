import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.describe("Chat markdown review", () => {
  test("capture chat markdown artifacts and layout signals", async ({ page }, testInfo) => {
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();

    const chatLog = page.locator(".chat-log").first();
    const input = page.locator(".chat-textarea").first();
    await expect(chatLog).toBeVisible();
    await expect(input).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath("chat-markdown-full.png"),
      fullPage: true
    });

    await input.fill("**I like coffee**\n- espresso\n- pour over\n\n`brew` notes");
    await page.getByRole("button", { name: "Send message" }).click();

    const userBubble = page.locator(".message.user .bubble").last();
    await expect(userBubble.locator("strong")).toContainText("I like coffee");
    await expect(userBubble.locator("ul li")).toHaveCount(2);
    await expect(userBubble.locator("code")).toContainText("brew");

    await chatLog.screenshot({
      path: testInfo.outputPath("chat-markdown-log.png")
    });

    const audit = await page.evaluate(() => {
      const chatView = document.querySelector(".chat-view") as HTMLElement | null;
      const chatLogEl = document.querySelector(".chat-log") as HTMLElement | null;
      const userBubble = document.querySelector(".message.user .bubble") as HTMLElement | null;
      const systemBubble = document.querySelector(".message.system .bubble") as HTMLElement | null;

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        chatViewOverflowX: chatView ? chatView.scrollWidth > chatView.clientWidth : null,
        chatLogOverflowX: chatLogEl ? chatLogEl.scrollWidth > chatLogEl.clientWidth : null,
        userMarkdown: {
          hasStrong: Boolean(userBubble?.querySelector("strong")),
          listCount: userBubble?.querySelectorAll("ul li").length ?? 0,
          codeCount: userBubble?.querySelectorAll("code").length ?? 0,
          preCount: userBubble?.querySelectorAll("pre").length ?? 0
        },
        systemMessage: {
          present: Boolean(systemBubble),
          text: (systemBubble?.textContent ?? "").trim()
        }
      };
    });

    await writeFile(testInfo.outputPath("chat-markdown-audit.json"), JSON.stringify(audit, null, 2), "utf8");
    await testInfo.attach("chat-markdown-audit.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(audit, null, 2), "utf8")
    });
  });
});
