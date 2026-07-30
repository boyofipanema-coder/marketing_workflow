import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

describe("middleware", () => {
  it("redirects requests without a session to login", () => {
    const response = middleware(new NextRequest("https://example.com/home"));

    expect(response.headers.get("location")).toBe("https://example.com/login");
  });

  it("allows a request with a session cookie", () => {
    const response = middleware(
      new NextRequest("https://example.com/home", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` },
      })
    );

    expect(response.headers.get("location")).toBeNull();
  });
});
