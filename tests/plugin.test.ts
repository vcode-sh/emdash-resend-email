import {
	createPluginRuntimeTestHost,
	type PluginRuntimeTestHost,
} from "@emdash-cms/plugin-test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const API_KEY = "re_test_0123456789";
const PLUGIN_USER_AGENT = /^emdash-resend-email\//;

const message = {
	cc: ["editor@example.com"],
	html: '<p><a href="https://example.com/login">Sign in</a></p>',
	replyTo: "support@example.com",
	subject: "Your sign-in link",
	text: "Open https://example.com/login to sign in.",
	to: "reader@example.com",
};

let host: PluginRuntimeTestHost | undefined;

beforeAll(() => {
	// A fixed, valid test key: 32 zero bytes in unpadded base64url.
	process.env.EMDASH_ENCRYPTION_KEY = `emdash_enc_v1_${"A".repeat(43)}`;
});

afterEach(async () => {
	await host?.dispose();
	host = undefined;
});

async function configuredHost(
	settings: Record<string, string>
): Promise<PluginRuntimeTestHost> {
	const runtimeHost = await createPluginRuntimeTestHost();
	const result = await runtimeHost.actions.plugin.updateSettings(settings);
	if (!result.success) {
		throw new Error(`Settings update failed: ${result.error.message}`);
	}
	return runtimeHost;
}

function deliver(runtimeHost: PluginRuntimeTestHost) {
	return runtimeHost.transport.invokeHook("email:deliver", {
		message,
		source: "system",
	});
}

describe("email:deliver", () => {
	it("sends every message field to the Resend API", async () => {
		host = await configuredHost({
			apiKey: API_KEY,
			fromEmail: "cms@example.com",
			fromName: "Example CMS",
		});
		await host.http.respond(
			RESEND_EMAILS_URL,
			Response.json({ id: "email-1" })
		);

		await deliver(host);

		const [request] = host.http.requests();
		expect(request).toMatchObject({
			headers: expect.objectContaining({
				authorization: `Bearer ${API_KEY}`,
				"user-agent": expect.stringMatching(PLUGIN_USER_AGENT),
			}),
			method: "POST",
			url: RESEND_EMAILS_URL,
		});
		expect(JSON.parse(new TextDecoder().decode(request?.body))).toEqual({
			cc: ["editor@example.com"],
			from: "Example CMS <cms@example.com>",
			html: '<p><a href="https://example.com/login">Sign in</a></p>',
			reply_to: "support@example.com",
			subject: "Your sign-in link",
			text: "Open https://example.com/login to sign in.",
			to: "reader@example.com",
		});
	});

	it("quotes a sender name that contains RFC 5322 specials", async () => {
		host = await configuredHost({
			apiKey: API_KEY,
			fromEmail: "cms@example.com",
			fromName: 'Example, "The" CMS',
		});
		await host.http.respond(
			RESEND_EMAILS_URL,
			Response.json({ id: "email-2" })
		);

		await deliver(host);

		const body = JSON.parse(
			new TextDecoder().decode(host.http.requests()[0]?.body)
		);
		expect(body.from).toBe('"Example, \\"The\\" CMS" <cms@example.com>');
	});

	it("surfaces the Resend error so the admin test send can show it", async () => {
		host = await configuredHost({
			apiKey: API_KEY,
			fromEmail: "cms@example.com",
		});
		await host.http.respond(
			RESEND_EMAILS_URL,
			Response.json(
				{
					message: "The example.com domain is not verified.",
					name: "validation_error",
					statusCode: 403,
				},
				{ status: 403 }
			)
		);

		const failure = deliver(host);

		await expect(failure).rejects.toThrow(
			"Resend rejected the email (403 validation_error): The example.com domain is not verified."
		);
		await expect(failure).rejects.not.toThrow(API_KEY);
	});

	it("refuses to send before an API key and sender are configured", async () => {
		host = await createPluginRuntimeTestHost();

		await expect(deliver(host)).rejects.toThrow("Resend is not configured");
		expect(host.http.requests()).toEqual([]);
	});
});

describe("settings", () => {
	it("stores the API key encrypted", async () => {
		host = await configuredHost({
			apiKey: API_KEY,
			fromEmail: "cms@example.com",
		});

		const stored = await host.inspect.settings.raw("apiKey");

		expect(stored).toMatchObject({ kid: expect.any(String), v: 1 });
		expect(JSON.stringify(stored)).not.toContain(API_KEY);
	});
});
