import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import server first to resolve ESM circular dependency cycles cleanly
import "../../../server.ts";

import { sendRealEmail } from "../mailer.ts";
import { startImapPolling, stopImapPolling } from "../imap_poller.ts";
import nodemailer from "nodemailer";

// Mock nodemailer module
vi.mock("nodemailer", () => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: "mock-smtp-id-123" });
  return {
    default: {
      createTransport: vi.fn(() => ({
        sendMail: sendMailMock,
      })),
    },
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
    })),
  };
});

// Mock imapflow module
vi.mock("imapflow", () => {
  return {
    ImapFlow: class {
      connect = vi.fn().mockResolvedValue(undefined);
      getMailboxLock = vi.fn().mockResolvedValue({ release: vi.fn() });
      search = vi.fn().mockResolvedValue([]);
      fetchOne = vi.fn().mockResolvedValue(undefined);
      messageFlagsAdd = vi.fn().mockResolvedValue(undefined);
      logout = vi.fn().mockResolvedValue(undefined);
    }
  };
});


describe("Stally SMTP Mailer & IMAP Poller Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopImapPolling();
  });

  describe("Outbound SMTP Sourcing mailer", () => {
    it("should fail gracefully with config warning if SMTP is not configured", async () => {
      // Temporarily clear environment
      const oldHost = process.env.SMTP_HOST;
      delete process.env.SMTP_HOST;

      const response = await sendRealEmail({
        to: "supplier@test.com",
        subject: "Báo giá thầu",
        html: "<p>Nội dung</p>"
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain("EMAIL_SEND_DISABLED_IN_TEST");

      // Restore environment
      process.env.SMTP_HOST = oldHost;
    });
  });

  describe("Inbound IMAP Poller service", () => {
    it("should start IMAP polling successfully when configured", () => {
      process.env.EMAIL_INBOUND_PROVIDER = "imap";
      process.env.IMAP_POLL_ENABLED = "true";
      process.env.IMAP_HOST = "imap.gmail.com";
      process.env.IMAP_USER = "test@gmail.com";
      process.env.IMAP_PASS = "pass";

      // Just ensure starting the poller sets the interval timer and doesn't throw EADDRINUSE or connect exceptions
      expect(() => startImapPolling()).not.toThrow();
    });

    it("should skip polling silently if disabled in settings", () => {
      process.env.EMAIL_INBOUND_PROVIDER = "imap";
      process.env.IMAP_POLL_ENABLED = "false";
      expect(() => startImapPolling()).not.toThrow();
    });
  });
});
